// server.js - SPP RETRORUSH DRIVE Multiplayer Backend
// Express + Socket.IO + SQLite for room management and leaderboard persistence

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

// Use better-sqlite3 if available, otherwise mock it
let Database;
try {
  Database = require('better-sqlite3');
} catch(e) {
  console.warn('better-sqlite3 not available, using in-memory storage only');
  Database = null;
}

const PORT = process.env.PORT || 3000;
const ORIGIN = process.env.ORIGIN || '*';

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: ORIGIN, methods: ["GET","POST"] }
});

// Serve static files
app.use(express.static(path.join(__dirname)));

// Initialize database (only if better-sqlite3 available)
let db = null;
if (Database) {
  try {
    db = new Database(path.join(__dirname, 'data.db'));
    
    db.prepare(`
      CREATE TABLE IF NOT EXISTS leaderboard (
        username TEXT PRIMARY KEY,
        wins INTEGER DEFAULT 0,
        races INTEGER DEFAULT 0,
        best_time REAL DEFAULT NULL
      )
    `).run();
    
    db.prepare(`
      CREATE TABLE IF NOT EXISTS rooms (
        code TEXT PRIMARY KEY,
        host_id TEXT,
        host_name TEXT,
        members_json TEXT,
        created_at INTEGER
      )
    `).run();
    
    console.log('Database initialized');
  } catch(err) {
    console.warn('Database initialization failed, using in-memory storage:', err.message);
    db = null;
  }
}

// In-memory rooms (always available)
const rooms = {};

function makeCode(len=6){
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for(let i=0;i<len;i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}

function persistRoom(code){
  if(!db) return; // Skip if no database
  const r = rooms[code];
  if(!r) {
    try {
      db.prepare('DELETE FROM rooms WHERE code = ?').run(code);
    } catch(e) {}
    return;
  }
  try {
    const membersJson = JSON.stringify(Object.entries(r.members).map(([id, m]) => ({ id, name: m.name })));
    db.prepare(`
      INSERT OR REPLACE INTO rooms (code, host_id, host_name, members_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(code, r.hostId, r.members[r.hostId]?.name || null, membersJson, r.createdAt || Date.now());
  } catch(e) {
    console.warn('Failed to persist room:', e.message);
  }
}

function getRoomView(code){
  const r = rooms[code];
  if(!r) return null;
  return {
    code,
    hostId: r.hostId,
    members: Object.entries(r.members).map(([id, m]) => ({ id, name: m.name }))
  };
}

// Leaderboard functions
function upsertLeaderboard(username, wins, races, best_time) {
  if(!db) return;
  try {
    db.prepare(`
      INSERT INTO leaderboard (username, wins, races, best_time)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(username) DO UPDATE SET
        wins = excluded.wins,
        races = excluded.races,
        best_time = excluded.best_time
    `).run(username, wins, races, best_time);
  } catch(e) {
    console.warn('Failed to update leaderboard:', e.message);
  }
}

function getLeaderboardTop(limit=100) {
  if(!db) return [];
  try {
    return db.prepare(`
      SELECT username, wins, races, best_time
      FROM leaderboard
      ORDER BY wins DESC, COALESCE(best_time, 999999) ASC
      LIMIT ?
    `).all(limit);
  } catch(e) {
    console.warn('Failed to fetch leaderboard:', e.message);
    return [];
  }
}

// Socket.IO event handlers
io.on('connection', socket => {
  console.log('Socket connected:', socket.id);

  socket.on('create_room', ({ name }, cb) => {
    const code = makeCode();
    rooms[code] = { hostId: socket.id, members: {}, createdAt: Date.now() };
    rooms[code].members[socket.id] = { name: name || 'GUEST' };
    socket.join(code);
    persistRoom(code);
    cb && cb({ ok: true, code });
    io.to(code).emit('room_update', getRoomView(code));
    console.log('Room created:', code);
  });

  socket.on('join_room', ({ code, name }, cb) => {
    const r = rooms[code];
    if(!r) return cb && cb({ ok: false, error: 'Room not found' });
    if(Object.keys(r.members).length >= 16) return cb && cb({ ok: false, error: 'Room full' });
    r.members[socket.id] = { name: name || 'GUEST' };
    socket.join(code);
    persistRoom(code);
    cb && cb({ ok: true, code, host: r.hostId === socket.id });
    io.to(code).emit('room_update', getRoomView(code));
    console.log(`${name || 'GUEST'} joined ${code}`);
  });

  socket.on('leave_room', ({ code }) => {
    leaveRoom(socket, code);
  });

  socket.on('start_race', ({ code }) => {
    const r = rooms[code];
    if(!r) return;
    if(r.hostId !== socket.id) return;
    io.to(code).emit('race_start', { at: Date.now() });
    console.log('Race started:', code);
  });

  socket.on('player_state', (data) => {
    const { code } = data;
    if(!code) return;
    socket.to(code).emit('player_state_update', { id: socket.id, ...data });
  });

  socket.on('race_end', ({ code, results }) => {
    if(!Array.isArray(results)) return;
    results.forEach(r => {
      const existing = db ? db.prepare('SELECT * FROM leaderboard WHERE username = ?').get(r.name) : null;
      const wins = (existing?.wins || 0) + (r.place === 1 ? 1 : 0);
      const races = (existing?.races || 0) + 1;
      const best_time = existing && existing.best_time ? Math.min(existing.best_time, r.time) : r.time;
      upsertLeaderboard(r.name, wins, races, best_time);
    });
    const top = getLeaderboardTop(100);
    io.emit('leaderboard_update', top);
    console.log('Race ended, results persisted for room:', code);
  });

  socket.on('disconnect', () => {
    for(const code of Object.keys(rooms)){
      if(rooms[code].members[socket.id]){
        leaveRoom(socket, code);
      }
    }
    console.log('Socket disconnected:', socket.id);
  });

  function leaveRoom(socket, code){
    const r = rooms[code];
    if(!r) return;
    delete r.members[socket.id];
    socket.leave(code);
    if(r.hostId === socket.id){
      const ids = Object.keys(r.members);
      if(ids.length > 0){
        r.hostId = ids[0];
      } else {
        delete rooms[code];
        persistRoom(code);
        io.emit('room_removed', { code });
        console.log('Room removed:', code);
        return;
      }
    }
    persistRoom(code);
    io.to(code).emit('room_update', getRoomView(code));
    console.log('Left room:', socket.id, code);
  }
});

// HTTP endpoints
app.get('/leaderboard', (req, res) => {
  const top = getLeaderboardTop(100);
  res.json(top);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

server.listen(PORT, () => {
  console.log(`\n🚀 SPP RETRORUSH DRIVE Server Running`);
  console.log(`   Port: ${PORT}`);
  console.log(`   CORS Origin: ${ORIGIN}`);
  console.log(`   Database: ${db ? 'SQLite' : 'In-memory (no persistence)'}\n`);
});

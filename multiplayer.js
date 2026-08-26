// Multiplayer Client for SPP RETRORUSH DRIVE
// Connects to the backend server via Socket.IO

// ===== CONFIGURATION =====
// Auto-detect environment: use localhost for development, Render URL for production
const SERVER_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000'
  : 'https://spp-retrorush-drive.onrender.com'; // Render deployment URL

console.log('[Multiplayer] Connecting to server:', SERVER_URL);

// ===== SOCKET.IO CONNECTION =====
let socket;
try {
  socket = io(SERVER_URL, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    transports: ['websocket', 'polling']
  });
} catch(e) {
  console.error('[Multiplayer] Failed to initialize Socket.IO:', e);
}

// ===== STATE =====
let playerName = 'GUEST';
let currentRoom = null;
let isHost = false;
let players = {};

// ===== CONNECTION EVENTS =====
socket.on('connect', () => {
  console.log('[Multiplayer] ✅ Connected to server:', socket.id);
  displayMessage('Connected to multiplayer server!', 'success');
});

socket.on('disconnect', () => {
  console.log('[Multiplayer] ❌ Disconnected from server');
  displayMessage('Disconnected from server', 'error');
  currentRoom = null;
  players = {};
});

socket.on('connect_error', (error) => {
  console.error('[Multiplayer] Connection error:', error);
  displayMessage('Connection error: ' + error.message, 'error');
});

// ===== ROOM EVENTS =====
socket.on('room_update', (roomData) => {
  if (!roomData) return;
  console.log('[Multiplayer] Room updated:', roomData);
  
  currentRoom = roomData.code;
  isHost = roomData.hostId === socket.id;
  
  players = {};
  roomData.members.forEach(member => {
    players[member.id] = { name: member.name };
  });
  
  updateRoomUI();
});

socket.on('room_removed', (data) => {
  console.log('[Multiplayer] Room removed:', data.code);
  displayMessage('Room was closed', 'error');
  currentRoom = null;
  players = {};
  updateRoomUI();
});

// ===== RACE EVENTS =====
socket.on('race_start', (data) => {
  console.log('[Multiplayer] Race started!');
  displayMessage('Race started!', 'success');
  // Trigger game start here
  if (typeof gameStartRace === 'function') {
    gameStartRace(data.at);
  }
});

socket.on('player_state_update', (data) => {
  const playerId = data.id;
  if (!players[playerId]) {
    players[playerId] = {};
  }
  // Update player position/state in your game
  players[playerId].x = data.x;
  players[playerId].y = data.y;
  players[playerId].z = data.z;
  players[playerId].rotY = data.rotY;
  players[playerId].speed = data.speed;
  
  if (typeof updateRemotePlayer === 'function') {
    updateRemotePlayer(playerId, data);
  }
});

socket.on('leaderboard_update', (leaderboard) => {
  console.log('[Multiplayer] Leaderboard updated:', leaderboard);
  if (typeof updateLeaderboardUI === 'function') {
    updateLeaderboardUI(leaderboard);
  }
});

// ===== PUBLIC FUNCTIONS =====

function createRoom(name) {
  playerName = name || 'GUEST';
  socket.emit('create_room', { name: playerName }, (response) => {
    if (response.ok) {
      currentRoom = response.code;
      console.log('[Multiplayer] Room created:', currentRoom);
      displayMessage('Room created! Code: ' + currentRoom, 'success');
    } else {
      displayMessage('Failed to create room', 'error');
    }
  });
}

function joinRoom(code, name) {
  playerName = name || 'GUEST';
  socket.emit('join_room', { code, name: playerName }, (response) => {
    if (response.ok) {
      currentRoom = code;
      isHost = response.host;
      console.log('[Multiplayer] Joined room:', currentRoom);
      displayMessage('Joined room ' + code + '!', 'success');
    } else {
      displayMessage('Failed to join room: ' + (response.error || 'Unknown error'), 'error');
    }
  });
}

function leaveRoom() {
  if (!currentRoom) return;
  socket.emit('leave_room', { code: currentRoom });
  currentRoom = null;
  players = {};
  displayMessage('Left room', 'info');
  updateRoomUI();
}

function startRace() {
  if (!currentRoom || !isHost) {
    displayMessage('Only the host can start the race', 'error');
    return;
  }
  socket.emit('start_race', { code: currentRoom });
}

function sendPlayerState(x, y, z, rotY, speed) {
  if (!currentRoom) return;
  socket.emit('player_state', {
    code: currentRoom,
    x, y, z, rotY, speed,
    timestamp: Date.now()
  });
}

function sendRaceResults(results) {
  // results: [{ name, time, place }, ...]
  if (!currentRoom) return;
  socket.emit('race_end', { code: currentRoom, results });
}

function fetchLeaderboard() {
  fetch(SERVER_URL + '/leaderboard')
    .then(r => r.json())
    .then(data => {
      console.log('[Multiplayer] Leaderboard:', data);
      if (typeof updateLeaderboardUI === 'function') {
        updateLeaderboardUI(data);
      }
    })
    .catch(err => console.error('[Multiplayer] Leaderboard fetch error:', err));
}

// ===== UI HELPERS =====

function displayMessage(msg, type) {
  // type: 'success', 'error', 'info'
  console.log(`[${type.toUpperCase()}] ${msg}`);
  
  // If your game has a UI for messages, update it here
  if (typeof showGameMessage === 'function') {
    showGameMessage(msg, type);
  }
}

function updateRoomUI() {
  console.log('[Multiplayer] Current room:', currentRoom);
  console.log('[Multiplayer] Is host:', isHost);
  console.log('[Multiplayer] Players:', Object.keys(players).length);
  
  // Update your game's UI to show room info
  if (typeof updateGameRoomUI === 'function') {
    updateGameRoomUI({
      roomCode: currentRoom,
      isHost: isHost,
      playerCount: Object.keys(players).length,
      players: players
    });
  }
}

// ===== EXPORT =====
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createRoom,
    joinRoom,
    leaveRoom,
    startRace,
    sendPlayerState,
    sendRaceResults,
    fetchLeaderboard
  };
}

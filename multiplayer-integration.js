// ===== MULTIPLAYER INTEGRATION MODULE =====
// Hooks into the existing game to enable Socket.IO multiplayer
// This module bridges the game logic with the multiplayer.js client

let multiplayerActive = false;
let remotePlayerObjects = {}; // Three.js objects for remote players
let myPlayerState = {
  x: 0, y: 0, z: 0,
  rotY: 0,
  speed: 0,
  name: 'GUEST'
};

// Called when multiplayer client connects
function onMultiplayerConnected() {
  console.log('[Game] Multiplayer connected');
  multiplayerActive = true;
  displayGameMessage('Multiplayer connected!', 'success');
}

// Called when multiplayer client disconnects
function onMultiplayerDisconnected() {
  console.log('[Game] Multiplayer disconnected');
  multiplayerActive = false;
  // Clean up remote player objects
  Object.keys(remotePlayerObjects).forEach(id => {
    if (scene && remotePlayerObjects[id]) {
      scene.remove(remotePlayerObjects[id]);
    }
  });
  remotePlayerObjects = {};
  displayGameMessage('Multiplayer disconnected', 'error');
}

// Update a remote player's position in the 3D scene
function updateRemotePlayer(playerId, data) {
  if (!multiplayerActive) return;
  
  // Create player object if doesn't exist
  if (!remotePlayerObjects[playerId]) {
    const geometry = new THREE.BoxGeometry(2, 1.5, 4);
    const material = new THREE.MeshStandardMaterial({ 
      color: Math.random() * 0xffffff,
      roughness: 0.7
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    remotePlayerObjects[playerId] = mesh;
  }
  
  // Update position and rotation
  const obj = remotePlayerObjects[playerId];
  obj.position.set(data.x, data.y, data.z);
  obj.rotation.y = data.rotY;
}

// Send this player's state to the server (called during game loop)
function broadcastPlayerState() {
  if (!multiplayerActive) return;
  
  // Get player car position from the game
  if (typeof playerCar !== 'undefined' && playerCar.mesh) {
    const pos = playerCar.mesh.position;
    sendPlayerState(
      pos.x,
      pos.y,
      pos.z,
      playerCar.mesh.rotation.y,
      playerCar.speed || 0
    );
  }
}

// Called when a race ends to send results
function submitRaceResults(results) {
  if (!multiplayerActive) return;
  
  const processedResults = results.map(r => ({
    name: r.name || 'GUEST',
    time: r.time || 0,
    place: r.place || 0
  }));
  
  sendRaceResults(processedResults);
  console.log('[Game] Submitted race results:', processedResults);
}

// Display a game message to the player
function displayGameMessage(msg, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  
  toast.textContent = msg;
  toast.className = 'show ' + (type === 'error' ? 'warn' : '');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Update the game's UI with room info
function updateGameRoomUI(roomInfo) {
  if (!roomInfo) return;
  
  console.log('[Game] Room info:', roomInfo);
  
  const badge = document.getElementById('account-badge');
  if (badge) {
    const infoText = document.createElement('div');
    infoText.style.fontSize = '10px';
    infoText.style.color = '#888';
    infoText.textContent = `Room: ${roomInfo.roomCode} | Players: ${roomInfo.playerCount}`;
    if (!badge.querySelector('[data-room-info]')) {
      const el = document.createElement('div');
      el.setAttribute('data-room-info', '1');
      el.style.fontSize = '10px';
      el.style.color = '#888';
      el.textContent = `Room: ${roomInfo.roomCode || 'Solo'} | Players: ${roomInfo.playerCount || 1}`;
      badge.appendChild(el);
    } else {
      badge.querySelector('[data-room-info]').textContent = `Room: ${roomInfo.roomCode || 'Solo'} | Players: ${roomInfo.playerCount || 1}`;
    }
  }
}

// Update leaderboard from server
function updateLeaderboardUI(leaderboard) {
  if (!Array.isArray(leaderboard)) return;
  
  const rows = document.getElementById('leaderboard-rows');
  if (!rows) return;
  
  rows.innerHTML = leaderboard.slice(0, 10).map((entry, i) => {
    const best = entry.best_time ? entry.best_time.toFixed(1) + 's' : '—';
    return `<div class="lb-row"><span><span class="lb-rank">#${i+1}</span>${entry.username}</span><span>${entry.wins} wins · best ${best}</span></div>`;
  }).join('');
}

// Called when game should start a race (multiplayer version)
function gameStartRace(timestamp) {
  console.log('[Game] Race starting from multiplayer server at', new Date(timestamp));
  displayGameMessage('RACE START!', 'success');
  // Trigger the existing game's race start logic
  if (typeof raceManager !== 'undefined' && raceManager.start) {
    raceManager.start();
  }
}

// Initialize multiplayer (call this after the game is fully loaded)
function initMultiplayer(playerName = 'GUEST') {
  console.log('[Game] Initializing multiplayer with player name:', playerName);
  
  if (typeof socket === 'undefined') {
    console.error('[Game] Socket.IO not loaded - multiplayer unavailable');
    return false;
  }
  
  myPlayerState.name = playerName;
  
  // Log multiplayer events
  console.log('[Game] Multiplayer module ready. Features:');
  console.log('  - createRoom(name)');
  console.log('  - joinRoom(code, name)');
  console.log('  - leaveRoom()');
  console.log('  - startRace()');
  console.log('  - broadcastPlayerState() [call each frame]');
  console.log('  - submitRaceResults(results)');
  
  return true;
}

// Broadcast player state every 50ms during races
let broadcastInterval = null;
function startBroadcasting() {
  if (broadcastInterval) return;
  broadcastInterval = setInterval(broadcastPlayerState, 50);
}

function stopBroadcasting() {
  if (broadcastInterval) {
    clearInterval(broadcastInterval);
    broadcastInterval = null;
  }
}

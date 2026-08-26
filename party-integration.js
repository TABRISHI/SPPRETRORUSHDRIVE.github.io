// Party UI Integration for SPP RETRORUSH DRIVE Multiplayer
// Connects the game's party UI buttons to multiplayer.js functions

let partyUIState = {
  inParty: false,
  roomCode: null,
  isHost: false,
  memberCount: 0
};

// Wait for DOM and socket to be ready
function initPartyUI() {
  console.log('[Party] Initializing party UI...');
  
  const createBtn = document.getElementById('party-create-btn');
  const joinBtn = document.getElementById('party-join-btn');
  const codeInput = document.getElementById('party-code-input');
  const leaveBtn = document.getElementById('party-leave-btn');
  const startBtn = document.getElementById('party-start-challenge-btn');
  const copyBtn = document.getElementById('party-copy-btn');
  
  if (!createBtn) {
    console.warn('[Party] Party UI buttons not found - waiting...');
    setTimeout(initPartyUI, 500);
    return;
  }
  
  // CREATE PARTY
  createBtn.addEventListener('click', () => {
    const playerName = document.getElementById('account-badge-name').textContent || 'GUEST';
    console.log('[Party] Creating party as:', playerName);
    createRoom(playerName);
  });
  
  // JOIN PARTY
  if (joinBtn && codeInput) {
    joinBtn.addEventListener('click', () => {
      const code = codeInput.value.trim().toUpperCase();
      const playerName = document.getElementById('account-badge-name').textContent || 'GUEST';
      if (!code) {
        alert('Enter a party code');
        return;
      }
      console.log('[Party] Joining party:', code);
      joinRoom(code, playerName);
    });
    
    codeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') joinBtn.click();
    });
  }
  
  // LEAVE PARTY
  if (leaveBtn) {
    leaveBtn.addEventListener('click', () => {
      console.log('[Party] Leaving party');
      leaveRoom();
      updatePartyView();
    });
  }
  
  // START RACE
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      console.log('[Party] Starting race (host only)');
      startRace();
    });
  }
  
  // COPY CODE
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const code = document.getElementById('party-code-text').textContent;
      if (code && code !== '-----') {
        navigator.clipboard.writeText(code).then(() => {
          copyBtn.textContent = 'COPIED!';
          setTimeout(() => { copyBtn.textContent = 'COPY'; }, 2000);
        });
      }
    });
  }
  
  console.log('[Party] UI initialized successfully');
}

// Update party view based on state
function updatePartyView() {
  console.log('[Party] Updating UI view. In party:', partyUIState.inParty);
  
  const createView = document.getElementById('party-join-create-view');
  const lobbyView = document.getElementById('party-lobby-view');
  const codeDisplay = document.getElementById('party-code-display');
  const codeText = document.getElementById('party-code-text');
  const membersList = document.getElementById('party-members-list');
  const hostControls = document.getElementById('party-host-controls');
  const memberWait = document.getElementById('party-member-wait');
  const statusBadge = document.getElementById('party-status-badge');
  
  if (!createView || !lobbyView) return;
  
  if (partyUIState.inParty) {
    // Show lobby view
    createView.style.display = 'none';
    lobbyView.style.display = 'block';
    
    // Update code display
    if (codeText && partyUIState.roomCode) {
      codeText.textContent = partyUIState.roomCode;
    }
    
    // Update status badge
    if (statusBadge) {
      statusBadge.textContent = partyUIState.isHost ? '👤 HOST' : '👥 MEMBER';
      statusBadge.style.color = partyUIState.isHost ? '#46e39a' : '#ffb020';
    }
    
    // Update members list
    if (membersList) {
      membersList.innerHTML = `
        <div class="party-member-row">Players in party: <b>${partyUIState.memberCount}</b></div>
      `;
    }
    
    // Show/hide host controls
    if (hostControls) {
      hostControls.style.display = partyUIState.isHost ? 'block' : 'none';
    }
    if (memberWait) {
      memberWait.style.display = partyUIState.isHost ? 'none' : 'block';
    }
  } else {
    // Show create/join view
    createView.style.display = 'block';
    lobbyView.style.display = 'none';
    
    if (statusBadge) {
      statusBadge.textContent = 'OFFLINE';
      statusBadge.style.color = '#999';
    }
  }
}

// Hook into multiplayer.js socket events
function hookMultiplayerEvents() {
  if (typeof socket === 'undefined') {
    console.warn('[Party] Socket not ready yet');
    setTimeout(hookMultiplayerEvents, 500);
    return;
  }
  
  // Override the room_update event to update our local state
  const originalOn = socket.on.bind(socket);
  socket.on = function(event, callback) {
    if (event === 'room_update') {
      return originalOn(event, (roomData) => {
        if (roomData) {
          partyUIState.inParty = true;
          partyUIState.roomCode = roomData.code;
          partyUIState.isHost = roomData.hostId === socket.id;
          partyUIState.memberCount = roomData.members.length;
          console.log('[Party] Room state updated:', partyUIState);
          updatePartyView();
        }
        if (typeof callback === 'function') callback(roomData);
      });
    }
    return originalOn(event, callback);
  };
  
  console.log('[Party] Multiplayer events hooked');
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      hookMultiplayerEvents();
      initPartyUI();
      updatePartyView();
    }, 1000);
  });
} else {
  setTimeout(() => {
    hookMultiplayerEvents();
    initPartyUI();
    updatePartyView();
  }, 1000);
}

// ── WebSocket Client ─────────────────────────────────────────────────────────

const Client = (() => {
  let ws = null;
  let myToken = null;
  let myRole = null;
  let myRingIndex = null;
  let gameData = null; // schools, glyphMaps, auraColors, categories
  let currentRings = [0, 0, 0, 0];
  let isChanneling = false;
  let reconnectTimer = null;

  // ── Connection ──

  function connect() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const savedToken = sessionStorage.getItem('puzzle_token');
    let url = `${proto}//${location.host}`;
    if (savedToken) url += `?token=${savedToken}`;

    ws = new WebSocket(url);

    ws.onopen = () => {
      showStatus('Connected. Waiting for role assignment...');
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      handleMessage(msg);
    };

    ws.onclose = () => {
      showStatus('Disconnected. Reconnecting...');
      reconnectTimer = setTimeout(connect, 2000);
    };

    ws.onerror = () => {};
  }

  // ── Message Handling ──

  function handleMessage(msg) {
    switch (msg.type) {
      case 'assigned':
        myToken = msg.token;
        myRole = msg.role;
        myRingIndex = msg.ringIndex;
        sessionStorage.setItem('puzzle_token', myToken);
        showGameUI(msg);
        break;

      case 'state':
      case 'player_update':
        gameData = {
          ringSchools: msg.ringSchools,
          auraColors: msg.auraColors,
          categories: msg.categories,
        };
        currentRings = msg.rings;
        updatePlayerDots(msg.players);
        renderRings();
        break;

      case 'ring_update':
        currentRings = msg.rings;
        renderRings();
        break;

      case 'channel_status':
        // Reveal other rings' selected glyphs while channeling
        Rings.setShowOtherRings(true);
        renderRings();
        showStatus(`Channeling... ${msg.count}/${msg.total} connected`);
        break;

      case 'channel_result':
        isChanneling = false;
        document.getElementById('channel-btn').classList.remove('channeling');

        if (msg.success) {
          handleSuccess();
        } else {
          // Hide other rings again after a delay so players can see the result briefly
          setTimeout(() => {
            Rings.setShowOtherRings(false);
            renderRings();
          }, 3000);
          handleFailure(msg);
        }
        break;

      case 'dm_hint':
        showStatus(msg.hint, true);
        break;

      case 'phase_update':
        if (msg.phase === 'playing') {
          document.body.classList.remove('success', 'near-success');
          showStatus('The puzzle resets...');
        }
        break;

      case 'error':
        showStatus(msg.message);
        break;
    }
  }

  // ── UI Setup ──

  function showGameUI(assignment) {
    document.getElementById('waiting-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'flex';

    // Role banner
    document.getElementById('role-name').textContent = assignment.roleName;
    document.getElementById('role-ring').textContent = `Ring ${assignment.ringIndex + 1} (${['Outer', 'Second', 'Third', 'Inner'][assignment.ringIndex]})`;

    // Role-specific info
    Roles.renderInfo(myRole, document.getElementById('role-info'));
    Roles.applyTheme(myRole);

    // Init rings after layout reflow so offsetWidth is correct
    requestAnimationFrame(() => {
      Rings.init('ring-viewport');
      Rings.setOwnRing(myRingIndex);
      Rings.setOnRotate((direction) => rotate(direction));
      renderRings();

      if (myRole === 'distorted') {
        Roles.startGlitch();
      }
    });

    // Resize handler
    window.addEventListener('resize', () => {
      Rings.init('ring-viewport');
      Rings.setOwnRing(myRingIndex);
      Rings.setOnRotate((direction) => rotate(direction));
      renderRings();
    });

    showStatus('Drag the ring to rotate. Channel together when aligned.');
  }

  function renderRings() {
    if (!gameData || myRole === null) return;
    Rings.update(
      currentRings,
      myRole,
      gameData.ringSchools,
      gameData.auraColors,
      gameData.categories
    );
    updateCurrentLabel();
  }

  function updateCurrentLabel() {
    const el = document.getElementById('current-school');
    if (!el || !gameData) return;

    if (myRole === 'arcanist') {
      el.textContent = Rings.getActiveSchool(myRingIndex, currentRings, gameData.ringSchools);
      el.classList.add('pill');
    } else {
      el.textContent = `Ring ${myRingIndex + 1}`;
      el.classList.remove('pill');
    }
  }

  function updatePlayerDots(players) {
    // Update all player dots (waiting screen + game screen)
    document.querySelectorAll('.player-dot').forEach((dot, i) => {
      const idx = i % 4; // 8 dots total (4 waiting + 4 game), map to 4 roles
      const p = players[idx];
      dot.classList.toggle('connected', p && p.connected);
    });
  }

  // ── Actions ──

  function rotate(direction) {
    if (!ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify({ type: 'rotate', direction }));
  }

  function channel() {
    if (!ws || ws.readyState !== 1 || isChanneling) return;
    isChanneling = true;
    document.getElementById('channel-btn').classList.add('channeling');
    ws.send(JSON.stringify({ type: 'channel' }));
    showStatus('Channeling your energy into the weave...');
  }

  // ── Feedback ──

  function handleSuccess() {
    document.body.classList.remove('near-success', 'shake');
    document.body.classList.add('success');
    showStatus('The lock shatters. The Weave is restored.', true);
  }

  function handleFailure(msg) {
    document.body.classList.remove('near-success');

    // Shake effect
    document.body.classList.add('shake');
    setTimeout(() => document.body.classList.remove('shake'), 500);

    if (msg.nearSuccess) {
      document.body.classList.add('near-success');
    }

    if (msg.hints && msg.hints.length > 0) {
      showStatus(msg.hints.join(' \u2014 '), true);
    } else if (msg.hint) {
      showStatus(msg.hint, true);
    } else {
      showStatus('The weave rejects the alignment.');
    }
  }

  function showStatus(text, isHint) {
    const bar = document.getElementById('status-bar');
    if (!bar) return;
    bar.textContent = text;
    bar.className = isHint ? 'hint' : '';
  }

  return { connect, channel };
})();

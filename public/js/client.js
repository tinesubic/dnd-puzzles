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
        showDmHint(msg.hint);
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

    // Play breaking crystal sound
    playCrystalBreak();

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

  // ── Audio ──

  let audioCtx = null;
  const crackSound = new Audio('/audio/glass-crack.mp3');
  crackSound.preload = 'auto';

  function playCrystalBreak() {
    // Play the real glass cracking sample
    try {
      const sound = crackSound.cloneNode();
      sound.volume = 1.0;
      sound.play().catch(() => {});
    } catch (e) {}

    // Layer with a deep rumble for body
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const now = audioCtx.currentTime;
      const dest = audioCtx.destination;

      // Sub-bass boom
      const sub = audioCtx.createOscillator();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(55, now);
      sub.frequency.exponentialRampToValueAtTime(25, now + 0.7);
      const subGain = audioCtx.createGain();
      subGain.gain.setValueAtTime(0.8, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      sub.connect(subGain).connect(dest);
      sub.start(now);
      sub.stop(now + 1);

      // Body thump
      const thump = audioCtx.createOscillator();
      thump.type = 'sine';
      thump.frequency.setValueAtTime(120, now);
      thump.frequency.exponentialRampToValueAtTime(45, now + 0.3);
      const thumpGain = audioCtx.createGain();
      thumpGain.gain.setValueAtTime(0.5, now);
      thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      thump.connect(thumpGain).connect(dest);
      thump.start(now);
      thump.stop(now + 0.5);

      // Lowpassed noise rumble (the slow decaying body)
      const noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate * 1.5, audioCtx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 0.8);
      }
      const rumble = audioCtx.createBufferSource();
      rumble.buffer = noiseBuf;
      const rumbleFilter = audioCtx.createBiquadFilter();
      rumbleFilter.type = 'lowpass';
      rumbleFilter.frequency.value = 350;
      const rumbleGain = audioCtx.createGain();
      rumbleGain.gain.setValueAtTime(0.5, now);
      rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);
      rumble.connect(rumbleFilter).connect(rumbleGain).connect(dest);
      rumble.start(now);
    } catch (e) {}
  }

  function showDmHint(text) {
    let banner = document.getElementById('dm-hint-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'dm-hint-banner';
      banner.className = 'dm-hint-banner';
      // Insert above the channel button
      const channelBtn = document.getElementById('channel-btn');
      if (channelBtn && channelBtn.parentNode) {
        channelBtn.parentNode.insertBefore(banner, channelBtn);
      }
    }
    banner.textContent = text;
    banner.classList.add('visible');
    clearTimeout(banner._timer);
    banner._timer = setTimeout(() => banner.classList.remove('visible'), 8000);
  }

  function showStatus(text, isHint) {
    const bar = document.getElementById('status-bar');
    if (!bar) return;
    bar.textContent = text;
    bar.className = isHint ? 'hint' : '';
  }

  return { connect, channel };
})();

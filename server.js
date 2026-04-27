const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');

// ── Constants ──────────────────────────────────────────────────────────────────

const PORT = 3000;

const SCHOOLS = [
  'Abjuration', 'Evocation', 'Illusion', 'Necromancy',
  'Transmutation', 'Conjuration', 'Divination', 'Enchantment'
];

const CATEGORIES = {
  Abjuration: 'stabilizer', Transmutation: 'stabilizer',
  Evocation: 'destructive', Necromancy: 'destructive',
  Enchantment: 'mental', Illusion: 'mental',
  Divination: 'utility', Conjuration: 'utility'
};

const ROLES = ['arcanist', 'distorted', 'seer', 'warden'];

const ROLE_NAMES = {
  arcanist: 'The Arcanist',
  distorted: 'The Distorted Mind',
  seer: 'The Seer',
  warden: 'The Warden'
};

// Each ring has schools in a different random order.
// The solution target schools: Ring1=Conjuration, Ring2=Divination, Ring3=Transmutation, Ring4=Evocation
const SOLUTION_SCHOOLS = ['Divination', 'Illusion', 'Transmutation', 'Abjuration'];

// Seeded shuffle for reproducibility (Fisher-Yates with a simple seed)
function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Generate randomized school orders per ring (hardcoded seeds for reproducibility)
const RING_SCHOOLS = [
  seededShuffle(SCHOOLS, 42),   // Ring 1
  seededShuffle(SCHOOLS, 137),  // Ring 2
  seededShuffle(SCHOOLS, 256),  // Ring 3
  seededShuffle(SCHOOLS, 999),  // Ring 4
];

// Calculate solution offsets: for each ring, the offset where the target school is at position 0 (top)
const SOLUTION = RING_SCHOOLS.map((ringSchools, i) => {
  const targetSchool = SOLUTION_SCHOOLS[i];
  const idx = ringSchools.indexOf(targetSchool);
  return (8 - idx) % 8;
});

console.log('Ring school orders:');
RING_SCHOOLS.forEach((rs, i) => console.log(`  Ring ${i + 1}: [${rs.join(', ')}]`));
console.log('Solution offsets:', SOLUTION);
console.log('Solution schools:', getActiveSchools(SOLUTION));

// Distorted Mind aura colors
const AURA_COLORS = {};
for (const [school, cat] of Object.entries(CATEGORIES)) {
  if (cat === 'destructive') AURA_COLORS[school] = 'warm';
  else if (cat === 'stabilizer') AURA_COLORS[school] = 'cool';
  else AURA_COLORS[school] = 'neutral';
}

// ── Game State ─────────────────────────────────────────────────────────────────

const gameState = {
  players: {},        // token -> { ws, role, ringIndex, connected }
  rings: [0, 0, 0, 0],
  phase: 'waiting',   // waiting | playing | channeling | success
  attemptCount: 0,
  log: [],
};

const channelWindow = {
  active: false,
  timer: null,
  presses: new Map(), // token -> serverTimestamp
};

// ── Validation Engine ──────────────────────────────────────────────────────────

function getActiveSchools(rings) {
  return rings.map((offset, i) => RING_SCHOOLS[i][(8 - offset) % 8]);
}

function validate(rings) {
  const schools = getActiveSchools(rings);
  const errors = [];

  // Rule B — Flow chain: Divination -> Illusion -> Transmutation -> Abjuration
  // Present chain members must appear in this relative order across rings
  const chain = ['Divination', 'Illusion', 'Transmutation', 'Abjuration'];
  const presentChain = schools
    .map((s, i) => ({ school: s, ring: i }))
    .filter(x => chain.includes(x.school));
  for (let i = 1; i < presentChain.length; i++) {
    const prevIdx = chain.indexOf(presentChain[i - 1].school);
    const currIdx = chain.indexOf(presentChain[i].school);
    if (currIdx <= prevIdx) {
      errors.push('flow_broken');
      break;
    }
  }

  // Rule D — Anchor: outer ring must be Divination ("truth")
  if (schools[0] !== 'Divination') {
    errors.push('anchor_invalid');
  }

  return errors;
}

const HINTS = {
  balance_stabilizer: 'The weave lacks stability \u2014 it needs an anchor.',
  balance_destructive: 'Destructive forces have no place here. Choose protection over power.',
  flow_broken: 'The flow of magic is disrupted. The current does not run true.',
  forbidden_adjacency: 'Death and destruction strain against each other. They must not touch.',
  anchor_invalid: 'The outer ring must hold truth — only sight can begin the weave.',
  opposing_mirror_13: 'The first and third rings echo each other. Symmetry breeds instability.',
  opposing_mirror_24: 'The second and fourth rings mirror too closely.',
};

// ── Test Mode ──────────────────────────────────────────────────────────────────

if (process.argv.includes('--test')) {
  console.log('Running validation tests...\n');

  // Helper: find offset for a school on a given ring
  const findSchool = (ring, school) => RING_SCHOOLS[ring].indexOf(school);

  // Solution should pass
  const solErrors = validate(SOLUTION);
  console.assert(solErrors.length === 0, `Solution should validate, got: ${solErrors}`);
  console.log(`  PASS: Solution [${SOLUTION}] validates => [${SOLUTION.map((o,i) => RING_SCHOOLS[i][o])}]`);

  // All zeros should fail
  const zeroErrors = validate([0, 0, 0, 0]);
  console.assert(zeroErrors.length > 0, 'All zeros should fail');
  console.log(`  PASS: [0,0,0,0] fails with [${zeroErrors}]`);

  // Necromancy + Evocation adjacent: put Necromancy on R1, Evocation on R2
  const necEvo = [findSchool(0, 'Necromancy'), findSchool(1, 'Evocation'), findSchool(2, 'Transmutation'), findSchool(3, 'Divination')];
  const necEvoErrors = validate(necEvo);
  console.assert(necEvoErrors.includes('forbidden_adjacency'), `Should catch forbidden adjacency, got: ${necEvoErrors}`);
  console.log(`  PASS: Necromancy/Evocation adjacency detected`);

  // Bad anchor: put Illusion on outer ring
  const badAnchor = [findSchool(0, 'Illusion'), findSchool(1, 'Divination'), findSchool(2, 'Transmutation'), findSchool(3, 'Evocation')];
  const badAnchorErrors = validate(badAnchor);
  console.assert(badAnchorErrors.includes('anchor_invalid'), `Should catch bad anchor, got: ${badAnchorErrors}`);
  console.log(`  PASS: Bad anchor detected`);

  // Opposing mirror: same category on R1 and R3
  // Put two utilities on R1 and R3
  const mirror = [findSchool(0, 'Conjuration'), findSchool(1, 'Divination'), findSchool(2, 'Divination'), findSchool(3, 'Evocation')];
  const mirrorErrors = validate(mirror);
  console.assert(mirrorErrors.includes('opposing_mirror_13'), `Should catch opposing mirror, got: ${mirrorErrors}`);
  console.log(`  PASS: Opposing mirror detected`);

  console.log('\nAll tests passed.');
  process.exit(0);
}

// ── HTTP Server ────────────────────────────────────────────────────────────────

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
};

const server = http.createServer((req, res) => {
  let url = req.url.split('?')[0];

  // Route / -> dm.html, /play -> player.html
  if (url === '/') url = '/dm.html';
  else if (url === '/play') url = '/player.html';

  const filePath = path.join(__dirname, 'public', url);
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

// ── WebSocket Server ───────────────────────────────────────────────────────────

const wss = new WebSocketServer({ server });
const dmSockets = new Set();

function broadcast(msg, exclude) {
  const data = JSON.stringify(msg);
  for (const [, player] of Object.entries(gameState.players)) {
    if (player.ws && player.ws !== exclude && player.ws.readyState === 1) {
      player.ws.send(data);
    }
  }
}

function broadcastAll(msg) {
  broadcast(msg, null);
}

function pushDmState() {
  const state = getDmState();
  const data = JSON.stringify(state);
  for (const ws of dmSockets) {
    if (ws.readyState === 1) ws.send(data);
  }
}

function sendTo(ws, msg) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(msg));
  }
}

function getStateForClient() {
  return {
    type: 'state',
    rings: gameState.rings,
    phase: gameState.phase,
    players: Object.entries(gameState.players).map(([token, p]) => ({
      role: p.role,
      ringIndex: p.ringIndex,
      connected: p.connected,
    })),
    ringSchools: RING_SCHOOLS,
    categories: CATEGORIES,
    auraColors: AURA_COLORS,
    solution: null, // never sent to players
  };
}

function getDmState() {
  const schools = getActiveSchools(gameState.rings);
  const errors = validate(gameState.rings);
  return {
    type: 'dm_state',
    rings: gameState.rings,
    phase: gameState.phase,
    activeSchools: schools,
    solution: SOLUTION,
    solutionSchools: getActiveSchools(SOLUTION),
    errors,
    attemptCount: gameState.attemptCount,
    players: Object.entries(gameState.players).map(([token, p]) => ({
      token,
      role: p.role,
      roleName: ROLE_NAMES[p.role],
      ringIndex: p.ringIndex,
      connected: p.connected,
    })),
    log: gameState.log.slice(-50),
    channeling: Array.from(channelWindow.presses.keys()),
    schools: SCHOOLS,
    categories: CATEGORIES,
  };
}

function addLog(msg) {
  const ts = new Date().toLocaleTimeString('en-GB', { hour12: false });
  const entry = `${ts} — ${msg}`;
  gameState.log.push(entry);
  // Send log entry to DM sockets
  const data = JSON.stringify({ type: 'log', entry });
  for (const ws of dmSockets) {
    if (ws.readyState === 1) ws.send(data);
  }
}

function getNextRole() {
  const taken = new Set(Object.values(gameState.players).map(p => p.role));
  return ROLES.find(r => !taken.has(r)) || null;
}

function handleChannel(token) {
  if (gameState.phase === 'success') return;

  channelWindow.presses.set(token, Date.now());
  const role = gameState.players[token]?.role;
  addLog(`${ROLE_NAMES[role] || 'Unknown'} channels energy`);

  // Broadcast channeling status
  broadcastAll({
    type: 'channel_status',
    count: channelWindow.presses.size,
    total: Object.keys(gameState.players).length,
    who: Array.from(channelWindow.presses.keys()).map(t => gameState.players[t]?.role),
  });

  if (!channelWindow.active) {
    channelWindow.active = true;
    gameState.phase = 'channeling';
    channelWindow.timer = setTimeout(() => resolveChannel(), 2000);
  }

  // If all connected players have pressed, resolve immediately
  const connectedCount = Object.values(gameState.players).filter(p => p.connected).length;
  if (channelWindow.presses.size >= connectedCount && connectedCount >= 2) {
    clearTimeout(channelWindow.timer);
    resolveChannel();
  }
}

function resolveChannel() {
  channelWindow.active = false;
  channelWindow.timer = null;

  const connectedCount = Object.values(gameState.players).filter(p => p.connected).length;
  const pressCount = channelWindow.presses.size;
  channelWindow.presses.clear();

  if (pressCount < connectedCount) {
    gameState.phase = 'playing';
    gameState.attemptCount++;
    addLog(`Channel failed — only ${pressCount}/${connectedCount} pressed`);
    broadcastAll({
      type: 'channel_result',
      success: false,
      hint: 'The channel was not unified. All must commit together.',
      nearSuccess: false,
    });
    scatterRings();
    pushDmState();
    return;
  }

  // All pressed — validate
  const errors = validate(gameState.rings);
  gameState.attemptCount++;

  if (errors.length === 0) {
    gameState.phase = 'success';
    addLog('THE LOCK OPENS! Puzzle solved!');
    broadcastAll({ type: 'channel_result', success: true, hint: null, nearSuccess: false });
    pushDmState();
    return;
  }

  // Failure — send 1-2 hints
  gameState.phase = 'playing';
  const hintsToSend = errors.slice(0, gameState.attemptCount >= 5 ? 3 : 2);
  const hintTexts = hintsToSend.map(e => HINTS[e]);
  const nearSuccess = errors.length === 1;

  addLog(`Channel attempt #${gameState.attemptCount} failed — ${errors.length} rule(s) broken`);
  broadcastAll({
    type: 'channel_result',
    success: false,
    hints: hintTexts,
    nearSuccess,
    errorCount: errors.length,
  });

  scatterRings();
  pushDmState();
}

function scatterRings() {
  setTimeout(() => {
    for (let r = 0; r < 4; r++) {
      gameState.rings[r] = Math.floor(Math.random() * 8);
    }
    addLog('The Weave convulses — the rings scatter');
    broadcastAll({ type: 'ring_update', rings: gameState.rings });
    pushDmState();
  }, 1500);
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const isDm = url.searchParams.get('dm') === '1';
  let token = url.searchParams.get('token');

  if (isDm) {
    ws._isDm = true;
    dmSockets.add(ws);
    sendTo(ws, getDmState());
    addLog('DM connected');

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }
      handleDmMessage(ws, msg);
    });

    ws.on('close', () => {
      dmSockets.delete(ws);
      addLog('DM disconnected');
    });
    return;
  }

  // Player connection
  if (token && gameState.players[token]) {
    // Reconnection — clear disconnect timer
    const existing = gameState.players[token];
    if (existing.disconnectTimer) clearTimeout(existing.disconnectTimer);
    existing.ws = ws;
    existing.connected = true;
    ws._token = token;
    addLog(`${ROLE_NAMES[existing.role]} reconnected`);
  } else {
    // New player
    const role = getNextRole();
    if (!role) {
      sendTo(ws, { type: 'error', message: 'All roles are taken. Please wait.' });
      ws.close();
      return;
    }
    token = crypto.randomUUID();
    const ringIndex = ROLES.indexOf(role);
    gameState.players[token] = { ws, role, ringIndex, connected: true };
    ws._token = token;

    if (gameState.phase === 'waiting' && Object.keys(gameState.players).length >= 1) {
      gameState.phase = 'playing';
    }

    addLog(`${ROLE_NAMES[role]} joined (Ring ${ringIndex + 1})`);
  }

  // Send role assignment + state
  const player = gameState.players[token];
  sendTo(ws, {
    type: 'assigned',
    token,
    role: player.role,
    roleName: ROLE_NAMES[player.role],
    ringIndex: player.ringIndex,
  });
  sendTo(ws, getStateForClient());

  // Notify everyone of updated state
  broadcastAll({ type: 'player_update', ...getStateForClient() });
  pushDmState();

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    const playerToken = ws._token;
    if (!playerToken || !gameState.players[playerToken]) return;

    switch (msg.type) {
      case 'rotate': {
        const p = gameState.players[playerToken];
        const dir = msg.direction === 'left' ? -1 : 1;
        gameState.rings[p.ringIndex] = ((gameState.rings[p.ringIndex] + dir) % 8 + 8) % 8;
        addLog(`${ROLE_NAMES[p.role]} rotated Ring ${p.ringIndex + 1} to position ${gameState.rings[p.ringIndex]}`);

        // Warden's curse: rotating their ring also spins 1-3 other rings
        if (p.role === 'warden') {
          const otherRings = [0, 1, 2, 3].filter(r => r !== p.ringIndex);
          const numToSpin = 1 + Math.floor(Math.random() * 3); // 1, 2, or 3 rings
          const shuffled = otherRings.sort(() => Math.random() - 0.5);
          for (let i = 0; i < numToSpin; i++) {
            const r = shuffled[i];
            const moves = Math.floor(Math.random() * 3) + 1; // 1-3 moves
            const rdir = Math.random() < 0.5 ? 1 : -1;
            gameState.rings[r] = ((gameState.rings[r] + moves * rdir) % 8 + 8) % 8;
            addLog(`Warden's energy disturbed Ring ${r + 1}`);
          }
        }

        broadcastAll({ type: 'ring_update', rings: gameState.rings });
        pushDmState();
        break;
      }
      case 'channel': {
        handleChannel(playerToken);
        break;
      }
    }
  });

  ws.on('close', () => {
    const playerToken = ws._token;
    if (playerToken && gameState.players[playerToken]) {
      const player = gameState.players[playerToken];
      player.connected = false;
      player.ws = null;
      addLog(`${ROLE_NAMES[player.role]} disconnected`);

      // Free the slot after 30s if they don't reconnect
      player.disconnectTimer = setTimeout(() => {
        if (gameState.players[playerToken] && !gameState.players[playerToken].connected) {
          addLog(`${ROLE_NAMES[player.role]} slot freed`);
          delete gameState.players[playerToken];
          broadcastAll({ type: 'player_update', ...getStateForClient() });
          pushDmState();
        }
      }, 3000);

      broadcastAll({ type: 'player_update', ...getStateForClient() });
      pushDmState();
    }
  });
});

function handleDmMessage(ws, msg) {
  switch (msg.type) {
    case 'dm_reset':
      gameState.rings = [0, 0, 0, 0];
      gameState.phase = Object.keys(gameState.players).length > 0 ? 'playing' : 'waiting';
      gameState.attemptCount = 0;
      channelWindow.presses.clear();
      if (channelWindow.timer) clearTimeout(channelWindow.timer);
      channelWindow.active = false;
      addLog('DM reset the puzzle');
      broadcastAll({ type: 'ring_update', rings: gameState.rings });
      broadcastAll({ type: 'phase_update', phase: gameState.phase });
      break;

    case 'dm_hint':
      if (msg.hint) {
        addLog(`DM sent hint: "${msg.hint}"`);
        broadcastAll({ type: 'dm_hint', hint: msg.hint });
      }
      break;

    case 'dm_force_success':
      gameState.phase = 'success';
      gameState.rings = [...SOLUTION];
      addLog('DM forced success');
      broadcastAll({ type: 'ring_update', rings: gameState.rings });
      broadcastAll({ type: 'channel_result', success: true, hint: null, nearSuccess: false });
      break;

    case 'dm_kick': {
      const target = Object.entries(gameState.players).find(([, p]) => p.role === msg.role);
      if (target) {
        const [kickToken, kickPlayer] = target;
        if (kickPlayer.ws) kickPlayer.ws.close();
        delete gameState.players[kickToken];
        addLog(`DM kicked ${ROLE_NAMES[msg.role]}`);
        broadcastAll({ type: 'player_update', ...getStateForClient() });
      }
      break;
    }
  }

  // Always send updated DM state after any DM action
  sendTo(ws, getDmState());
}

// ── Start Server ───────────────────────────────────────────────────────────────

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const info of iface) {
      if (info.family === 'IPv4' && !info.internal) {
        return info.address;
      }
    }
  }
  return 'localhost';
}

server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log(`\n  Weave Imbalance Lock\n`);
  console.log(`  DM Console:  http://localhost:${PORT}`);
  console.log(`  Player URL:  http://${ip}:${PORT}/play\n`);
});

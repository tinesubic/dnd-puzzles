// ── Ring Renderer ────────────────────────────────────────────────────────────
// Each label is positioned via: rotate(A) translate(R) rotate(-A)
// This moves the label along a circular path while keeping it upright.
// CSS transitions on `transform` interpolate all three functions in sync.

// School rune sprite: 4x2 grid (1920x960), each cell 480x480
// Background-position as percentages: col/(cols-1)*100, row/(rows-1)*100
const SCHOOL_RUNE_POS = {
  Transmutation: '0% 0%',       // col 0, row 0
  Necromancy:    '33.33% 0%',   // col 1, row 0
  Illusion:      '66.67% 0%',   // col 2, row 0
  Evocation:     '100% 0%',     // col 3, row 0
  Enchantment:   '0% 100%',     // col 0, row 1
  Divination:    '33.33% 100%', // col 1, row 1
  Conjuration:   '66.67% 100%', // col 2, row 1
  Abjuration:    '100% 100%',   // col 3, row 1
};

const Rings = (() => {
  const RING_SIZES = [1.05, 0.81, 0.57, 0.33];
  const LABEL_RADIUS_FRACTIONS = [0.43, 0.43, 0.43, 0.38];
  const NUM_POSITIONS = 8;
  const DEG_PER_POS = 360 / NUM_POSITIONS; // 45

  let viewport = null;
  let vpSize = 0;
  let ringElements = [];
  let labelElements = [[], [], [], []];

  let showOtherRings = false;

  // Track cumulative rotation per ring to avoid shortest-path jumps
  let cumulativeOffsets = [0, 0, 0, 0];
  let prevOffsets = [0, 0, 0, 0];

  // Touch state
  let ownRingIndex = -1;
  let touchActive = false;
  let touchStartAngle = 0;
  let accumulatedAngle = 0;
  let onRotate = null;

  function init(containerId) {
    viewport = document.getElementById(containerId);
    viewport.innerHTML = '';
    ringElements = [];
    labelElements = [[], [], [], []];
    cumulativeOffsets = [0, 0, 0, 0];
    prevOffsets = [0, 0, 0, 0];
    vpSize = viewport.offsetWidth || 300;

    // Top marker
    const marker = document.createElement('div');
    marker.className = 'top-marker';
    viewport.appendChild(marker);

    // Create 4 rings
    for (let r = 0; r < 4; r++) {
      const ring = document.createElement('div');
      ring.className = `ring ring-${r}`;
      ring.dataset.ring = r;
      viewport.appendChild(ring);
      ringElements[r] = ring;

      const radius = vpSize * RING_SIZES[r] * LABEL_RADIUS_FRACTIONS[r];

      for (let p = 0; p < NUM_POSITIONS; p++) {
        const label = document.createElement('div');
        label.className = 'ring-label';
        // Position at center; transform moves it out
        label.style.position = 'absolute';
        label.style.left = '50%';
        label.style.top = '50%';
        label.dataset.ring = r;
        label.dataset.pos = p;
        label.dataset.radius = radius;

        // Initial position: angle = p * 45 - 90 (so pos 0 is at top)
        const angleDeg = p * DEG_PER_POS - 90;
        label.style.transform =
          `rotate(${angleDeg}deg) translate(${radius}px) rotate(${-angleDeg}deg) translate(-50%, -50%)`;

        viewport.appendChild(label);
        labelElements[r][p] = label;
      }
    }

    setupTouchHandlers();
  }

  // ── Touch Rotation ──────────────────────────────────────────────────────────

  function getAngleFromCenter(clientX, clientY) {
    const rect = viewport.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
  }

  function normalizeAngleDelta(delta) {
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    return delta;
  }

  function handleTouchStart(clientX, clientY) {
    if (ownRingIndex < 0) return;
    touchActive = true;
    touchStartAngle = getAngleFromCenter(clientX, clientY);
    accumulatedAngle = 0;
  }

  function handleTouchMove(clientX, clientY) {
    if (!touchActive) return;
    const currentAngle = getAngleFromCenter(clientX, clientY);
    let delta = normalizeAngleDelta(currentAngle - touchStartAngle);
    accumulatedAngle += delta;
    touchStartAngle = currentAngle;

    while (accumulatedAngle >= DEG_PER_POS) {
      accumulatedAngle -= DEG_PER_POS;
      if (onRotate) onRotate('right');
    }
    while (accumulatedAngle <= -DEG_PER_POS) {
      accumulatedAngle += DEG_PER_POS;
      if (onRotate) onRotate('left');
    }
  }

  function handleTouchEnd() {
    touchActive = false;
    accumulatedAngle = 0;
  }

  function setupTouchHandlers() {
    viewport.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      handleTouchStart(t.clientX, t.clientY);
    }, { passive: false });

    viewport.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      handleTouchMove(t.clientX, t.clientY);
    }, { passive: false });

    viewport.addEventListener('touchend', () => handleTouchEnd());
    viewport.addEventListener('touchcancel', () => handleTouchEnd());

    viewport.addEventListener('mousedown', (e) => {
      handleTouchStart(e.clientX, e.clientY);
    });
    window.addEventListener('mousemove', (e) => {
      handleTouchMove(e.clientX, e.clientY);
    });
    window.addEventListener('mouseup', () => handleTouchEnd());
  }

  // ── Rendering ───────────────────────────────────────────────────────────────

  function update(rings, role, ringSchools, auraColors, categories) {
    for (let r = 0; r < 4; r++) {
      const offset = rings[r];

      // Track cumulative rotation for smooth animation (no jumps)
      let delta = offset - prevOffsets[r];
      // Normalize delta to [-4, 3] for shortest path (8 positions)
      while (delta > 4) delta -= 8;
      while (delta < -4) delta += 8;
      cumulativeOffsets[r] += delta;
      prevOffsets[r] = offset;

      const rotationDeg = cumulativeOffsets[r] * DEG_PER_POS;
      const radius = parseFloat(labelElements[r][0]?.dataset.radius || 0);

      for (let p = 0; p < NUM_POSITIONS; p++) {
        const label = labelElements[r][p];
        if (!label) continue;

        // Base angle for this position + cumulative rotation
        const angleDeg = p * DEG_PER_POS - 90 + rotationDeg;

        label.style.transform =
          `rotate(${angleDeg}deg) translate(${radius}px) rotate(${-angleDeg}deg) translate(-50%, -50%)`;

        // Label content: position p shows this ring's school at index p
        const school = ringSchools[r][p];
        const topPos = ((NUM_POSITIONS - offset) % NUM_POSITIONS);
        const isTop = (p === topPos);

        label.className = 'ring-label';

        const bgPos = SCHOOL_RUNE_POS[school];
        const runeDiv = `<div class="rune-icon" style="background-position: ${bgPos}"></div>`;

        const canSeeAllRings = (role === 'seer');

        if (r === ownRingIndex || canSeeAllRings) {
          // Own ring (all roles) or all rings (seer): see runes
          label.innerHTML = runeDiv;
          label.classList.add('glyph');
          if (isTop) label.classList.add('active-label');
          if (role === 'arcanist') label.title = school;
          if (role === 'distorted') {
            const aura = auraColors[school];
            if (aura) label.classList.add('aura-' + aura);
          }
        } else if (isTop && showOtherRings) {
          // Other rings: reveal selected glyph when channeling
          label.innerHTML = runeDiv;
          label.classList.add('glyph', 'revealed', 'active-label');
        } else {
          // Other rings: hidden
          label.innerHTML = '';
          label.classList.add('hidden-label');
        }
      }
    }
  }

  function setOwnRing(ringIndex) {
    ownRingIndex = ringIndex;
    ringElements.forEach((el, i) => {
      el.classList.toggle('own-ring', i === ringIndex);
      el.classList.toggle('own-ring-inner', i === ringIndex + 1);
    });
  }

  function setOnRotate(callback) {
    onRotate = callback;
  }

  function setShowOtherRings(show) {
    showOtherRings = show;
  }

  function getActiveSchool(ringIndex, rings, ringSchools) {
    const offset = rings[ringIndex];
    const topPos = ((NUM_POSITIONS - offset) % NUM_POSITIONS);
    return ringSchools[ringIndex][topPos];
  }

  function resize() {
    if (!viewport) return;
    init(viewport.id);
  }

  return { init, update, setOwnRing, setOnRotate, setShowOtherRings, getActiveSchool, resize };
})();

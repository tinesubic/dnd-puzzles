// ── Role-Specific View Logic ─────────────────────────────────────────────────
// Each role has a different info panel and may modify the ring display.

const Roles = (() => {

  const ROLE_DESCRIPTIONS = {
    arcanist: 'You see the true names of magic. Trust your eyes \u2014 but you alone cannot solve this.',
    distorted: 'The Weave distorts your vision. Faint auras hint at the nature of each rune, but the names are hidden from you.',
    seer: 'You perceive the magic permeating the rings. The names are hidden, but your awareness is limitless.',
    warden: 'You bind the Weave, but it answers in kind — each turn of your ring sends ripples through the others, shifting their alignment.',
  };

  // Seer constraint hints
  const SEER_CONSTRAINTS = [
    { text: 'The chain of sight leads to change leads to force.', type: 'flow' },
    { text: 'Death and destruction repel each other \u2014 they must never touch.', type: 'block' },
    { text: 'What mirrors itself across the weave breeds chaos.', type: 'symmetry' },
    { text: 'The outer ring must anchor the weave \u2014 only shields and gates hold.', type: 'anchor' },
  ];

  // Warden rules
  const WARDEN_RULES = [
    'The weave demands exactly one anchor of stability.',
    'Destructive forces must not dominate \u2014 no more than one.',
    'The outer ring must ground the weave \u2014 only shields and gates may hold it.',
    'What faces each other must not be alike in nature.',
  ];

  let shimmerInterval = null;

  function renderInfo(role, container) {
    container.innerHTML = '';

    // Role description
    const desc = document.createElement('div');
    desc.className = 'rule-card';
    desc.style.borderColor = 'rgba(155, 93, 229, 0.4)';
    desc.textContent = ROLE_DESCRIPTIONS[role] || '';
    container.appendChild(desc);

    if (role === 'warden') {
      const hint = document.createElement('div');
      hint.className = 'rule-card constraint-hint';
      hint.style.borderColor = 'rgba(212, 168, 67, 0.4)';
      hint.textContent = 'The Weave broke when truth saw madness, sight became change, and the final hand chose protection over power.';
      container.appendChild(hint);
    }
  }

  function applyTheme(role) {
    document.body.classList.remove('distorted-theme');
    if (role === 'distorted') {
      document.body.classList.add('distorted-theme');
    }
  }

  function startGlitch() {
    if (shimmerInterval) clearInterval(shimmerInterval);

    function applyGlitch() {
      // Restore previously glitched icons
      document.querySelectorAll('.glitch-rune').forEach(el => {
        el.classList.remove('glitch-rune');
        el.style.backgroundImage = '';
      });

      const icons = document.querySelectorAll('.ring-label.glyph .rune-icon');
      if (icons.length === 0) return;

      // Pick 3 random glyphs (or fewer if not enough)
      const indices = [];
      const count = Math.min(6, icons.length);
      while (indices.length < count) {
        const idx = Math.floor(Math.random() * icons.length);
        if (!indices.includes(idx)) indices.push(idx);
      }

      indices.forEach(idx => {
        const icon = icons[idx];
        icon.classList.add('glitch-rune');
        icon.style.backgroundImage = "url('/img/crystal.svg')";
      });
    }

    applyGlitch();
    shimmerInterval = setInterval(applyGlitch, 800);
  }

  function stopShimmer() {
    if (shimmerInterval) {
      clearInterval(shimmerInterval);
      shimmerInterval = null;
    }
  }

  return { renderInfo, applyTheme, startGlitch, stopShimmer };
})();

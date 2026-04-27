# Weave Imbalance Lock

A real-time multiplayer DnD puzzle for 4 players, themed around the fractured Weave and arcane delirium. Players must align 4 concentric rings of magic schools and channel simultaneously to break the magical lock.

Designed as a one-shot puzzle prop — the DM hosts the server on a laptop, and players join via their phones over local WiFi.

## Running

Requires Node.js.

```bash
npm install
node server.js
```

The server prints two URLs (using your machine's LAN IP):
- **DM Console:** `http://<local-ip>:3000/console` (open on the host laptop)
- **Player URL:** `http://<local-ip>:3000/play` or just `http://<local-ip>:3000` (share with players on the same WiFi)

The DM console shows a QR code for the player URL — players can scan it with their phones to join.

## The Puzzle

The lock is a fragment of the fractured Weave. It manifests as **4 concentric rings**, each marked with the **8 schools of magic** (Abjuration, Conjuration, Divination, Enchantment, Evocation, Illusion, Necromancy, Transmutation). The schools appear on each ring in a *different random order*, so players cannot rely on memorized positions.

Each ring rotates independently. The "selected" school on each ring is the one at the **top position** (12 o'clock). To break the lock, the four selected schools across the rings must satisfy the hidden arcane laws — and all four players must commit simultaneously by pressing **Channel** within a ~2 second window.

But no single player can solve it alone: each one perceives the Weave through a different fracture, and only by combining their fragmented truths can they align the rings.

### The Four Roles

#### 🜂 The Arcanist — *Truth*
> *"You see the true names of magic. Trust your eyes — but you alone cannot solve this."*

The Arcanist controls the **outer ring** and is the only player who can read the school name labels — but only on their own ring. They see the rune for the currently selected school appear in a purple pill above the Channel button, telling them exactly which school they're aligned to.

The Arcanist is the **translator**. They communicate verbally with the others to identify which glyphs match which schools, since the others see only runes.

#### 🜄 The Distorted Mind — *Corruption*
> *"The Weave distorts your vision."*

The Distorted Mind controls the **second ring**. Their reality is unstable: every 5 seconds, **4 random glyphs on their ring are replaced by glitching crystals**, hiding the runes underneath. They must wait for the corruption to shift before they can see what's actually on their ring.

This player must be patient and call out glyphs as they come into focus, often guessing at what's hidden.

#### 🜁 The Seer — *Awareness*
> *"You perceive the magic permeating the rings. The names are hidden, but your awareness is limitless."*

The Seer controls the **third ring** but sees **every glyph on every ring**. They are the only player with full visibility of the puzzle's current state. The names of the schools are still hidden — they must rely on the Arcanist's translations to know what each glyph means.

The Seer's role is **strategic coordination**: cross-referencing what the Arcanist describes with what they can see across all rings.

#### 🜃 The Warden — *Binding*
> *"You bind the Weave, but it answers in kind — each turn of your ring sends ripples through the others, shifting their alignment."*

The Warden controls the **inner ring**. Their power is also their curse: every time they rotate their ring by one position, **1, 2, or 3 other rings are randomly shifted by 1–3 positions** in random directions.

The Warden is also the keeper of a cryptic riddle that hints at the solution:
> *"The Weave broke when truth saw madness, sight became change, and the final hand chose protection over power."*

This forces the Warden to act last and be careful — every adjustment risks unraveling the others' work.

### Interaction

- **Rotate** by dragging on the ring area (or using mouse drag on desktop). Each 45° rotation advances one position.
- **Other players' rings** are hidden — you only see a faint purple selection marker at their top position. The actual glyphs are revealed briefly only while channeling.
- **Press Channel** when you believe the lock is aligned. All four players must press within ~2 seconds.
- **Failure** scatters all rings to random positions, accompanied by a glass-cracking sound, screen shake, and a partial hint about which rule was broken.
- **Success** locks the rings in golden light. The Weave is restored.

### The Hidden Laws (Validation Rules)

The four selected schools (one per ring, outer → inner) must satisfy:

| Rule | Constraint |
|------|------------|
| **Anchor** | The outer ring must be **Divination** (truth) |
| **Flow Chain** | Divination → Illusion → Transmutation → Abjuration must appear in this relative order across the rings |

The hardcoded solution: **Divination · Illusion · Transmutation · Abjuration** (outer → inner).

This decodes the Warden's riddle:
- *"truth"* = Divination (R1)
- *"madness"* = Illusion (R2)
- *"change"* = Transmutation (R3)
- *"protection over power"* = Abjuration over Evocation (R4)

The categories of each school (kept for reference / lore):
- **Stabilizer:** Abjuration, Transmutation
- **Destructive:** Evocation, Necromancy
- **Mental:** Enchantment, Illusion
- **Utility:** Conjuration, Divination

### Failure Hints

When validation fails, the server reveals 1–2 partial hints (never all rule violations at once). After 5+ failed attempts, an extra hint is included. Example hints:

- *"The flow of magic is disrupted. The current does not run true."*
- *"The outer ring must hold truth — only sight can begin the weave."*

If only one rule is broken, all rings glow gold — the players are close.

## DM Console

At `http://<local-ip>:3000/console`. The laptop browser shows:
- **QR code + URL** for players to join
- **Player connection status** (which roles are filled)
- **Live ring state** with truth labels and correct/incorrect indicators
- **Manual hint sender** — typed hints appear as a purple pill above the players' Channel button
- **Reset / Force Success** buttons (safety net if players are stuck)
- **Activity log** of all rotations and channel attempts

## Tech Stack

- Node.js + `ws` (WebSockets) — single dependency
- Vanilla HTML/CSS/JS — no build step, no framework
- Works offline on any local WiFi

## Project Structure

```
server.js                Game state, validation, WebSocket sync
public/
  player.html            Player view (served at / and /play)
  dm.html                DM console (served at /console)
  css/styles.css         Rings, animations, delirium theme
  js/
    rings.js             Ring rendering and touch rotation
    roles.js             Role-specific view logic
    client.js            WebSocket client, audio, UI
    qrcode.min.js        QR code generator for DM console
  img/
    schools.svg          Magic school runes (sprite sheet)
    crystal.svg          Glitch effect for Distorted Mind
  audio/
    glass-crack.mp3      Failure sound
```

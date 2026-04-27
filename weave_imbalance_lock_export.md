# Weave Imbalance Lock Puzzle – Conversation Export

## User Request
Design a DnD 5e magical lock puzzle based on schools of magic requiring 4 simultaneous participants.

---

## Final Concept: Weave Imbalance Lock

### Core Idea
A fractured Weave requiring 4 players with asymmetric information to align magical rings and activate simultaneously.

---

## Roles

### 1. Arcanist (Truth)
- Sees real schools of magic
- No knowledge of rules

### 2. Distorted Mind (Corruption)
- Sees incorrect / shifting labels
- Introduces uncertainty

### 3. Seer (Relationships)
- Sees constraints between rings (flow, block, adjacency)

### 4. Warden (Rules)
- Sees global constraints:
  - Balance rules
  - Forbidden combinations

---

## Mechanics

- 4 concentric rings
- Each player controls one ring
- Each ring has 8 schools:
  Abjuration, Evocation, Illusion, Necromancy, Transmutation, Conjuration, Divination, Enchantment

---

## Example Rules

- Exactly 1 stabilizer (Abjuration, Transmutation)
- Max 1 destructive (Evocation, Necromancy)
- Necromancy cannot touch Evocation
- Must form valid flow chain
- Outer ring must anchor (Abjuration or Conjuration)

---

## Interaction

1. Players rotate rings
2. Communicate partial information
3. All press “Channel” within ~1–1.5 seconds
4. System validates configuration

---

## Feedback

- Partial hints only:
  - “Weave destabilizes near outer ring”
  - “Too much destructive energy”

- Failure:
  - Visual distortion
  - Optional DnD effects (psychic damage, madness)

---

## Implementation Notes

- Frontend: HTML + JS
- Sync: WebSockets or local testing via shared state
- Rotation via CSS transforms
- State validation function checks:
  - Rule validity
  - Timing window

---

## Deliverables Created

- Full puzzle design
- UI wireframes
- Single-file HTML prototype (in conversation)

---

## Recommended Usage

Best for:
- High-coordination party moments
- Roleplay-heavy groups
- Drakkenheim / delirium-themed campaigns

---

End of export.


Weave Imbalance Lock — Detailed Design
Core Fantasy

The lock is a fragment of the Weave, fractured by delirium. Each character perceives a different truth about magic. Only by reconciling these truths can they stabilize the lock.

1) System Overview
Components
4 concentric rings → each controlled by 1 player
Each ring has 8 positions (schools of magic)
Each player sees a different representation layer
Goal

Align all 4 rings so that:

The configuration satisfies hidden arcane rules
All 4 players commit simultaneously
2) Schools of Magic (Canonical Set)

Use standard 5e schools:

Abjuration (stability)
Evocation (raw power)
Illusion (deception)
Necromancy (decay)
Transmutation (change)
Conjuration (summoning)
Divination (knowledge)
Enchantment (control)
3) Player Information Asymmetry

Each player gets a different UI + rule visibility.

Player A — The Arcanist (Truth Layer)

Sees:

Actual schools on rings

Does NOT see:

Any rules

Role:

Provides ground truth positions
Player B — The Distorted Mind (Corruption Layer)

Sees:

Wrong labels (e.g. Illusion shown as Evocation)
1–2 glyphs are mutating slowly

Hidden mechanic:

Their mapping is partially wrong

Role:

Forces verification and doubt
Player C — The Seer (Relationship Layer)

Sees:

Lines/arrows between rings:
→ means “must flow into”
⛔ means “cannot touch”
⇄ means “must be adjacent”

Example:

Divination → Enchantment
Necromancy ⛔ Evocation

Role:

Defines structural constraints
Player D — The Warden (Constraint Layer)

Sees:

Global rules like:
“Exactly one stabilizer must be present”
“No more than one destructive school”
“Outer ring must anchor the weave”

Role:

Enforces system-level validity
4) Core Rule Engine (Hidden Logic)

You need a deterministic validation function.

Step 1 — Categorize Schools
Stabilizers:
- Abjuration, Transmutation

Destructive:
- Evocation, Necromancy

Mental:
- Enchantment, Illusion

Utility:
- Divination, Conjuration
Step 2 — Example Valid Configuration Rules

Use 4–6 rules total:

Rule A — Balance Constraint
Exactly 1 stabilizer
At most 1 destructive
Rule B — Flow Constraint
Must form a valid chain
Divination → Enchantment → Transmutation → Evocation

(Interpretation: adjacent rings must follow this order cyclically)

Rule C — Forbidden Adjacency
Necromancy cannot touch Evocation
Rule D — Anchor Rule
Outer ring must be:
Abjuration OR Conjuration
Rule E — Symmetry Rule
Opposing rings must NOT be same category
5) Interaction Model (Web Implementation)
Ring Controls
Each player:
Rotates their ring
Presses “Channel” (hold or toggle)
Lock Resolution

System checks:

isValidConfiguration(rings) &&
max(timestamp) - min(timestamp) < 1500ms
6) Feedback System (Critical for UX)
On Invalid Attempt

Return partial feedback only:

“The weave destabilizes near the outer ring”
“Too much destructive energy”
“Flow collapses between rings II and III”

Avoid giving exact answers.

On Near Success
Rings glow faintly
Subtle audio cue
On Failure (Delirium Flavor)
Glyphs scramble briefly
One player’s UI becomes temporarily more corrupted

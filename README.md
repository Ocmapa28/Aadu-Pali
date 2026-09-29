# Aadu Puli Aatam (ஆடு புலி ஆட்டம்) - Standalone Web Edition

A standalone, zero-dependency HTML5 / Canvas / Web Audio API edition of the ancient Indian traditional hunt strategy board game **Aadu Puli Aatam** (3 Tigers vs 15 Goats).

---

## 🌟 Key Features

1. **Faithful 23-Node Board Topology**:
   - 23 nodes with 25 straight-line corridors and collinear leap paths.
   - 3 Tigers (`◆` Haldi Gold) and 15 Goats (`○` Polished Ivory).
2. **Complete Game Rules Engine**:
   - Goat Placement Phase (15 goats placed from hand onto empty nodes).
   - Movement Phase (goats step 1 space to adjacent empty nodes).
   - Tiger Normal Moves & Collinear Leap Captures.
   - Dual Victory Conditions: Tiger capture quota (5 goats) vs Goat total immobilization trap.
3. **4 Game Modes**:
   - **Local 2 Player**: Pass & Play on desktop or mobile.
   - **Play as Goats vs AI Tigers**.
   - **Play as Tigers vs AI Goats**.
   - **AI vs AI**: Automated spectator / demo mode.
4. **3 AI Difficulty Levels**:
   - **Easy**: Baseline heuristic legal-move engine prioritizing immediate capture opportunities.
   - **Medium**: Negamax + Alpha-Beta pruning search ($d = 2$).
   - **Hard**: Deep Negamax + Alpha-Beta pruning search ($d = 4$).
5. **Interactive 7-Step Tutorial**:
   - Full interactive tutorial explaining game objectives, board setup, goat placement, tiger leap captures, movement phase, win conditions, and capture walkthrough.
6. **Web Audio API Procedural Sound**:
   - Procedural synth engine with meditative Indian ambient drone chords ($D_3 / A_3 / D_4$), stone placement thuds, wooden tiger steps, capture bell resonance, error buzz, and victory arpeggios.
   - Master, Music, and SFX volume sliders with independent mute toggles.
7. **Responsive High-DPI Canvas**:
   - Crisp rendering on retina and 4K displays.
   - Responsive layout adapting to portrait, landscape, desktop, tablet, and mobile screens.
   - Pointer events supporting mouse, touch, and stylus with anti-debounce and UI hit guards.

---

## 🚀 How to Run Locally

### Option 1: Open Directly in Browser
Since this is a client-side vanilla web app with ES6 modules, you can serve it with any local static HTTP server:

```bash
# Using Python (built-in)
cd web
python -m http.server 8080
# Open http://localhost:8080 in your browser
```

```bash
# Using Node.js / npx
cd web
npx serve .
```

```bash
# Using VSCode Live Server extension
# Right-click web/index.html -> "Open with Live Server"
```

---

## 🧪 Running Automated Unit Tests

Run the headless unit test suite using Node.js:

```bash
node web/test/run-tests.js
```

Test coverage includes:
- 23-node graph topology and collinear jump lookups.
- Initial match setup and goat hand counters.
- Goat placement rules and illegal move rejections.
- Tiger single step and collinear capture leaps.
- Phase transition from Placement to Movement.
- Win condition by 5 goat captures.
- Win condition by trapping all 3 tigers.
- Static position evaluator ($+10000 / -10000$).
- AI move selection across Easy, Medium ($d=2$), and Hard ($d=4$) tiers.
- Tutorial step state progression.

---

## 🌐 How to Deploy to Production

This project requires **zero backend servers** and can be deployed directly to any static web host:

### GitHub Pages
1. Push the repository to GitHub.
2. In repository **Settings** $\to$ **Pages**, set source to `web/` folder on branch `main`.

### Netlify
1. Drag and drop the `web/` folder into the Netlify Dashboard, or link your git repo with publish directory set to `web`.

### Vercel
1. Run `npx vercel` from the `web` directory, or set root directory to `web` in the Vercel dashboard.

---

## 📁 Project Architecture

```
web/
├── index.html                 # Semantic HTML5 layout & modal dialogs
├── README.md                  # Documentation & deployment guide
├── package.json               # Node metadata & test runner script
├── css/
│   └── styles.css             # Design tokens & responsive styles
├── src/
│   ├── core/
│   │   ├── enums.js           # Enums (PlayerSide, GamePhase, GameResult, etc.)
│   │   ├── board-graph.js     # 23-node graph & jump lookups
│   │   ├── move.js            # Move representation & factories
│   │   ├── game-state.js      # Game state, rules & validation
│   │   ├── evaluator.js       # Static position evaluator
│   │   ├── ai.js              # Baseline & Alpha-Beta Negamax AI
│   │   ├── match-session.js   # Match lifecycle & AI configuration
│   │   └── tutorial-session.js# 7-step interactive tutorial content
│   ├── audio/
│   │   └── audio-service.js   # Web Audio API procedural synthesizer
│   ├── render/
│   │   └── board-renderer.js  # High-DPI Canvas 2D board renderer
│   ├── ui/
│   │   └── ui-manager.js      # HUD, screen routing & modals
│   └── main.js                # Main application orchestrator
└── test/
    └── run-tests.js           # Automated test suite
```

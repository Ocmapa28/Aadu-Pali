import fs from 'fs';
import path from 'path';
import { PieceType, PlayerSide, GamePhase, GameResult, AIDifficulty, MatchMode } from '../src/core/enums.js';
import { BoardGraph } from '../src/core/board-graph.js';
import { Move } from '../src/core/move.js';
import { HuntGameState } from '../src/core/game-state.js';
import { HuntAIFactory } from '../src/core/ai.js';
import { HuntMatchSession } from '../src/core/match-session.js';
import { HuntTutorialSession } from '../src/core/tutorial-session.js';

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition, message) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failedAssertions++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

console.log('====================================================');
console.log('  AADU PULI AATAM - FINAL RELEASE VALIDATION SUITE');
console.log('====================================================\n');

// 1. Static Asset Integrity Checks
console.log('[1/6] Verifying Static Distribution Assets & Files...');
const requiredFiles = [
  'web/index.html',
  'web/favicon.svg',
  'web/manifest.json',
  'web/package.json',
  'web/README.md',
  'web/vercel.json',
  'web/netlify.toml',
  'web/css/styles.css',
  'web/assets/pieces/tiger-piece.png',
  'web/assets/pieces/goat-piece.png',
  'web/src/main.js',
  'web/src/render/board-renderer.js',
  'web/src/audio/audio-service.js',
  'web/src/ui/ui-manager.js',
  'web/src/core/board-graph.js',
  'web/src/core/game-state.js',
  'web/src/core/ai.js',
  'web/src/core/match-session.js',
  'web/src/core/tutorial-session.js'
];

for (const f of requiredFiles) {
  const exists = fs.existsSync(path.resolve(f));
  assert(exists, `Required release asset exists: ${f}`);
}

// 2. Tutorial Session Traversal
console.log('\n[2/6] Verifying 7-Step Tutorial Progression...');
const tut = new HuntTutorialSession();
assert(tut.steps.length === 7, 'Tutorial contains exactly 7 steps');
for (let i = 0; i < 7; i++) {
  assert(tut.currentStepIndex === i, `At step index ${i} (${tut.currentStep.title})`);
  assert(tut.currentStep.previewState instanceof HuntGameState, `Step ${i + 1} has valid preview HuntGameState`);
  if (i < 6) tut.next();
}
assert(!tut.hasNext, 'Cannot advance past step 7');
tut.previous();
assert(tut.currentStepIndex === 5, 'Previous goes back to step 6');
tut.reset();
assert(tut.currentStepIndex === 0, 'Reset returns to step 1');

// 3. Testing All 4 Game Modes
console.log('\n[3/6] Testing All 4 Game Modes...');
const modes = [
  { mode: MatchMode.LocalPvP, name: 'Local 2 Player', tigerAI: false, goatAI: false },
  { mode: MatchMode.PlayerGoatsVsAiTigers, name: 'Player Goats vs AI Tigers', tigerAI: true, goatAI: false },
  { mode: MatchMode.PlayerTigersVsAiGoats, name: 'Player Tigers vs AI Goats', tigerAI: false, goatAI: true },
  { mode: MatchMode.AiVsAi, name: 'AI vs AI Spectator', tigerAI: true, goatAI: true }
];

for (const m of modes) {
  const session = new HuntMatchSession();
  session.startMatchWithMode(m.mode, AIDifficulty.Medium);
  assert(session.isTigerAI === m.tigerAI, `${m.name}: isTigerAI is ${m.tigerAI}`);
  assert(session.isGoatAI === m.goatAI, `${m.name}: isGoatAI is ${m.goatAI}`);
  assert(session.state.unplacedGoats === 15, `${m.name}: 15 unplaced goats at start`);
  assert(session.state.getTigerPositions().length === 3, `${m.name}: 3 tigers on board`);
}

// 4. Testing AI Difficulty Tiers (Easy, Medium d=2, Hard d=4)
console.log('\n[4/6] Testing AI Difficulty Configurations & Move Generation...');
const difficulties = [
  { diff: AIDifficulty.Easy, name: 'Easy (Baseline Heuristic)' },
  { diff: AIDifficulty.Medium, name: 'Medium (Negamax d=2)' },
  { diff: AIDifficulty.Hard, name: 'Hard (Negamax d=4)' }
];

const testState = HuntGameState.createInitialGame();
testState.applyMove(Move.place(2)); // Move 1: Goats place at 2, now Tigers turn

for (const d of difficulties) {
  const tigerAI = HuntAIFactory.createAI(d.diff, PlayerSide.Tigers);
  const selectedMove = tigerAI.selectMove(testState);
  assert(selectedMove !== null, `${d.name}: AI returned a non-null move`);
  assert(testState.isLegalMove(selectedMove), `${d.name}: Selected move is strictly legal`);
}

// 5. Testing Game Over Transitions (Capture Quota & Encirclement Trap)
console.log('\n[5/6] Testing Game Over & Rematch Lifecycle...');
// A. Tiger Capture Quota Victory
const graph = BoardGraph.createStandardAaduPuliAatamGraph();
const tigerWinPieces = new Uint8Array(23);
tigerWinPieces[0] = PieceType.Tiger;
tigerWinPieces[18] = PieceType.Tiger;
tigerWinPieces[20] = PieceType.Tiger;
tigerWinPieces[2] = PieceType.Goat;

const tigerWinState = HuntGameState.createCustomState(
  graph,
  tigerWinPieces,
  10,
  4, // 4 captures already
  PlayerSide.Tigers,
  GamePhase.GoatPlacement,
  15,
  3,
  5
);
tigerWinState.applyMove(Move.tigerCapture(0, 2, 6));
assert(tigerWinState.capturedGoats === 5, 'Tigers reached capture quota of 5');
assert(tigerWinState.result === GameResult.TigersWinByCapture, 'Result evaluated as TigersWinByCapture');
assert(tigerWinState.phase === GamePhase.GameOver, 'Phase evaluated as GameOver');

// B. Goat Trap Victory
const goatTrapPieces = new Uint8Array(23);
goatTrapPieces[0] = PieceType.Tiger;
goatTrapPieces[16] = PieceType.Tiger;
goatTrapPieces[22] = PieceType.Tiger;
const trapGoatNodes = [1, 2, 3, 4, 6, 8, 9, 10, 17, 5, 18, 14, 15, 21, 7, 20];
for (const idx of trapGoatNodes) {
  if (idx < 23) goatTrapPieces[idx] = PieceType.Goat;
}

const goatTrapState = HuntGameState.createCustomState(
  graph,
  goatTrapPieces,
  0,
  0,
  PlayerSide.Tigers,
  GamePhase.Movement
);
assert(goatTrapState.result === GameResult.GoatsWinByTrap, 'Result evaluated as GoatsWinByTrap');
assert(goatTrapState.phase === GamePhase.GameOver, 'Phase evaluated as GameOver on trap');

// 6. Complete AI Match Full Traversal
console.log('\n[6/6] Executing Complete Multi-Turn Simulated Matches...');
for (let sim = 1; sim <= 3; sim++) {
  const matchSession = new HuntMatchSession();
  matchSession.startMatchWithMode(MatchMode.AiVsAi, AIDifficulty.Easy);
  let turns = 0;
  while (matchSession.state.phase !== GamePhase.GameOver && turns < 100) {
    const ai = matchSession.getCurrentAI();
    if (!ai) break;
    const move = ai.selectMove(matchSession.state);
    if (!move) break;
    matchSession.state.applyMove(move);
    turns++;
  }
  assert(turns > 0, `Match Simulation #${sim} ran successfully for ${turns} turns`);
}

console.log('\n====================================================');
console.log(`FINAL RELEASE SUITE: ${passedAssertions} / ${totalAssertions} ASSERTIONS PASSED (${failedAssertions} FAILED)`);
console.log('====================================================');

if (failedAssertions > 0) {
  process.exit(1);
} else {
  console.log('✨ All release validation criteria passed with 100% perfection!\n');
}

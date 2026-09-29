import { PieceType, PlayerSide, GamePhase, GameResult, MoveType, AIDifficulty, MatchMode } from '../src/core/enums.js';
import { BoardGraph } from '../src/core/board-graph.js';
import { Move } from '../src/core/move.js';
import { HuntGameState, HuntEngineRuleValidator, MoveValidationError } from '../src/core/game-state.js';
import { HuntEvaluator } from '../src/core/evaluator.js';
import { BaselineHuntAI, NegamaxHuntAI, HuntAIFactory } from '../src/core/ai.js';
import { HuntMatchSession } from '../src/core/match-session.js';
import { HuntTutorialSession } from '../src/core/tutorial-session.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

function assertEquals(actual, expected, message) {
  totalTests++;
  if (actual === expected) {
    passedTests++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message} (Expected: ${expected}, Actual: ${actual})`);
  }
}

console.log('====================================================');
console.log('  AADU PULI AATAM - WEB ENGINE TEST SUITE');
console.log('====================================================\n');

// 1. Test Board Topology
console.log('[1/8] Testing Board Topology & Collinear Jumps...');
const graph = BoardGraph.createStandardAaduPuliAatamGraph();
assertEquals(graph.nodeCount, 23, 'Standard board has 23 nodes');
assertEquals(graph.straightLines.length, 25, 'Standard board has 25 straight line corridors');
assert(graph.areAdjacent(0, 1), 'Node 0 (Apex) is adjacent to Node 1');
assert(graph.areAdjacent(0, 2), 'Node 0 (Apex) is adjacent to Node 2');
assert(graph.areAdjacent(0, 3), 'Node 0 (Apex) is adjacent to Node 3');
assert(!graph.areAdjacent(0, 4), 'Node 0 is not directly adjacent to Node 4');

// Check leaps
const jumpTo = graph.tryGetJump(0, 2);
assertEquals(jumpTo, 6, 'Jump from 0 over 2 lands on 6 along vertical line');
const jumpedNode = graph.tryGetJumpedNode(0, 6);
assertEquals(jumpedNode, 2, 'Jump from 0 to 6 jumped over node 2');
const jumpDiag = graph.tryGetJump(0, 1);
assertEquals(jumpDiag, 4, 'Jump from 0 over 1 lands on 4 along down-left diagonal');
const jumpDiag2 = graph.tryGetJump(1, 4);
assertEquals(jumpDiag2, 9, 'Jump from 1 over 4 lands on 9');

// 2. Test Initial State & Goat Placement
console.log('\n[2/8] Testing Initial Game State & Goat Placement...');
const state = HuntGameState.createInitialGame();
assertEquals(state.totalGoats, 15, 'Total goats is 15');
assertEquals(state.totalTigers, 3, 'Total tigers is 3');
assertEquals(state.unplacedGoats, 15, 'Unplaced goats start at 15');
assertEquals(state.capturedGoats, 0, 'Captured goats start at 0');
assertEquals(state.currentTurn, PlayerSide.Goats, 'Goats move first');
assertEquals(state.phase, GamePhase.GoatPlacement, 'Initial phase is GoatPlacement');
assertEquals(state.getPiece(0), PieceType.Tiger, 'Node 0 has a Tiger');
assertEquals(state.getPiece(1), PieceType.Tiger, 'Node 1 has a Tiger');
assertEquals(state.getPiece(3), PieceType.Tiger, 'Node 3 has a Tiger');
assertEquals(state.getPiece(2), PieceType.Empty, 'Node 2 is empty');

// Legal move validation for placement
const legalMovesInit = state.getLegalMoves();
assertEquals(legalMovesInit.length, 20, '20 empty nodes available for first placement');
assert(state.isLegalMove(Move.place(2)), 'Placing at empty node 2 is legal');
assert(!state.isLegalMove(Move.place(0)), 'Placing at occupied node 0 is illegal');

// Apply goat placement
state.applyMove(Move.place(2));
assertEquals(state.getPiece(2), PieceType.Goat, 'Node 2 now contains Goat');
assertEquals(state.unplacedGoats, 14, 'Unplaced goats decremented to 14');
assertEquals(state.currentTurn, PlayerSide.Tigers, 'Turn switched to Tigers');

// 3. Test Tiger Movement & Capture
console.log('\n[3/8] Testing Tiger Normal Movement & Leap Capture...');
// Tiger at 0 moves to 6 (leap over goat at 2)
const tigerCapture = Move.tigerCapture(0, 2, 6);
assert(state.isLegalMove(tigerCapture), 'Tiger capture 0 -> (2) -> 6 is legal');
state.applyMove(tigerCapture);
assertEquals(state.getPiece(0), PieceType.Empty, 'Node 0 is now empty');
assertEquals(state.getPiece(2), PieceType.Empty, 'Captured goat at node 2 is removed');
assertEquals(state.getPiece(6), PieceType.Tiger, 'Node 6 now has the Tiger');
assertEquals(state.capturedGoats, 1, 'Captured goats count is 1');
assertEquals(state.currentTurn, PlayerSide.Goats, 'Turn switched to Goats');

// 4. Test Transition to Movement Phase
console.log('\n[4/8] Testing Phase Transition to Movement Phase...');
const almostDonePieces = new Uint8Array(23);
almostDonePieces[0] = PieceType.Tiger;
almostDonePieces[1] = PieceType.Tiger;
almostDonePieces[3] = PieceType.Tiger;
for (let i = 9; i < 23; i++) almostDonePieces[i] = PieceType.Goat; // 14 placed goats at base

const statePhaseTest = HuntGameState.createCustomState(
  graph,
  almostDonePieces,
  1, // 1 unplaced goat
  0,
  PlayerSide.Goats,
  GamePhase.GoatPlacement
);
assertEquals(statePhaseTest.phase, GamePhase.GoatPlacement, 'Phase is GoatPlacement with 1 unplaced');
statePhaseTest.applyMove(Move.place(2));
assertEquals(statePhaseTest.unplacedGoats, 0, 'Unplaced goats is now 0');
assertEquals(statePhaseTest.phase, GamePhase.Movement, 'Phase transitioned to Movement');

// 5. Test Win Conditions: Tiger Capture Quota & Goat Trap
console.log('\n[5/8] Testing Victory Conditions...');
// Tiger win by 5 captures
const captureWinPieces = new Uint8Array(23);
captureWinPieces[0] = PieceType.Tiger;
captureWinPieces[18] = PieceType.Tiger;
captureWinPieces[20] = PieceType.Tiger;
captureWinPieces[2] = PieceType.Goat;

const stateCapWin = HuntGameState.createCustomState(
  graph,
  captureWinPieces,
  10,
  4, // 4 captures already
  PlayerSide.Tigers,
  GamePhase.GoatPlacement,
  15,
  3,
  5
);
assertEquals(stateCapWin.result, GameResult.InProgress, 'Match in progress before 5th capture');
stateCapWin.applyMove(Move.tigerCapture(0, 2, 6));
assertEquals(stateCapWin.capturedGoats, 5, 'Captured goats is 5');
assertEquals(stateCapWin.result, GameResult.TigersWinByCapture, 'Tigers win by capture quota');
assertEquals(stateCapWin.phase, GamePhase.GameOver, 'Game phase is GameOver');

// Goat win by trapping all 3 tigers
const trappedPieces = new Uint8Array(23);
trappedPieces[0] = PieceType.Tiger;
trappedPieces[16] = PieceType.Tiger;
trappedPieces[22] = PieceType.Tiger;
// Encircle Tiger 0 (nodes 1, 2, 3 have goats; nodes 4, 6, 8 have goats preventing leaps)
const trapGoats = [1, 2, 3, 4, 6, 8, 9, 10, 17, 5, 18, 14, 15, 21, 7, 20];
for (const idx of trapGoats) {
  if (idx < 23) trappedPieces[idx] = PieceType.Goat;
}

const stateTrapWin = HuntGameState.createCustomState(
  graph,
  trappedPieces,
  0,
  0,
  PlayerSide.Tigers,
  GamePhase.Movement
);
assertEquals(stateTrapWin.result, GameResult.GoatsWinByTrap, 'Goats win by trapping all tigers');
assertEquals(stateTrapWin.phase, GamePhase.GameOver, 'Game phase is GameOver on trap');

// 6. Test Position Evaluator
console.log('\n[6/8] Testing HuntEvaluator...');
const evalTiger = HuntEvaluator.evaluate(stateCapWin, PlayerSide.Tigers);
const evalGoat = HuntEvaluator.evaluate(stateCapWin, PlayerSide.Goats);
assertEquals(evalTiger, HuntEvaluator.WinScore, 'Tigers win score is 10000');
assertEquals(evalGoat, HuntEvaluator.LossScore, 'Goats loss score is -10000');

// 7. Test AI Engines (Easy, Medium d=2, Hard d=4)
console.log('\n[7/8] Testing AI Engines...');
const easyAI = HuntAIFactory.createAI(AIDifficulty.Easy, PlayerSide.Tigers);
const medAI = HuntAIFactory.createAI(AIDifficulty.Medium, PlayerSide.Tigers);
const hardAI = HuntAIFactory.createAI(AIDifficulty.Hard, PlayerSide.Tigers);

const testStateAI = HuntGameState.createInitialGame();
testStateAI.applyMove(Move.place(2)); // Goats placed at 2, now Tigers turn

const easyMove = easyAI.selectMove(testStateAI);
assert(easyMove !== null, 'Easy AI selected a move');
assert(testStateAI.isLegalMove(easyMove), 'Easy AI selected a legal move');

const medMove = medAI.selectMove(testStateAI);
assert(medMove !== null, 'Medium AI (d=2) selected a move');
assert(testStateAI.isLegalMove(medMove), 'Medium AI selected a legal move');
assertEquals(medAI.lastSearchStats.maxDepthReached >= 1, true, 'Medium AI reached search depth');

const hardMove = hardAI.selectMove(testStateAI);
assert(hardMove !== null, 'Hard AI (d=4) selected a move');
assert(testStateAI.isLegalMove(hardMove), 'Hard AI selected a legal move');
console.log(`  -> Hard AI searched ${hardAI.lastSearchStats.nodesSearched} nodes in ${hardAI.lastSearchStats.searchTimeMs.toFixed(1)}ms`);

// 8. Test Match Session & Tutorial Session
console.log('\n[8/8] Testing MatchSession and TutorialSession...');
const session = new HuntMatchSession();
session.startMatchWithMode(MatchMode.PlayerGoatsVsAiTigers, AIDifficulty.Medium);
assertEquals(session.isTigerAI, true, 'PlayerGoatsVsAiTigers sets Tiger to AI');
assertEquals(session.isGoatAI, false, 'PlayerGoatsVsAiTigers sets Goat to Human');
assert(session.state !== null, 'Match session initialized game state');

const tutorial = new HuntTutorialSession();
assertEquals(tutorial.steps.length, 7, 'Tutorial has exactly 7 steps');
assertEquals(tutorial.currentStepIndex, 0, 'Tutorial starts at step 0 (Step 1)');
tutorial.next();
assertEquals(tutorial.currentStepIndex, 1, 'Tutorial advanced to step 1');
tutorial.goToStep(6);
assertEquals(tutorial.currentStepIndex, 6, 'Tutorial jump to step 6 (Step 7)');
assertEquals(tutorial.currentStep.title, '7. Guided Capture Walkthrough', 'Step 7 title matches');

console.log('\n====================================================');
console.log(`TEST RESULTS: ${passedTests} / ${totalTests} PASSED (${failedTests} FAILED)`);
console.log('====================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('All Core Engine & AI tests passed flawlessly!\n');
}

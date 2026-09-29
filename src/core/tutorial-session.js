import { PieceType, PlayerSide, GamePhase } from './enums.js';
import { BoardGraph } from './board-graph.js';
import { Move } from './move.js';
import { HuntGameState } from './game-state.js';

export class TutorialStep {
  /**
   * @param {number} stepIndex
   * @param {string} title
   * @param {string} subtitle
   * @param {string} description
   * @param {string} keyRuleBullet
   * @param {HuntGameState} previewState
   * @param {number} selectedNodeId
   * @param {Move[]} highlightMoves
   */
  constructor(
    stepIndex,
    title,
    subtitle,
    description,
    keyRuleBullet,
    previewState,
    selectedNodeId = -1,
    highlightMoves = []
  ) {
    this.stepIndex = stepIndex;
    this.title = title;
    this.subtitle = subtitle;
    this.description = description;
    this.keyRuleBullet = keyRuleBullet;
    this.previewState = previewState;
    this.selectedNodeId = selectedNodeId;
    this.highlightMoves = highlightMoves || [];
  }
}

/**
 * Interactive tutorial state machine and content provider for Aadu Puli Aatam.
 */
export class HuntTutorialSession {
  static TotalSteps = 7;

  constructor() {
    this.steps = [];
    this.currentStepIndex = 0;
    this._buildTutorialSteps();
  }

  get currentStep() {
    return this.steps[this.currentStepIndex];
  }

  get stepNumber() {
    return this.currentStepIndex + 1;
  }

  get hasNext() {
    return this.currentStepIndex < HuntTutorialSession.TotalSteps - 1;
  }

  get hasPrevious() {
    return this.currentStepIndex > 0;
  }

  get progress() {
    return (this.currentStepIndex + 1) / HuntTutorialSession.TotalSteps;
  }

  next() {
    if (this.hasNext) this.currentStepIndex++;
  }

  previous() {
    if (this.hasPrevious) this.currentStepIndex--;
  }

  goToStep(index) {
    this.currentStepIndex = Math.max(0, Math.min(index, HuntTutorialSession.TotalSteps - 1));
  }

  reset() {
    this.currentStepIndex = 0;
  }

  _buildTutorialSteps() {
    const graph = BoardGraph.createStandardAaduPuliAatamGraph();

    // -------------------------------------------------------------
    // Step 1: Game Objective
    // -------------------------------------------------------------
    const state1 = HuntGameState.createInitialGame();
    this.steps.push(new TutorialStep(
      0,
      '1. Game Objective',
      'Asymmetrical Hunt between 3 Tigers and 15 Goats',
      'Aadu Puli Aatam is an ancient traditional Indian strategy game representing a hunt on a sacred grid.\n\n' +
      '• Tigers (◆, 3 pieces): Try to hunt and capture enough goats to reach the victory quota (5 goats).\n' +
      '• Goats (○, 15 pieces): Try to cooperate, encircle, and completely immobilize all 3 Tigers so they have no legal steps or jumps.',
      'Tigers seek captures • Goats seek a total encirclement trap.',
      state1
    ));

    // -------------------------------------------------------------
    // Step 2: Starting Setup
    // -------------------------------------------------------------
    const state2 = HuntGameState.createInitialGame();
    const highlightTigers = [
      Move.tigerMove(0, 1),
      Move.tigerMove(0, 2),
      Move.tigerMove(0, 3)
    ];
    this.steps.push(new TutorialStep(
      1,
      '2. Starting Setup',
      'Initial Board Layout & Hand Count',
      '• 3 Tigers (◆) start on the board at nodes 0 (apex), 1, and 3.\n' +
      '• 15 Goats (○) begin in hand (unplaced).\n' +
      '• Goats always move first by placing their first piece on any empty board intersection.',
      'Turn 1 begins with Goats placing a piece from hand.',
      state2,
      0,
      highlightTigers
    ));

    // -------------------------------------------------------------
    // Step 3: Goat Placement Phase
    // -------------------------------------------------------------
    const pieces3 = new Uint8Array(graph.nodeCount);
    pieces3[0] = PieceType.Tiger;
    pieces3[1] = PieceType.Tiger;
    pieces3[3] = PieceType.Tiger;
    pieces3[5] = PieceType.Goat;
    pieces3[7] = PieceType.Goat;
    const state3 = HuntGameState.createCustomState(
      graph,
      pieces3,
      13, // unplaced
      0,  // captured
      PlayerSide.Goats,
      GamePhase.GoatPlacement
    );
    const placementTargets = [
      Move.place(2),
      Move.place(4),
      Move.place(6),
      Move.place(8),
      Move.place(12)
    ];
    this.steps.push(new TutorialStep(
      2,
      '3. Goat Placement Phase',
      'Placing 15 Goats onto the Board',
      '• On each Goat turn, place exactly one Goat from your hand onto any empty intersection (green rings).\n' +
      '• Important: Goats on the board cannot move until all 15 goats have been placed from hand.\n' +
      '• Tigers move or capture immediately between each goat placement.',
      'During placement, goats are placed from hand and cannot step.',
      state3,
      -1,
      placementTargets
    ));

    // -------------------------------------------------------------
    // Step 4: Tiger Movement & Leap Captures
    // -------------------------------------------------------------
    const pieces4 = new Uint8Array(graph.nodeCount);
    pieces4[0] = PieceType.Tiger;
    pieces4[16] = PieceType.Tiger;
    pieces4[22] = PieceType.Tiger;
    pieces4[2] = PieceType.Goat; // Jumpable along 0 -> 2 -> 6

    const state4 = HuntGameState.createCustomState(
      graph,
      pieces4,
      14,
      0,
      PlayerSide.Tigers,
      GamePhase.GoatPlacement
    );
    const tiger4Moves = [
      Move.tigerMove(0, 1),
      Move.tigerMove(0, 3),
      Move.tigerCapture(0, 2, 6)
    ];
    this.steps.push(new TutorialStep(
      3,
      '4. Tiger Movement & Leaps',
      'Normal Step vs Leap Capture',
      '• Normal Step: A Tiger can move 1 step along a connected line to an adjacent empty node (green ring).\n' +
      '• Leap Capture: If an adjacent node has a Goat and the next node directly behind it along the straight line is empty, the Tiger jumps over the Goat (crimson target) and removes it from the game!',
      'Tiger leap: Over adjacent goat to empty connected landing node.',
      state4,
      0,
      tiger4Moves
    ));

    // -------------------------------------------------------------
    // Step 5: Goat Movement Phase
    // -------------------------------------------------------------
    const pieces5 = new Uint8Array(graph.nodeCount);
    pieces5[0] = PieceType.Tiger;
    pieces5[16] = PieceType.Tiger;
    pieces5[22] = PieceType.Tiger;
    for (let i = 4; i <= 15; i++) pieces5[i] = PieceType.Goat;

    const state5 = HuntGameState.createCustomState(
      graph,
      pieces5,
      0,
      3,
      PlayerSide.Goats,
      GamePhase.Movement
    );
    const goat5Moves = [
      Move.goatMove(12, 6),
      Move.goatMove(12, 19)
    ];
    this.steps.push(new TutorialStep(
      4,
      '5. Goat Movement Phase',
      'Stepping After All 15 Goats Are Placed',
      '• Once all 15 goats are on the board, the game enters the Movement Phase.\n' +
      '• On their turn, Goats can step 1 space along any connected line to an adjacent empty node.\n' +
      '• Goats cannot jump or capture; their strength is coordinated wall-building and area control.',
      'All 15 placed: Goats step 1 space to tighten the net.',
      state5,
      12,
      goat5Moves
    ));

    // -------------------------------------------------------------
    // Step 6: Winning Conditions
    // -------------------------------------------------------------
    const pieces6 = new Uint8Array(graph.nodeCount);
    pieces6[0] = PieceType.Tiger;
    pieces6[16] = PieceType.Tiger;
    pieces6[22] = PieceType.Tiger;

    // Trap all 3 Tigers
    const goatIndices = [1, 2, 3, 4, 6, 8, 9, 10, 17, 5, 18, 14, 15, 21, 7, 20];
    for (const idx of goatIndices) {
      if (idx < graph.nodeCount) pieces6[idx] = PieceType.Goat;
    }

    const state6 = HuntGameState.createCustomState(
      graph,
      pieces6,
      0,
      0,
      PlayerSide.Tigers,
      GamePhase.Movement
    );
    this.steps.push(new TutorialStep(
      5,
      '6. Winning Conditions',
      'Tiger Capture Quota vs Goat Encirclement',
      '• Tigers Win: Immediately when they capture 5 Goats (making it impossible for remaining goats to trap all 3 tigers).\n' +
      '• Goats Win: Immediately when all 3 Tigers are immobilized with zero legal steps and zero legal jumps.',
      'Tigers need 5 captures • Goats need all 3 Tigers trapped.',
      state6,
      -1,
      []
    ));

    // -------------------------------------------------------------
    // Step 7: Interactive Capture Demonstration
    // -------------------------------------------------------------
    const pieces7 = new Uint8Array(graph.nodeCount);
    pieces7[0] = PieceType.Tiger;
    pieces7[18] = PieceType.Tiger;
    pieces7[20] = PieceType.Tiger;
    pieces7[2] = PieceType.Goat; // Jumpable Goat along 0 -> 2 -> 6

    const state7 = HuntGameState.createCustomState(
      graph,
      pieces7,
      10,
      4,
      PlayerSide.Tigers,
      GamePhase.GoatPlacement,
      15,
      3,
      5
    );
    const captureDemoMoves = [
      Move.tigerCapture(0, 2, 6)
    ];
    this.steps.push(new TutorialStep(
      6,
      '7. Guided Capture Walkthrough',
      'Visualizing the Straight-Line Leap Path',
      '• Look at Tiger at Node 0 (golden halo).\n' +
      '• Goat is at Node 2 directly adjacent along line [0, 2, 6, 12, 19].\n' +
      '• Landing Node 6 is empty (crimson crosshair).\n\n' +
      'Executing move 0 ➔ 6 leaps over Node 2, captures the Goat, and wins the game!',
      'Capture Path: Node 0 ➔ Leaps Over Node 2 ➔ Lands on Node 6.',
      state7,
      0,
      captureDemoMoves
    ));
  }
}

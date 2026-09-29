import { PieceType, PlayerSide, GamePhase, GameResult } from './enums.js';

/**
 * Deterministic static position evaluator for Aadu Puli Aatam.
 * Evaluates positions from the perspective of either Tigers (Player 1) or Goats (Player 2).
 */
export class HuntEvaluator {
  static WinScore = 10000;
  static LossScore = -10000;
  static DrawScore = 0;

  // Evaluation weights
  static GoatCaptureWeight = 250;
  static TigerCaptureThreatWeight = 80;
  static TigerMobilityWeight = 15;
  static TigerTrappedPenalty = 350;
  static LowMobilityPressureBonus = 200;
  static GoatOnBoardWeight = 10;

  /**
   * Evaluates the board state from the perspective of the specified player.
   * Positive value indicates an advantage for the perspective player.
   * @param {import('./game-state.js').HuntGameState} state
   * @param {number} perspective PlayerSide
   * @returns {number}
   */
  static evaluate(state, perspective) {
    if (!state) return 0;

    // 1. Terminal State Check
    if (state.phase === GamePhase.GameOver || state.result !== GameResult.InProgress) {
      let terminalScore;
      switch (state.result) {
        case GameResult.TigersWinByCapture:
        case GameResult.TigersWinByStalemate:
          terminalScore = perspective === PlayerSide.Tigers ? HuntEvaluator.WinScore : HuntEvaluator.LossScore;
          break;
        case GameResult.GoatsWinByTrap:
          terminalScore = perspective === PlayerSide.Goats ? HuntEvaluator.WinScore : HuntEvaluator.LossScore;
          break;
        default:
          terminalScore = HuntEvaluator.DrawScore;
          break;
      }
      return terminalScore;
    }

    // 2. Non-terminal Heuristic Evaluation (Calculated from Tigers' perspective, then flipped if Goats)
    let tigerScore = 0;

    // Captured goats progression
    tigerScore += state.capturedGoats * HuntEvaluator.GoatCaptureWeight;

    // Goats remaining on board
    tigerScore -= state.goatsOnBoard * HuntEvaluator.GoatOnBoardWeight;

    // Tiger Mobility, Captures, and Trapped Penalties
    const tigerPositions = state.getTigerPositions();
    let totalTigerMoves = 0;
    let totalTigerCaptures = 0;
    let trappedTigersCount = 0;

    const graph = state.graph;
    const pieces = state.boardPieces;

    for (let i = 0; i < tigerPositions.length; i++) {
      const tigerNode = tigerPositions[i];
      let tigerMoves = 0;
      let tigerCaptures = 0;

      // Step mobility
      const adjacent = graph.getAdjacentNodes(tigerNode);
      for (let j = 0; j < adjacent.length; j++) {
        if (pieces[adjacent[j]] === PieceType.Empty) {
          tigerMoves++;
        }
      }

      // Capture leap opportunities
      const jumps = graph.getJumpsFrom(tigerNode);
      for (let j = 0; j < jumps.length; j++) {
        const jump = jumps[j];
        if (pieces[jump.overNode] === PieceType.Goat && pieces[jump.toNode] === PieceType.Empty) {
          tigerCaptures++;
        }
      }

      totalTigerMoves += tigerMoves;
      totalTigerCaptures += tigerCaptures;

      if (tigerMoves === 0 && tigerCaptures === 0) {
        trappedTigersCount++;
        tigerScore -= HuntEvaluator.TigerTrappedPenalty;
      } else {
        tigerScore += (tigerMoves * HuntEvaluator.TigerMobilityWeight) + (tigerCaptures * HuntEvaluator.TigerCaptureThreatWeight);
      }
    }

    // Goats trapping pressure (low tiger total mobility bonus to goats)
    const totalMobility = totalTigerMoves + totalTigerCaptures;
    if (totalMobility <= 2) {
      tigerScore -= HuntEvaluator.LowMobilityPressureBonus * (3 - totalMobility);
    }

    return perspective === PlayerSide.Tigers ? tigerScore : -tigerScore;
  }
}

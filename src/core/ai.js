import { PlayerSide, GamePhase, GameResult, AIDifficulty } from './enums.js';
import { HuntEvaluator } from './evaluator.js';

const InfinityScore = 1_000_000;

export class SearchStatistics {
  constructor() {
    this.nodesSearched = 0;
    this.nodesPruned = 0;
    this.cutoffs = 0;
    this.maxDepthReached = 0;
    this.searchTimeMs = 0;
  }
}

/**
 * Baseline deterministic/random legal-move AI for Aadu Puli Aatam.
 */
export class BaselineHuntAI {
  /**
   * @param {number} side PlayerSide
   */
  constructor(side) {
    this.side = side;
  }

  /**
   * @param {import('./game-state.js').HuntGameState} state
   * @returns {import('./move.js').Move | null}
   */
  selectMove(state) {
    if (!state) return null;
    if (state.phase === GamePhase.GameOver || state.result !== GameResult.InProgress) return null;
    if (state.currentTurn !== this.side) return null;

    const legalMoves = state.GetLegalMoves ? state.GetLegalMoves() : state.getLegalMoves();
    if (!legalMoves || legalMoves.length === 0) return null;

    // Baseline heuristic: Always execute an available capture leap when playing as Tigers
    const captures = legalMoves.filter(m => m.isCapture);
    if (captures.length > 0) {
      const idx = Math.floor(Math.random() * captures.length);
      return captures[idx];
    }

    const idx = Math.floor(Math.random() * legalMoves.length);
    return legalMoves[idx];
  }
}

/**
 * Strategic AI using depth-limited Negamax search with Alpha-Beta pruning.
 */
export class NegamaxHuntAI {
  /**
   * @param {number} side PlayerSide
   * @param {number} depth
   * @param {boolean} useAlphaBeta
   */
  constructor(side, depth = 3, useAlphaBeta = true) {
    this.side = side;
    this.depth = Math.max(1, depth);
    this.useAlphaBeta = useAlphaBeta;
    this.lastSearchStats = new SearchStatistics();
  }

  /**
   * @param {import('./game-state.js').HuntGameState} state
   * @returns {import('./move.js').Move | null}
   */
  selectMove(state) {
    if (!state) return null;
    if (state.phase === GamePhase.GameOver || state.result !== GameResult.InProgress) return null;
    if (state.currentTurn !== this.side) return null;

    const legalMoves = state.getLegalMoves();
    if (!legalMoves || legalMoves.length === 0) return null;

    const startTime = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    const stats = {
      nodesSearched: 0,
      nodesPruned: 0,
      cutoffs: 0,
      maxDepthReached: 1
    };

    if (legalMoves.length === 1) {
      const endTime = (typeof performance !== 'undefined') ? performance.now() : Date.now();
      this.lastSearchStats.nodesSearched = 1;
      this.lastSearchStats.nodesPruned = 0;
      this.lastSearchStats.cutoffs = 0;
      this.lastSearchStats.maxDepthReached = 1;
      this.lastSearchStats.searchTimeMs = endTime - startTime;
      return legalMoves[0];
    }

    // Move ordering: put captures first
    const sortedMoves = [...legalMoves].sort((a, b) => {
      if (a.isCapture && !b.isCapture) return -1;
      if (!a.isCapture && b.isCapture) return 1;
      return 0;
    });

    let bestScore = -InfinityScore;
    let bestMove = sortedMoves[0];
    let alpha = -InfinityScore;
    const beta = InfinityScore;

    for (let i = 0; i < sortedMoves.length; i++) {
      const move = sortedMoves[i];
      const nextState = state.clone();
      nextState.applyMove(move);
      stats.nodesSearched++;

      let score;
      if (this.useAlphaBeta) {
        score = -this._negamaxAlphaBeta(
          nextState,
          this.depth - 1,
          -beta,
          -alpha,
          nextState.currentTurn,
          1,
          stats
        );
      } else {
        score = -this._negamaxPlain(
          nextState,
          this.depth - 1,
          nextState.currentTurn,
          1,
          stats
        );
      }

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }

      if (this.useAlphaBeta) {
        if (score > alpha) {
          alpha = score;
        }
        if (alpha >= beta) {
          stats.cutoffs++;
          stats.nodesPruned += (sortedMoves.length - 1 - i);
          break;
        }
      }
    }

    const endTime = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    this.lastSearchStats.nodesSearched = stats.nodesSearched;
    this.lastSearchStats.nodesPruned = stats.nodesPruned;
    this.lastSearchStats.cutoffs = stats.cutoffs;
    this.lastSearchStats.maxDepthReached = stats.maxDepthReached;
    this.lastSearchStats.searchTimeMs = endTime - startTime;

    return bestMove;
  }

  _negamaxAlphaBeta(state, depth, alpha, beta, playerToMove, currentPly, stats) {
    if (currentPly > stats.maxDepthReached) {
      stats.maxDepthReached = currentPly;
    }

    if (state.phase === GamePhase.GameOver || state.result !== GameResult.InProgress || depth <= 0) {
      return HuntEvaluator.evaluate(state, playerToMove);
    }

    const legalMoves = state.getLegalMoves();
    if (legalMoves.length === 0) {
      return HuntEvaluator.evaluate(state, playerToMove);
    }

    // Move ordering: put captures first
    const sortedMoves = (legalMoves.length > 2) ? [...legalMoves].sort((a, b) => {
      if (a.isCapture && !b.isCapture) return -1;
      if (!a.isCapture && b.isCapture) return 1;
      return 0;
    }) : legalMoves;

    let maxEval = -InfinityScore;

    for (let i = 0; i < sortedMoves.length; i++) {
      const move = sortedMoves[i];
      const nextState = state.clone();
      nextState.applyMove(move);
      stats.nodesSearched++;

      const evalScore = -this._negamaxAlphaBeta(
        nextState,
        depth - 1,
        -beta,
        -alpha,
        nextState.currentTurn,
        currentPly + 1,
        stats
      );

      if (evalScore > maxEval) {
        maxEval = evalScore;
      }

      if (evalScore > alpha) {
        alpha = evalScore;
      }

      if (alpha >= beta) {
        stats.cutoffs++;
        stats.nodesPruned += (sortedMoves.length - 1 - i);
        break;
      }
    }

    return maxEval;
  }

  _negamaxPlain(state, depth, playerToMove, currentPly, stats) {
    if (currentPly > stats.maxDepthReached) {
      stats.maxDepthReached = currentPly;
    }

    if (state.phase === GamePhase.GameOver || state.result !== GameResult.InProgress || depth <= 0) {
      return HuntEvaluator.evaluate(state, playerToMove);
    }

    const legalMoves = state.getLegalMoves();
    if (legalMoves.length === 0) {
      return HuntEvaluator.evaluate(state, playerToMove);
    }

    let maxEval = -InfinityScore;

    for (let i = 0; i < legalMoves.length; i++) {
      const move = legalMoves[i];
      const nextState = state.clone();
      nextState.applyMove(move);
      stats.nodesSearched++;

      const evalScore = -this._negamaxPlain(
        nextState,
        depth - 1,
        nextState.currentTurn,
        currentPly + 1,
        stats
      );

      if (evalScore > maxEval) {
        maxEval = evalScore;
      }
    }

    return maxEval;
  }
}

/**
 * Factory for creating AI instances corresponding to chosen difficulty.
 */
export class HuntAIFactory {
  static MediumDepth = 2;
  static HardDepth = 4;

  /**
   * @param {number} difficulty AIDifficulty
   * @param {number} side PlayerSide
   * @param {number|null} customDepth
   * @returns {BaselineHuntAI | NegamaxHuntAI}
   */
  static createAI(difficulty, side, customDepth = null) {
    switch (difficulty) {
      case AIDifficulty.Easy:
        return new BaselineHuntAI(side);
      case AIDifficulty.Medium:
        return new NegamaxHuntAI(side, customDepth || HuntAIFactory.MediumDepth, true);
      case AIDifficulty.Hard:
        return new NegamaxHuntAI(side, customDepth || HuntAIFactory.HardDepth, true);
      default:
        return new BaselineHuntAI(side);
    }
  }
}

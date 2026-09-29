import { PieceType, PlayerSide, GamePhase, GameResult, MoveType } from './enums.js';
import { BoardGraph } from './board-graph.js';
import { Move } from './move.js';

export const MoveValidationError = Object.freeze({
  None: 0,
  GameOver: 1,
  WrongPlayerTurn: 2,
  PlacementNotAllowedInMovementPhase: 3,
  MovementNotAllowedInPlacementPhase: 4,
  NodeOutOfBounds: 5,
  DestinationNodeOccupied: 6,
  SourceNodeEmpty: 7,
  SourceNodeNotOwnedByCurrentPlayer: 8,
  NodesNotAdjacent: 9,
  InvalidJumpPath: 10,
  JumpTargetNotGoat: 11,
  JumpDestinationNotCollinear: 12,
  NoGoatsLeftToPlace: 13
});

/**
 * Validates a Move against the rules of Aadu Puli Aatam.
 */
export class HuntEngineRuleValidator {
  /**
   * @param {HuntGameState} state
   * @param {Move} move
   * @returns {{ error: number, message: string }}
   */
  static validateMove(state, move) {
    if (!state) {
      return { error: MoveValidationError.GameOver, message: 'State cannot be null.' };
    }

    if (state.phase === GamePhase.GameOver || state.result !== GameResult.InProgress) {
      return { error: MoveValidationError.GameOver, message: 'Game is already over.' };
    }

    const moveSide = (move.type === MoveType.PlaceGoat || move.type === MoveType.MoveGoat)
      ? PlayerSide.Goats
      : PlayerSide.Tigers;

    if (moveSide !== state.currentTurn) {
      const turnName = state.currentTurn === PlayerSide.Goats ? 'Goats' : 'Tigers';
      const moveSideName = moveSide === PlayerSide.Goats ? 'Goats' : 'Tigers';
      return {
        error: MoveValidationError.WrongPlayerTurn,
        message: `It is ${turnName}'s turn, but move was submitted for ${moveSideName}.`
      };
    }

    const graph = state.graph;

    // Destination bounds check
    if (move.toNode < 0 || move.toNode >= graph.nodeCount) {
      return {
        error: MoveValidationError.NodeOutOfBounds,
        message: `Destination node ${move.toNode} is out of bounds (0..${graph.nodeCount - 1}).`
      };
    }

    if (state.getPiece(move.toNode) !== PieceType.Empty) {
      return {
        error: MoveValidationError.DestinationNodeOccupied,
        message: `Destination node ${move.toNode} is already occupied.`
      };
    }

    switch (move.type) {
      case MoveType.PlaceGoat:
        if (state.phase !== GamePhase.GoatPlacement || state.unplacedGoats <= 0) {
          return {
            error: MoveValidationError.PlacementNotAllowedInMovementPhase,
            message: 'Goat placement is not allowed once all 15 goats have been placed.'
          };
        }
        return { error: MoveValidationError.None, message: '' };

      case MoveType.MoveGoat:
        if (state.phase !== GamePhase.Movement) {
          return {
            error: MoveValidationError.MovementNotAllowedInPlacementPhase,
            message: 'Goats cannot move on the board until all 15 goats have been placed.'
          };
        }
        if (move.fromNode < 0 || move.fromNode >= graph.nodeCount) {
          return {
            error: MoveValidationError.NodeOutOfBounds,
            message: `Source node ${move.fromNode} is out of bounds.`
          };
        }
        if (state.getPiece(move.fromNode) !== PieceType.Goat) {
          return {
            error: MoveValidationError.SourceNodeNotOwnedByCurrentPlayer,
            message: `Source node ${move.fromNode} does not contain a Goat.`
          };
        }
        if (!graph.areAdjacent(move.fromNode, move.toNode)) {
          return {
            error: MoveValidationError.NodesNotAdjacent,
            message: `Nodes ${move.fromNode} and ${move.toNode} are not adjacent.`
          };
        }
        return { error: MoveValidationError.None, message: '' };

      case MoveType.MoveTiger:
        if (move.fromNode < 0 || move.fromNode >= graph.nodeCount) {
          return {
            error: MoveValidationError.NodeOutOfBounds,
            message: `Source node ${move.fromNode} is out of bounds.`
          };
        }
        if (state.getPiece(move.fromNode) !== PieceType.Tiger) {
          return {
            error: MoveValidationError.SourceNodeNotOwnedByCurrentPlayer,
            message: `Source node ${move.fromNode} does not contain a Tiger.`
          };
        }
        if (!graph.areAdjacent(move.fromNode, move.toNode)) {
          return {
            error: MoveValidationError.NodesNotAdjacent,
            message: `Nodes ${move.fromNode} and ${move.toNode} are not adjacent.`
          };
        }
        return { error: MoveValidationError.None, message: '' };

      case MoveType.TigerCapture:
        if (move.fromNode < 0 || move.fromNode >= graph.nodeCount) {
          return {
            error: MoveValidationError.NodeOutOfBounds,
            message: `Source node ${move.fromNode} is out of bounds.`
          };
        }
        if (state.getPiece(move.fromNode) !== PieceType.Tiger) {
          return {
            error: MoveValidationError.SourceNodeNotOwnedByCurrentPlayer,
            message: `Source node ${move.fromNode} does not contain a Tiger.`
          };
        }
        if (move.capturedGoatNode < 0 || move.capturedGoatNode >= graph.nodeCount) {
          return {
            error: MoveValidationError.NodeOutOfBounds,
            message: `Captured goat node ${move.capturedGoatNode} is out of bounds.`
          };
        }
        if (state.getPiece(move.capturedGoatNode) !== PieceType.Goat) {
          return {
            error: MoveValidationError.JumpTargetNotGoat,
            message: `Jumped node ${move.capturedGoatNode} does not contain a Goat.`
          };
        }
        const expectedTo = graph.tryGetJump(move.fromNode, move.capturedGoatNode);
        if (expectedTo === null || expectedTo !== move.toNode) {
          return {
            error: MoveValidationError.InvalidJumpPath,
            message: `Path ${move.fromNode} -> ${move.capturedGoatNode} -> ${move.toNode} is not a valid straight collinear jump.`
          };
        }
        return { error: MoveValidationError.None, message: '' };

      default:
        return { error: MoveValidationError.GameOver, message: `Unknown move type ${move.type}.` };
    }
  }
}

/**
 * Encapsulates the complete game state and rule execution engine for Aadu Puli Aatam.
 */
export class HuntGameState {
  static DefaultTotalGoats = 15;
  static DefaultTotalTigers = 3;
  static DefaultGoatsCapturedToWin = 5;
  static DefaultInitialTigerPositions = [0, 1, 3];

  /**
   * @param {BoardGraph} graph
   * @param {number} totalGoats
   * @param {number} totalTigers
   * @param {number} goatsCapturedToWin
   */
  constructor(
    graph,
    totalGoats = HuntGameState.DefaultTotalGoats,
    totalTigers = HuntGameState.DefaultTotalTigers,
    goatsCapturedToWin = HuntGameState.DefaultGoatsCapturedToWin
  ) {
    if (!graph) throw new Error('BoardGraph is required');
    this.graph = graph;
    this.totalGoats = totalGoats;
    this.totalTigers = totalTigers;
    this.goatsCapturedToWin = goatsCapturedToWin;

    this.boardPieces = new Uint8Array(graph.nodeCount);
    this.moveHistory = [];

    this.unplacedGoats = totalGoats;
    this.capturedGoats = 0;
    this.currentTurn = PlayerSide.Goats;
    this.phase = GamePhase.GoatPlacement;
    this.result = GameResult.InProgress;
  }

  get goatsOnBoard() {
    return this.totalGoats - this.unplacedGoats - this.capturedGoats;
  }

  get tigersOnBoard() {
    let count = 0;
    for (let i = 0; i < this.boardPieces.length; i++) {
      if (this.boardPieces[i] === PieceType.Tiger) count++;
    }
    return count;
  }

  getPiece(nodeId) {
    if (nodeId < 0 || nodeId >= this.graph.nodeCount) return PieceType.Empty;
    return this.boardPieces[nodeId];
  }

  getTigerPositions() {
    const list = [];
    for (let i = 0; i < this.boardPieces.length; i++) {
      if (this.boardPieces[i] === PieceType.Tiger) list.push(i);
    }
    return list;
  }

  getGoatPositions() {
    const list = [];
    for (let i = 0; i < this.boardPieces.length; i++) {
      if (this.boardPieces[i] === PieceType.Goat) list.push(i);
    }
    return list;
  }

  static createInitialGame(
    initialTigerPositions = null,
    totalGoats = HuntGameState.DefaultTotalGoats,
    totalTigers = HuntGameState.DefaultTotalTigers,
    goatsCapturedToWin = HuntGameState.DefaultGoatsCapturedToWin,
    customGraph = null
  ) {
    const graph = customGraph || BoardGraph.createStandardAaduPuliAatamGraph();
    const state = new HuntGameState(graph, totalGoats, totalTigers, goatsCapturedToWin);

    const tigerNodes = initialTigerPositions || HuntGameState.DefaultInitialTigerPositions;
    if (tigerNodes.length !== totalTigers) {
      throw new Error(`Expected ${totalTigers} initial tiger positions, but got ${tigerNodes.length}.`);
    }

    for (const node of tigerNodes) {
      if (node < 0 || node >= graph.nodeCount) {
        throw new Error(`Tiger starting node ${node} is out of bounds.`);
      }
      if (state.boardPieces[node] !== PieceType.Empty) {
        throw new Error(`Duplicate starting position for tiger at node ${node}.`);
      }
      state.boardPieces[node] = PieceType.Tiger;
    }

    return state;
  }

  static createCustomState(
    graph,
    pieces,
    unplacedGoats,
    capturedGoats,
    currentTurn,
    phase = GamePhase.Movement,
    totalGoats = HuntGameState.DefaultTotalGoats,
    totalTigers = HuntGameState.DefaultTotalTigers,
    goatsCapturedToWin = HuntGameState.DefaultGoatsCapturedToWin
  ) {
    const state = new HuntGameState(graph, totalGoats, totalTigers, goatsCapturedToWin);
    state.unplacedGoats = unplacedGoats;
    state.capturedGoats = capturedGoats;
    state.currentTurn = currentTurn;
    state.phase = phase;

    if (pieces) {
      for (let i = 0; i < Math.min(pieces.length, state.boardPieces.length); i++) {
        state.boardPieces[i] = pieces[i];
      }
    }

    state.evaluateGameOver();
    return state;
  }

  isLegalMove(move) {
    const { error } = HuntEngineRuleValidator.validateMove(this, move);
    return error === MoveValidationError.None;
  }

  tryApplyMove(move) {
    const { error, message } = HuntEngineRuleValidator.validateMove(this, move);
    if (error !== MoveValidationError.None) {
      return { success: false, reason: message };
    }
    this._applyMoveInternal(move);
    return { success: true, reason: '' };
  }

  applyMove(move) {
    const res = this.tryApplyMove(move);
    if (!res.success) {
      throw new Error(`Illegal move: ${res.reason} (${move.toString()})`);
    }
  }

  _applyMoveInternal(move) {
    switch (move.type) {
      case MoveType.PlaceGoat:
        this.boardPieces[move.toNode] = PieceType.Goat;
        this.unplacedGoats--;
        if (this.unplacedGoats === 0) {
          this.phase = GamePhase.Movement;
        }
        break;

      case MoveType.MoveGoat:
        this.boardPieces[move.fromNode] = PieceType.Empty;
        this.boardPieces[move.toNode] = PieceType.Goat;
        break;

      case MoveType.MoveTiger:
        this.boardPieces[move.fromNode] = PieceType.Empty;
        this.boardPieces[move.toNode] = PieceType.Tiger;
        break;

      case MoveType.TigerCapture:
        this.boardPieces[move.fromNode] = PieceType.Empty;
        this.boardPieces[move.capturedGoatNode] = PieceType.Empty;
        this.boardPieces[move.toNode] = PieceType.Tiger;
        this.capturedGoats++;
        break;
    }

    this.moveHistory.push(move);

    // Switch turn
    this.currentTurn = (this.currentTurn === PlayerSide.Goats) ? PlayerSide.Tigers : PlayerSide.Goats;

    // Check win / trap conditions
    this.evaluateGameOver();
  }

  evaluateGameOver() {
    if (this.result !== GameResult.InProgress) return;

    // 1. Tiger victory by goat capture quota
    if (this.capturedGoats >= this.goatsCapturedToWin) {
      this.result = GameResult.TigersWinByCapture;
      this.phase = GamePhase.GameOver;
      return;
    }

    // 2. Goat victory by immobilizing all 3 tigers
    if (this.areAllTigersTrapped()) {
      this.result = GameResult.GoatsWinByTrap;
      this.phase = GamePhase.GameOver;
      return;
    }

    // 3. Stalemate check
    const legalMoves = this.getLegalMoves();
    if (legalMoves.length === 0) {
      if (this.currentTurn === PlayerSide.Tigers) {
        this.result = GameResult.GoatsWinByTrap;
        this.phase = GamePhase.GameOver;
      } else {
        this.result = GameResult.TigersWinByStalemate;
        this.phase = GamePhase.GameOver;
      }
    }
  }

  areAllTigersTrapped() {
    const tigers = this.getTigerPositions();
    if (tigers.length === 0) return false;

    for (const tigerNode of tigers) {
      if (!this.isTigerTrapped(tigerNode)) {
        return false;
      }
    }
    return true;
  }

  isTigerTrapped(tigerNode) {
    if (this.getPiece(tigerNode) !== PieceType.Tiger) return false;

    // Check 1: Any adjacent empty node for step?
    const adjacent = this.graph.getAdjacentNodes(tigerNode);
    for (let i = 0; i < adjacent.length; i++) {
      if (this.boardPieces[adjacent[i]] === PieceType.Empty) {
        return false;
      }
    }

    // Check 2: Any valid capture jump?
    const jumps = this.graph.getJumpsFrom(tigerNode);
    for (let i = 0; i < jumps.length; i++) {
      const jump = jumps[i];
      if (
        this.boardPieces[jump.overNode] === PieceType.Goat &&
        this.boardPieces[jump.toNode] === PieceType.Empty
      ) {
        return false;
      }
    }

    return true;
  }

  getLegalMoves() {
    const moves = [];
    if (this.phase === GamePhase.GameOver || this.result !== GameResult.InProgress) {
      return moves;
    }

    if (this.currentTurn === PlayerSide.Goats) {
      if (this.phase === GamePhase.GoatPlacement && this.unplacedGoats > 0) {
        for (let i = 0; i < this.graph.nodeCount; i++) {
          if (this.boardPieces[i] === PieceType.Empty) {
            moves.push(Move.place(i));
          }
        }
      } else {
        const goatNodes = this.getGoatPositions();
        for (const goatNode of goatNodes) {
          const adjacent = this.graph.getAdjacentNodes(goatNode);
          for (let i = 0; i < adjacent.length; i++) {
            const target = adjacent[i];
            if (this.boardPieces[target] === PieceType.Empty) {
              moves.push(Move.goatMove(goatNode, target));
            }
          }
        }
      }
    } else {
      // Tigers turn
      const tigerNodes = this.getTigerPositions();
      for (const tigerNode of tigerNodes) {
        // Normal steps
        const adjacent = this.graph.getAdjacentNodes(tigerNode);
        for (let i = 0; i < adjacent.length; i++) {
          const target = adjacent[i];
          if (this.boardPieces[target] === PieceType.Empty) {
            moves.push(Move.tigerMove(tigerNode, target));
          }
        }

        // Leaps / captures
        const jumps = this.graph.getJumpsFrom(tigerNode);
        for (let i = 0; i < jumps.length; i++) {
          const jump = jumps[i];
          if (
            this.boardPieces[jump.overNode] === PieceType.Goat &&
            this.boardPieces[jump.toNode] === PieceType.Empty
          ) {
            moves.push(Move.tigerCapture(jump.fromNode, jump.overNode, jump.toNode));
          }
        }
      }
    }

    return moves;
  }

  getLegalMovesForPiece(nodeId) {
    const allMoves = this.getLegalMoves();
    return allMoves.filter(m => m.fromNode === nodeId || (m.isPlacement && m.toNode === nodeId));
  }

  clone() {
    const next = new HuntGameState(
      this.graph,
      this.totalGoats,
      this.totalTigers,
      this.goatsCapturedToWin
    );
    next.boardPieces.set(this.boardPieces);
    next.moveHistory = [...this.moveHistory];
    next.unplacedGoats = this.unplacedGoats;
    next.capturedGoats = this.capturedGoats;
    next.currentTurn = this.currentTurn;
    next.phase = this.phase;
    next.result = this.result;
    return next;
  }
}

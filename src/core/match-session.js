import { PlayerSide, GamePhase, AIDifficulty, MatchMode } from './enums.js';
import { HuntGameState } from './game-state.js';
import { HuntAIFactory } from './ai.js';

/**
 * Manages match lifecycle, AI agent assignments, and configuration.
 */
export class HuntMatchSession {
  constructor() {
    /** @type {HuntGameState | null} */
    this.state = null;
    this.mode = MatchMode.PlayerGoatsVsAiTigers;
    this.tigerDifficulty = AIDifficulty.Medium;
    this.goatDifficulty = AIDifficulty.Medium;
    this.tigerAI = null;
    this.goatAI = null;
    this.isTigerAI = false;
    this.isGoatAI = false;
  }

  get isMatchActive() {
    return (
      this.state !== null &&
      this.state.phase !== GamePhase.GameOver &&
      this.state.moveHistory.length > 0
    );
  }

  get currentTurnIsAI() {
    if (!this.state || this.state.phase === GamePhase.GameOver) return false;
    return this.state.currentTurn === PlayerSide.Tigers ? this.isTigerAI : this.isGoatAI;
  }

  getCurrentAI() {
    if (!this.state || this.state.phase === GamePhase.GameOver) return null;
    return this.state.currentTurn === PlayerSide.Tigers ? this.tigerAI : this.goatAI;
  }

  /**
   * Starts a match based on MatchMode and Difficulty.
   * @param {number} mode MatchMode
   * @param {number} difficulty AIDifficulty
   * @param {number} totalGoats
   * @param {number} goatsCapturedToWin
   */
  startMatchWithMode(
    mode = MatchMode.PlayerGoatsVsAiTigers,
    difficulty = AIDifficulty.Medium,
    totalGoats = 15,
    goatsCapturedToWin = 5
  ) {
    this.mode = mode;
    let isTigerAI = false;
    let isGoatAI = false;

    switch (mode) {
      case MatchMode.LocalPvP:
        isTigerAI = false;
        isGoatAI = false;
        break;
      case MatchMode.PlayerGoatsVsAiTigers:
        isTigerAI = true;
        isGoatAI = false;
        break;
      case MatchMode.PlayerTigersVsAiGoats:
        isTigerAI = false;
        isGoatAI = true;
        break;
      case MatchMode.AiVsAi:
        isTigerAI = true;
        isGoatAI = true;
        break;
    }

    this.startMatch(isTigerAI, isGoatAI, difficulty, difficulty, totalGoats, goatsCapturedToWin);
  }

  /**
   * Starts a match with explicit AI settings.
   */
  startMatch(
    isTigerAI,
    isGoatAI,
    tigerDifficulty = AIDifficulty.Medium,
    goatDifficulty = AIDifficulty.Medium,
    totalGoats = 15,
    goatsCapturedToWin = 5
  ) {
    this.isTigerAI = isTigerAI;
    this.isGoatAI = isGoatAI;
    this.tigerDifficulty = tigerDifficulty;
    this.goatDifficulty = goatDifficulty;

    this.state = HuntGameState.createInitialGame(
      null,
      totalGoats,
      3,
      goatsCapturedToWin
    );

    this.tigerAI = isTigerAI ? HuntAIFactory.createAI(tigerDifficulty, PlayerSide.Tigers) : null;
    this.goatAI = isGoatAI ? HuntAIFactory.createAI(goatDifficulty, PlayerSide.Goats) : null;
  }

  restart() {
    this.startMatch(
      this.isTigerAI,
      this.isGoatAI,
      this.tigerDifficulty,
      this.goatDifficulty,
      this.state ? this.state.totalGoats : 15,
      this.state ? this.state.goatsCapturedToWin : 5
    );
  }
}

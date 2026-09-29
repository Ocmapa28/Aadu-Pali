import { UIScreenState, GamePhase, GameResult, PlayerSide } from '../core/enums.js';

/**
 * Manages screen transitions, HUD updates, modal dialogs, and tutorial text.
 */
export class UIManager {
  constructor() {
    this.screens = {
      [UIScreenState.MainMenu]: document.getElementById('screen-main-menu'),
      [UIScreenState.GameSetup]: document.getElementById('screen-setup'),
      [UIScreenState.MatchHUD]: document.getElementById('screen-match'),
      [UIScreenState.Tutorial]: document.getElementById('screen-tutorial')
    };

    this.settingsModal = document.getElementById('modal-settings');
    this.gameOverModal = document.getElementById('modal-gameover');

    // HUD Elements
    this.turnText = document.getElementById('turn-text');
    this.statPhase = document.getElementById('stat-phase');
    this.badgeSide = document.getElementById('badge-side');
    this.statUnplaced = document.getElementById('stat-unplaced');
    this.statCaptured = document.getElementById('stat-captured');
    this.captureProgress = document.getElementById('capture-progress');
    this.statTrapped = document.getElementById('stat-trapped');
    this.aiStatsBox = document.getElementById('ai-stats-box');
    this.statAiMetrics = document.getElementById('stat-ai-metrics');
    this.logTicker = document.getElementById('log-ticker');

    // Tutorial Elements
    this.tutStepBadge = document.getElementById('tut-step-badge');
    this.tutTitle = document.getElementById('tut-title');
    this.tutDesc = document.getElementById('tut-desc');
    this.tutKeyBullet = document.getElementById('tut-key-bullet');
    this.btnTutPrev = document.getElementById('btn-tut-prev');
    this.btnTutNext = document.getElementById('btn-tut-next');

    // GameOver Elements
    this.gameoverIcon = document.getElementById('gameover-icon');
    this.gameoverTitle = document.getElementById('gameover-title');
    this.gameoverDesc = document.getElementById('gameover-desc');

    this.currentScreen = UIScreenState.MainMenu;
  }

  showScreen(screenState) {
    this.currentScreen = screenState;
    Object.keys(this.screens).forEach((key) => {
      const el = this.screens[key];
      if (el) {
        if (key === screenState) {
          el.classList.add('active');
        } else {
          el.classList.remove('active');
        }
      }
    });

    this.closeSettings();
    this.closeGameOver();
  }

  showSettings() {
    if (this.settingsModal) this.settingsModal.classList.add('active');
  }

  closeSettings() {
    if (this.settingsModal) this.settingsModal.classList.remove('active');
  }

  showGameOver(result, capturedGoats, totalMoves) {
    if (!this.gameOverModal) return;

    if (result === GameResult.TigersWinByCapture || result === GameResult.TigersWinByStalemate) {
      this.gameoverIcon.textContent = '◆';
      this.gameoverIcon.style.color = '#E8A317';
      this.gameoverTitle.textContent = 'Tigers Win!';
      this.gameoverDesc.textContent = result === GameResult.TigersWinByCapture
        ? `Tigers captured ${capturedGoats} Goats and secured the hunt!`
        : 'Goats have no legal moves remaining. Tigers win by stalemate!';
    } else if (result === GameResult.GoatsWinByTrap) {
      this.gameoverIcon.textContent = '○';
      this.gameoverIcon.style.color = '#F5EDDF';
      this.gameoverTitle.textContent = 'Goats Win!';
      this.gameoverDesc.textContent = 'Goats successfully encircled and immobilized all 3 Tigers!';
    } else {
      this.gameoverIcon.textContent = '🤝';
      this.gameoverTitle.textContent = 'Draw!';
      this.gameoverDesc.textContent = 'The match concluded in a draw.';
    }

    this.gameOverModal.classList.add('active');
  }

  closeGameOver() {
    if (this.gameOverModal) this.gameOverModal.classList.remove('active');
  }

  updateHUD(state, isAIThinking = false) {
    if (!state) return;

    // Turn & Phase Text
    const sideName = state.currentTurn === PlayerSide.Goats ? 'Goats' : 'Tigers';
    const phaseName = state.phase === GamePhase.GoatPlacement ? 'Placement' : 'Movement';

    if (isAIThinking) {
      this.turnText.textContent = `AI is thinking (${sideName})...`;
    } else {
      const actionHint = (state.currentTurn === PlayerSide.Goats && state.phase === GamePhase.GoatPlacement)
        ? 'Placing'
        : 'Moving';
      this.turnText.textContent = `${sideName}' Turn (${actionHint})`;
    }

    this.statPhase.textContent = phaseName;
    this.badgeSide.textContent = sideName;
    this.badgeSide.className = `badge-tag ${state.currentTurn === PlayerSide.Goats ? 'badge-goats' : 'badge-tigers'}`;

    this.statUnplaced.textContent = `${state.unplacedGoats} / ${state.totalGoats}`;
    this.statCaptured.textContent = `${state.capturedGoats} / ${state.goatsCapturedToWin}`;

    const capturePct = Math.min(100, (state.capturedGoats / state.goatsCapturedToWin) * 100);
    this.captureProgress.style.width = `${capturePct}%`;

    // Trapped Tigers count
    let trappedCount = 0;
    const tigers = state.getTigerPositions();
    for (const t of tigers) {
      if (state.isTigerTrapped(t)) trappedCount++;
    }
    this.statTrapped.textContent = `${trappedCount} / 3`;
  }

  updateAIMetrics(stats, isAIActive) {
    if (!this.aiStatsBox || !this.statAiMetrics) return;

    if (isAIActive && stats) {
      this.aiStatsBox.style.display = 'block';
      const nodes = stats.nodesSearched || 1;
      const ms = (stats.searchTimeMs || 0).toFixed(1);
      const depth = stats.maxDepthReached || 1;
      this.statAiMetrics.textContent = `Depth: ${depth} • Nodes: ${nodes.toLocaleString()} • Time: ${ms}ms`;
    } else if (isAIActive) {
      this.aiStatsBox.style.display = 'block';
      this.statAiMetrics.textContent = 'Calculating optimal line...';
    } else {
      this.aiStatsBox.style.display = 'none';
    }
  }

  setLogMessage(msg) {
    if (this.logTicker) {
      this.logTicker.textContent = msg;
    }
  }

  renderTutorialStep(step, hasPrevious, hasNext) {
    if (!step) return;

    this.tutStepBadge.textContent = `Step ${step.stepIndex + 1} of 7`;
    this.tutTitle.textContent = step.title;
    this.tutDesc.innerHTML = step.description.replace(/\n/g, '<br>');
    this.tutKeyBullet.textContent = step.keyRuleBullet;

    this.btnTutPrev.disabled = !hasPrevious;
    this.btnTutNext.textContent = hasNext ? 'Next Step' : 'Finish Tutorial';
  }
}

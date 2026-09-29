import { UIScreenState, MatchMode, AIDifficulty, PlayerSide, GamePhase, GameResult, PieceType, MoveType } from './core/enums.js';
import { BoardGraph } from './core/board-graph.js';
import { Move } from './core/move.js';
import { HuntMatchSession } from './core/match-session.js';
import { HuntTutorialSession } from './core/tutorial-session.js';
import { AudioService } from './audio/audio-service.js';
import { BoardRenderer } from './render/board-renderer.js';
import { UIManager } from './ui/ui-manager.js';

class HuntApp {
  constructor() {
    this.graph = BoardGraph.createStandardAaduPuliAatamGraph();
    this.audio = new AudioService();
    this.ui = new UIManager();
    this.matchSession = new HuntMatchSession();
    this.tutorialSession = new HuntTutorialSession();

    // Canvas elements
    this.gameCanvas = document.getElementById('game-canvas');
    this.tutCanvas = document.getElementById('tutorial-canvas');

    this.gameRenderer = new BoardRenderer(this.gameCanvas, this.graph);
    this.tutRenderer = new BoardRenderer(this.tutCanvas, this.graph);

    // Gameplay selection state
    this.selectedNodeId = -1;
    this.highlightMoves = [];
    this.lastMove = null;
    this.isAIThinking = false;

    // Setup state
    this.selectedMode = MatchMode.PlayerGoatsVsAiTigers;
    this.selectedDifficulty = AIDifficulty.Medium;

    this._syncSavedSettingsToUI();
    this._initEventListeners();
    this._startRenderLoop();
  }

  _syncSavedSettingsToUI() {
    const sliderMaster = document.getElementById('slider-master');
    const sliderBgm = document.getElementById('slider-bgm');
    const sliderSfx = document.getElementById('slider-sfx');
    const btnMuteMaster = document.getElementById('btn-mute-master');
    const btnMuteBgm = document.getElementById('btn-mute-bgm');
    const btnMuteSfx = document.getElementById('btn-mute-sfx');
    const toggleNodeLabels = document.getElementById('toggle-node-labels');

    if (sliderMaster) sliderMaster.value = this.audio.masterVolume;
    if (sliderBgm) sliderBgm.value = this.audio.musicVolume;
    if (sliderSfx) sliderSfx.value = this.audio.sfxVolume;

    if (btnMuteMaster) btnMuteMaster.textContent = this.audio.isMuteAll ? 'Unmute' : 'Mute';
    if (btnMuteBgm) btnMuteBgm.textContent = this.audio.isMuteBgm ? 'Unmute' : 'Mute';
    if (btnMuteSfx) btnMuteSfx.textContent = this.audio.isMuteSfx ? 'Unmute' : 'Mute';

    const savedShowLabels = this._loadPref('apa_show_node_labels', false);
    this.gameRenderer.showNodeLabels = savedShowLabels;
    this.tutRenderer.showNodeLabels = savedShowLabels;
    if (toggleNodeLabels) toggleNodeLabels.checked = savedShowLabels;
  }

  _loadPref(key, defaultVal) {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) return JSON.parse(stored);
    } catch (e) {}
    return defaultVal;
  }

  _savePref(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {}
  }

  _initEventListeners() {
    // 1. Navigation & Menu Buttons
    document.getElementById('btn-menu-play')?.addEventListener('click', () => {
      this.audio.playButtonClick();
      this.ui.showScreen(UIScreenState.GameSetup);
    });

    document.getElementById('btn-menu-tutorial')?.addEventListener('click', () => {
      this.audio.playButtonClick();
      this.tutorialSession.reset();
      this._updateTutorialView();
      this.ui.showScreen(UIScreenState.Tutorial);
      this.tutRenderer.resize();
    });

    document.getElementById('btn-menu-settings')?.addEventListener('click', () => {
      this.audio.playButtonClick();
      this.ui.showSettings();
    });

    // 2. Setup Screen
    const modeButtons = document.querySelectorAll('.mode-option-btn');
    modeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.audio.playButtonClick();
        modeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedMode = parseInt(btn.getAttribute('data-mode'), 10);

        const diffSection = document.getElementById('difficulty-section');
        if (diffSection) {
          diffSection.style.display = (this.selectedMode === MatchMode.LocalPvP) ? 'none' : 'block';
        }
      });
    });

    const diffButtons = document.querySelectorAll('.diff-btn');
    diffButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.audio.playButtonClick();
        diffButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedDifficulty = parseInt(btn.getAttribute('data-diff'), 10);
      });
    });

    document.getElementById('btn-setup-back')?.addEventListener('click', () => {
      this.audio.playButtonClick();
      this.ui.showScreen(UIScreenState.MainMenu);
    });

    document.getElementById('btn-setup-start')?.addEventListener('click', () => {
      this.audio.playButtonClick();
      this._startMatch();
    });

    // 3. Match HUD Buttons
    document.getElementById('btn-match-back')?.addEventListener('click', () => {
      this.audio.playButtonClick();
      this.ui.showScreen(UIScreenState.MainMenu);
    });

    document.getElementById('btn-match-rematch')?.addEventListener('click', () => {
      this.audio.playButtonClick();
      this._rematch();
    });

    document.getElementById('btn-match-settings')?.addEventListener('click', () => {
      this.audio.playButtonClick();
      this.ui.showSettings();
    });

    // 4. Tutorial Navigation
    document.getElementById('btn-tut-back-menu')?.addEventListener('click', () => {
      this.audio.playButtonClick();
      this.ui.showScreen(UIScreenState.MainMenu);
    });

    document.getElementById('btn-tut-prev')?.addEventListener('click', () => {
      this.audio.playButtonClick();
      this.tutorialSession.previous();
      this._updateTutorialView();
    });

    document.getElementById('btn-tut-next')?.addEventListener('click', () => {
      this.audio.playButtonClick();
      if (this.tutorialSession.hasNext) {
        this.tutorialSession.next();
        this._updateTutorialView();
      } else {
        this.ui.showScreen(UIScreenState.MainMenu);
      }
    });

    // 5. Settings Modal
    document.getElementById('slider-master')?.addEventListener('input', (e) => {
      this.audio.setMasterVolume(parseFloat(e.target.value));
    });

    document.getElementById('slider-bgm')?.addEventListener('input', (e) => {
      this.audio.setMusicVolume(parseFloat(e.target.value));
    });

    document.getElementById('slider-sfx')?.addEventListener('input', (e) => {
      this.audio.setSfxVolume(parseFloat(e.target.value));
    });

    document.getElementById('btn-mute-master')?.addEventListener('click', (e) => {
      const isMuted = this.audio.toggleMuteAll();
      e.target.textContent = isMuted ? 'Unmute' : 'Mute';
    });

    document.getElementById('btn-mute-bgm')?.addEventListener('click', (e) => {
      const isMuted = this.audio.toggleMuteBgm();
      e.target.textContent = isMuted ? 'Unmute' : 'Mute';
    });

    document.getElementById('btn-mute-sfx')?.addEventListener('click', (e) => {
      const isMuted = this.audio.toggleMuteSfx();
      e.target.textContent = isMuted ? 'Unmute' : 'Mute';
    });

    document.getElementById('toggle-node-labels')?.addEventListener('change', (e) => {
      const show = e.target.checked;
      this.gameRenderer.showNodeLabels = show;
      this.tutRenderer.showNodeLabels = show;
      this._savePref('apa_show_node_labels', show);
    });

    document.getElementById('btn-close-settings')?.addEventListener('click', () => {
      this.audio.playButtonClick();
      this.ui.closeSettings();
    });

    // 6. Game Over Modal
    document.getElementById('btn-gameover-menu')?.addEventListener('click', () => {
      this.audio.playButtonClick();
      this.ui.closeGameOver();
      this.ui.showScreen(UIScreenState.MainMenu);
    });

    document.getElementById('btn-gameover-rematch')?.addEventListener('click', () => {
      this.audio.playButtonClick();
      this.ui.closeGameOver();
      this._rematch();
    });

    // 7. Board Node Interactions
    this.gameRenderer.onNodeClicked = (nodeId) => {
      this._handleGameNodeClick(nodeId);
    };

    // 8. Window Resize
    window.addEventListener('resize', () => {
      this.gameRenderer.resize();
      this.tutRenderer.resize();
    });

    // Ensure audio starts on first user interaction
    const startAudioOnGesture = () => {
      this.audio.startBgm();
      window.removeEventListener('pointerdown', startAudioOnGesture);
      window.removeEventListener('keydown', startAudioOnGesture);
    };
    window.addEventListener('pointerdown', startAudioOnGesture);
    window.addEventListener('keydown', startAudioOnGesture);
  }

  _startMatch() {
    this.matchSession.startMatchWithMode(this.selectedMode, this.selectedDifficulty);
    this.selectedNodeId = -1;
    this.highlightMoves = [];
    this.lastMove = null;
    this.isAIThinking = false;

    this.ui.showScreen(UIScreenState.MatchHUD);
    this.ui.setLogMessage('Match started. Goats place first piece.');
    this.ui.updateHUD(this.matchSession.state);
    this.ui.updateAIMetrics(null, this.matchSession.isTigerAI || this.matchSession.isGoatAI);

    setTimeout(() => {
      this.gameRenderer.resize();
    }, 50);

    this._checkAITurn();
  }

  _rematch() {
    this.matchSession.restart();
    this.selectedNodeId = -1;
    this.highlightMoves = [];
    this.lastMove = null;
    this.isAIThinking = false;

    this.ui.setLogMessage('Rematch started. Goats place first piece.');
    this.ui.updateHUD(this.matchSession.state);
    this.ui.updateAIMetrics(null, this.matchSession.isTigerAI || this.matchSession.isGoatAI);
    this._checkAITurn();
  }

  _handleGameNodeClick(nodeId) {
    if (this.isAIThinking) return;
    const state = this.matchSession.state;
    if (!state || state.phase === GamePhase.GameOver) return;
    if (this.matchSession.currentTurnIsAI) return;
    if (nodeId < 0 || nodeId >= this.graph.nodeCount) return;

    const currentSide = state.currentTurn;
    const pieceAtNode = state.getPiece(nodeId);

    // Case A: Goat Placement Phase (Goats Turn)
    if (currentSide === PlayerSide.Goats && state.phase === GamePhase.GoatPlacement) {
      if (pieceAtNode === PieceType.Empty) {
        const placeMove = Move.place(nodeId);
        const res = state.tryApplyMove(placeMove);
        if (res.success) {
          this.audio.playGoatPlace();
          this.selectedNodeId = -1;
          this.highlightMoves = [];
          this.lastMove = placeMove;
          this.ui.setLogMessage(`Goat placed on Node ${nodeId}.`);
          this._afterMoveApplied(placeMove);
        } else {
          this.audio.playInvalidMove();
          this.ui.setLogMessage(res.reason);
        }
      } else {
        this.audio.playInvalidMove();
      }
      return;
    }

    // Case B: Movement Phase or Tigers Turn
    // If a piece is already selected, check if clicking a destination executes a legal move
    if (this.selectedNodeId >= 0) {
      const matchingMove = this.highlightMoves.find(m => m.toNode === nodeId);
      if (matchingMove) {
        const res = state.tryApplyMove(matchingMove);
        if (res.success) {
          this.lastMove = matchingMove;
          if (matchingMove.isCapture) {
            this.audio.playTigerCapture();
            this.ui.setLogMessage(`Tiger leaped from ${matchingMove.fromNode} to ${matchingMove.toNode} and captured Goat at ${matchingMove.capturedGoatNode}!`);
          } else if (matchingMove.type === MoveType.MoveTiger) {
            this.audio.playTigerMove();
            this.ui.setLogMessage(`Tiger moved: ${matchingMove.fromNode} ➔ ${matchingMove.toNode}`);
          } else {
            this.audio.playPieceSelect();
            this.ui.setLogMessage(`Goat moved: ${matchingMove.fromNode} ➔ ${matchingMove.toNode}`);
          }

          this.selectedNodeId = -1;
          this.highlightMoves = [];
          this._afterMoveApplied(matchingMove);
          return;
        }
      }
    }

    // Selecting a piece owned by current player
    const isOwnedPiece = (currentSide === PlayerSide.Tigers && pieceAtNode === PieceType.Tiger) ||
                         (currentSide === PlayerSide.Goats && pieceAtNode === PieceType.Goat && state.phase === GamePhase.Movement);

    if (isOwnedPiece) {
      if (this.selectedNodeId === nodeId) {
        // Deselect
        this.selectedNodeId = -1;
        this.highlightMoves = [];
      } else {
        // Select piece and calculate legal moves
        this.selectedNodeId = nodeId;
        this.highlightMoves = state.getLegalMovesForPiece(nodeId);
        this.audio.playPieceSelect();
      }
    } else {
      // Clicked empty or opponent piece without executing move
      this.selectedNodeId = -1;
      this.highlightMoves = [];
    }
  }

  _afterMoveApplied(move) {
    const state = this.matchSession.state;
    this.ui.updateHUD(state);

    if (state.phase === GamePhase.GameOver) {
      this.audio.playVictory();
      this.ui.showGameOver(state.result, state.capturedGoats, state.moveHistory.length);
      return;
    }

    this._checkAITurn();
  }

  _checkAITurn() {
    const state = this.matchSession.state;
    if (!state || state.phase === GamePhase.GameOver) return;

    if (this.matchSession.currentTurnIsAI) {
      this.isAIThinking = true;
      this.ui.updateHUD(state, true);
      this.ui.updateAIMetrics(null, true);

      // Add a realistic 350-500ms thinking delay for smooth user experience
      const delay = (this.selectedMode === MatchMode.AiVsAi) ? 650 : 400;

      setTimeout(() => {
        if (!this.matchSession.state || this.matchSession.state.phase === GamePhase.GameOver) {
          this.isAIThinking = false;
          return;
        }

        const ai = this.matchSession.getCurrentAI();
        if (ai) {
          const aiMove = ai.selectMove(this.matchSession.state);
          if (aiMove) {
            this.lastMove = aiMove;
            const res = this.matchSession.state.tryApplyMove(aiMove);
            if (res.success) {
              if (aiMove.isCapture) {
                this.audio.playTigerCapture();
                this.ui.setLogMessage(`AI Tiger leaped ${aiMove.fromNode} ➔ ${aiMove.toNode}, capturing Goat at ${aiMove.capturedGoatNode}!`);
              } else if (aiMove.type === MoveType.MoveTiger) {
                this.audio.playTigerMove();
                this.ui.setLogMessage(`AI Tiger moved ${aiMove.fromNode} ➔ ${aiMove.toNode}.`);
              } else if (aiMove.isPlacement) {
                this.audio.playGoatPlace();
                this.ui.setLogMessage(`AI Goat placed on Node ${aiMove.toNode}.`);
              } else {
                this.audio.playPieceSelect();
                this.ui.setLogMessage(`AI Goat moved ${aiMove.fromNode} ➔ ${aiMove.toNode}.`);
              }
            }

            if (ai.lastSearchStats) {
              this.ui.updateAIMetrics(ai.lastSearchStats, true);
            }
          }
        }

        this.isAIThinking = false;
        this._afterMoveApplied(null);
      }, delay);
    }
  }

  _updateTutorialView() {
    const step = this.tutorialSession.currentStep;
    this.ui.renderTutorialStep(step, this.tutorialSession.hasPrevious, this.tutorialSession.hasNext);
  }

  _startRenderLoop() {
    const render = () => {
      if (this.ui.currentScreen === UIScreenState.MatchHUD) {
        this.gameRenderer.render(
          this.matchSession.state,
          this.selectedNodeId,
          this.highlightMoves,
          this.lastMove
        );
      } else if (this.ui.currentScreen === UIScreenState.Tutorial) {
        const step = this.tutorialSession.currentStep;
        if (step) {
          this.tutRenderer.render(
            step.previewState,
            step.selectedNodeId,
            step.highlightMoves,
            null
          );
        }
      }

      requestAnimationFrame(render);
    };

    requestAnimationFrame(render);
  }
}

// Start application when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new HuntApp();
});

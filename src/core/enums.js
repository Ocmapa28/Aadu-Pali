/**
 * Core enumeration types for Aadu Puli Aatam (Hunt Engine).
 */

export const PieceType = Object.freeze({
  Empty: 0,
  Tiger: 1, // Puli (Haldi Gold #E8A317, Glyph ◆)
  Goat: 2   // Aadu (Ivory #F5EDDF, Glyph ○)
});

export const PlayerSide = Object.freeze({
  Goats: 0, // Side B - Places and moves goats
  Tigers: 1  // Side A - Moves tigers and captures goats
});

export const GamePhase = Object.freeze({
  GoatPlacement: 0, // Goats are placed one by one from hand (Tigers move/capture)
  Movement: 1,      // All 15 goats placed; goats now move to adjacent nodes
  GameOver: 2       // Game has ended with a decisive win or draw
});

export const GameResult = Object.freeze({
  InProgress: 0,
  TigersWinByCapture: 1,   // Tigers captured >= GoatsCapturedToWin threshold (default 5)
  GoatsWinByTrap: 2,       // All 3 Tigers are immobilized with no legal moves/jumps
  TigersWinByStalemate: 3, // Goats have no legal moves remaining
  Draw: 4
});

export const MoveType = Object.freeze({
  PlaceGoat: 0,   // Place goat from hand onto empty node
  MoveTiger: 1,   // Single step tiger move to adjacent empty node
  MoveGoat: 2,    // Single step goat move to adjacent empty node
  TigerCapture: 3 // Tiger jumps over adjacent goat to empty node, capturing goat
});

export const AIDifficulty = Object.freeze({
  Easy: 0,   // Baseline heuristic AI (random legal moves prioritizing immediate captures)
  Medium: 1, // Strategic Alpha-Beta Negamax search (Depth 2)
  Hard: 2    // Deep Strategic Alpha-Beta Negamax search (Depth 4)
});

export const MatchMode = Object.freeze({
  LocalPvP: 0,              // Pass & Play (Player 1 Goats / Player 2 Tigers)
  PlayerGoatsVsAiTigers: 1, // Human (Goats) vs AI (Tigers)
  PlayerTigersVsAiGoats: 2, // Human (Tigers) vs AI (Goats)
  AiVsAi: 3                 // AI (Tigers) vs AI (Goats) [Spectator / Demo]
});

export const UIScreenState = Object.freeze({
  MainMenu: 'MainMenu',
  GameSetup: 'GameSetup',
  MatchHUD: 'MatchHUD',
  Tutorial: 'Tutorial',
  Settings: 'Settings'
});

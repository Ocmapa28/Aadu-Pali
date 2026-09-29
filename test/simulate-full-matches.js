import { PlayerSide, GamePhase, GameResult, AIDifficulty, MatchMode } from '../src/core/enums.js';
import { HuntMatchSession } from '../src/core/match-session.js';

console.log('====================================================');
console.log('  SIMULATING COMPLETE MATCH SESSIONS (AI VS AI)');
console.log('====================================================\n');

for (let matchIndex = 1; matchIndex <= 3; matchIndex++) {
  console.log(`--- Running Match Simulation #${matchIndex} ---`);
  const session = new HuntMatchSession();
  session.startMatchWithMode(MatchMode.AiVsAi, AIDifficulty.Medium);

  let turns = 0;
  const maxTurns = 200;

  while (session.state.phase !== GamePhase.GameOver && turns < maxTurns) {
    const ai = session.getCurrentAI();
    if (!ai) break;

    const move = ai.selectMove(session.state);
    if (!move) {
      console.log(`No legal move returned for ${session.state.currentTurn === PlayerSide.Goats ? 'Goats' : 'Tigers'}`);
      break;
    }

    session.state.applyMove(move);
    turns++;
  }

  console.log(`  Match completed in ${turns} moves.`);
  console.log(`  Result: ${session.state.result === GameResult.TigersWinByCapture ? 'Tigers Win (Captured 5 Goats)' : session.state.result === GameResult.GoatsWinByTrap ? 'Goats Win (All Tigers Trapped)' : 'Other/Stalemate'}`);
  console.log(`  Captured Goats: ${session.state.capturedGoats} / 5`);
  console.log(`  Phase: ${session.state.phase === GamePhase.GameOver ? 'GameOver' : 'InProgress'}\n`);
}

console.log('✓ All simulated AI vs AI matches executed cleanly without runtime exceptions!');

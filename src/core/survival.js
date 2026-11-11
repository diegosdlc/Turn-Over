// Survival rounds are completed when an enemy action (or skipped enemy turn) ends.
export function survivalProgressFor(state, level) {
  if (level?.rules?.victory !== 'survive' || !state) return null;
  const total = Number.isInteger(level.rules.surviveRounds) && level.rules.surviveRounds > 0
    ? level.rules.surviveRounds : 1;
  const completed = Math.min(total, Math.max(0, Number.isInteger(state.roundsElapsed) ? state.roundsElapsed : 0));
  return { total, completed, remaining: total - completed };
}

export function countSkippedSurvivalTurn(state, level, skippedTeam) {
  if (skippedTeam !== 'enemy' || level?.rules?.victory !== 'survive' || !state) return false;
  state.roundsElapsed = (state.roundsElapsed ?? 0) + 1;
  return true;
}

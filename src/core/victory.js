export const VICTORY_TYPES = Object.freeze({
  ELIMINATION: 'elimination',
  CAPTURE_KING: 'capture-king',
  ESCORT_KING: 'escort-king',
  SURVIVE: 'survive'
});

function activeUnits(state, team) {
  return state.units.filter(unit => state.active(unit) && unit.team === team);
}

function activeKing(state, team) {
  return state.units.find(unit => state.active(unit) && unit.team === team && unit.pieceType === 'king') ?? null;
}

function eliminatedWinner(state) {
  const playerAlive = activeUnits(state, 'player').length > 0;
  const enemyAlive = activeUnits(state, 'enemy').length > 0;
  if (!playerAlive) return 'enemy';
  if (!enemyAlive) return 'player';
  return null;
}

export function victoryResultFor(state, level) {
  const victory = level?.rules?.victory ?? VICTORY_TYPES.ELIMINATION;

  if (victory === VICTORY_TYPES.CAPTURE_KING) {
    if (!activeKing(state, 'player')) return { winner: 'enemy', reason: 'king-captured' };
    if (!activeKing(state, 'enemy')) return { winner: 'player', reason: 'king-captured' };
    const winner = eliminatedWinner(state);
    return winner ? { winner, reason: 'elimination' } : null;
  }

  if (victory === VICTORY_TYPES.ESCORT_KING) {
    const king = activeKing(state, 'player');
    if (!king) return { winner: 'enemy', reason: 'king-captured' };
    const targetRow = Number.isInteger(level?.rules?.targetRow) ? level.rules.targetRow : 0;
    if (king.y === targetRow) return { winner: 'player', reason: 'king-escaped' };
    if (!activeUnits(state, 'enemy').length) return { winner: 'player', reason: 'elimination' };
    return null;
  }

  if (victory === VICTORY_TYPES.SURVIVE) {
    if (!activeUnits(state, 'player').length) return { winner: 'enemy', reason: 'elimination' };
    if (!activeUnits(state, 'enemy').length) return { winner: 'player', reason: 'elimination' };
    const rounds = Math.max(1, Number(level?.rules?.surviveRounds) || 1);
    if ((state.roundsElapsed ?? 0) >= rounds) return { winner: 'player', reason: 'survived' };
    return null;
  }

  const winner = eliminatedWinner(state);
  return winner ? { winner, reason: 'elimination' } : null;
}

export function objectiveScoreFor(state, level, aiTeam) {
  const victory = level?.rules?.victory ?? VICTORY_TYPES.ELIMINATION;
  const perspective = aiTeam === 'enemy' ? 1 : -1;

  if (victory === VICTORY_TYPES.CAPTURE_KING) {
    const playerKing = activeKing(state, 'player');
    const enemyKing = activeKing(state, 'enemy');
    let score = 0;
    if (playerKing) score -= 1800;
    if (enemyKing) score += 1800;
    return score * perspective;
  }

  if (victory === VICTORY_TYPES.ESCORT_KING) {
    const king = activeKing(state, 'player');
    if (!king) return 50000 * perspective;
    const targetRow = Number.isInteger(level?.rules?.targetRow) ? level.rules.targetRow : 0;
    const distance = Math.abs(king.y - targetRow);
    // From the enemy perspective, every row kept between the king and the exit is valuable.
    return distance * 500 * perspective;
  }

  if (victory === VICTORY_TYPES.SURVIVE) {
    const rounds = Math.max(1, Number(level?.rules?.surviveRounds) || 1);
    const remaining = Math.max(0, rounds - (state.roundsElapsed ?? 0));
    // The attacking enemy becomes increasingly urgent as the survival clock expires.
    return remaining * 80 * perspective;
  }

  return 0;
}

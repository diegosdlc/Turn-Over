// Simple objective-aware, deterministic setup heuristics. Does not use combat turns.
export function deployEnemyWave(state, level) {
  if (!state.isAlternatingDeployment() || state.deploymentTurn !== 'enemy') return;
  const roster = state.deploymentRoster('enemy');
  const available = roster.filter(unit => unit.inReserve);
  const quota = state.deploymentRoundQuota('enemy');
  // Prioritize pieces that can hold an approach while protecting the royal pieces.
  available.sort((a, b) => priority(b, level) - priority(a, level));
  for (const unit of available.slice(0, quota)) {
    const size = level.board.size ?? 8;
    const cells = [];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (state.canDeployAt(unit, x, y)) cells.push({ x, y, score: scoreCell(state, level, unit, x, y, size) });
    }
    cells.sort((a, b) => b.score - a.score || a.y - b.y || a.x - b.x);
    if (cells.length) state.placeDeploymentUnit(unit, cells[0].x, cells[0].y);
  }
}
function priority(unit, level) {
  const victory = level.rules?.victory;
  const map = { king: 0, queen: 4, rook: 3, bishop: 3, knight: 3, pawn: 2 };
  return (map[unit.pieceType] ?? 1) + (victory === 'escort-king' && unit.pieceType === 'knight' ? 2 : 0);
}
function scoreCell(state, level, unit, x, y, size) {
  const victory = level.rules?.victory ?? 'elimination';
  const players = state.deploymentUnits('player');
  const enemies = state.deploymentUnits('enemy');
  const center = (size - 1) / 2;
  const centrality = size - Math.abs(x - center);
  const behind = unit.pieceType === 'king' ? (size - y) * 1.6 : y * 0.7;
  const playerDistance = players.length
    ? Math.min(...players.map(p => Math.abs(p.x - x) + Math.abs(p.y - y)))
    : size;
  const spread = enemies.length ? Math.min(...enemies.map(p => Math.abs(p.x - x) + Math.abs(p.y - y))) : 3;
  const target = victory === 'escort-king' ? y * 1.5 : 0;
  const survivalPressure = victory === 'survive' ? -playerDistance : 0;
  const king = enemies.find(p => p.pieceType === 'king');
  const kingCover = king && unit.pieceType !== 'king' ? -Math.abs(king.x - x) * .3 : 0;
  return centrality + behind + target + survivalPressure + Math.min(spread, 3) * .3 + kingCover - (unit.pieceType === 'king' ? Math.max(0, 5-playerDistance)*.7 : 0);
}

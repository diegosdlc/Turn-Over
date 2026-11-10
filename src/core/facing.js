// The board uses an isometric projection: a move along either logical axis
// can move a piece north or south on screen. Movement close to horizontal
// keeps its current facing instead of reacting to tiny projection skew.
export function facingForDisplacement(level, fromX, fromY, toX, toY, previousFacing) {
  if (![fromX, fromY, toX, toY].every(Number.isFinite)) return previousFacing;
  const dx = toX - fromX;
  const dy = toY - fromY;
  if (!dx && !dy) return previousFacing;

  const projection = level?.board?.projection;
  const xAxisY = Number.isFinite(projection?.xAxis?.y) ? projection.xAxis.y : 1;
  const yAxisY = Number.isFinite(projection?.yAxis?.y) ? projection.yAxis.y : 1;
  const northSouthDelta = dx * xAxisY + dy * yAxisY;
  const projectedTravel = Math.max(Math.abs(dx * xAxisY), Math.abs(dy * yAxisY));
  if (Math.abs(northSouthDelta) <= projectedTravel * 0.02) return previousFacing;
  return northSouthDelta < 0 ? 'north' : 'south';
}

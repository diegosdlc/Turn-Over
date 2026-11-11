// Pure view-model for the escort objective. It follows the actual victory rule:
// any reachable cell of targetRow is a winning destination for the protected king.
export function escortGoalCells(level, elements = level?.boardElements ?? []) {
  if (level?.rules?.victory !== 'escort-king') return [];
  const size = level?.board?.size ?? 8;
  const row = Number.isInteger(level.rules.targetRow) ? level.rules.targetRow : 0;
  if (!Number.isInteger(size) || size <= 0 || row < 0 || row >= size) return [];
  const blocked = new Set((elements ?? []).filter(item => item.blocking && item.y === row).map(item => item.x));
  return Array.from({ length: size }, (_, x) => x)
    .filter(x => !blocked.has(x))
    .map(x => ({ x, y: row }));
}

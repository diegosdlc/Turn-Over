import { cellBox } from '../core/geometry.js';

// Visual timing is deliberately separate from the authoritative turn/state lifecycle.
export const VISUAL_DURATION_MS = Object.freeze({
  deployment: 400,
  movement: 420,
  impact: 620
});

// Board cells are placed as percentages of the projected board, not fixed pixels.
// Measure at render time so the same movement works on mobile and desktop.
export function movementVector(projection, from, to, boardWidth, boardHeight) {
  if (!projection || !from || !to ||
      !Number.isFinite(from.x) || !Number.isFinite(from.y) ||
      !Number.isFinite(to.x) || !Number.isFinite(to.y) ||
      !Number.isFinite(boardWidth) || !Number.isFinite(boardHeight) ||
      boardWidth <= 0 || boardHeight <= 0) return null;

  const start = cellBox(projection, from.x, from.y);
  const end = cellBox(projection, to.x, to.y);
  return {
    x: (start.left - end.left) * boardWidth / projection.width,
    y: (start.top - end.top) * boardHeight / projection.height
  };
}

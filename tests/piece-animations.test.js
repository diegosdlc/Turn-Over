import test from 'node:test';
import assert from 'node:assert/strict';
import { movementVector, VISUAL_DURATION_MS } from '../src/render/animationGeometry.js';
import { STANDARD_BOARD } from '../src/content/levels/shared.js';

test('movement animation follows the projected board axes at any viewport size', () => {
  const projection = STANDARD_BOARD.projection;
  const a = movementVector(projection, { x: 2, y: 3 }, { x: 3, y: 3 }, 940, 580);
  const b = movementVector(projection, { x: 2, y: 3 }, { x: 3, y: 3 }, 470, 290);
  assert.ok(a.x < 0 && a.y < 0);
  assert.equal(b.x, a.x / 2);
  assert.equal(b.y, a.y / 2);
});

test('no movement is generated for incomplete coordinates or invalid viewport dimensions', () => {
  const projection = STANDARD_BOARD.projection;
  assert.equal(movementVector(projection, { x: null, y: 1 }, { x: 2, y: 3 }, 940, 580), null);
  assert.equal(movementVector(projection, { x: 1, y: 1 }, { x: 2, y: 3 }, 0, 580), null);
});

test('short animation timings leave game logic independent of UI presentation', () => {
  for (const name of ['deployment', 'movement', 'impact']) {
    assert.ok(VISUAL_DURATION_MS[name] > 0);
    assert.ok(VISUAL_DURATION_MS[name] <= 700);
  }
});

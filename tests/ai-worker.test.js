import test from 'node:test';
import assert from 'node:assert/strict';
import { getLevel } from '../src/content/levels/index.js';
import { GameState } from '../src/core/GameState.js';
import { legalActionsFor } from '../src/core/rules.js';
import { aiRequestFor, chooseAiAction } from '../src/ai/AIWorker.js';

test('AI worker reconstructs a cloned encounter and returns a legal action without mutating live state', () => {
  const level = getLevel('tutorial-01');
  const state = new GameState(level);
  state.phase = 'play';
  state.currentTurn = 'enemy';
  state.boardElements = [];
  const player = state.units.find(unit => unit.team === 'player' && unit.pieceType === 'king');
  const enemy = state.units.find(unit => unit.team === 'enemy' && unit.pieceType === 'king');
  Object.assign(player, { x: 4, y: 4, inReserve: false });
  Object.assign(enemy, { x: 3, y: 3, inReserve: false });
  state.units = [player, enemy];
  const before = structuredClone(state.units);
  const request = structuredClone(aiRequestFor(state, {
    ...level,
    ai: { ...level.ai, depth: 1 },
    behavior: { beforeLeaveOrigin() {} }
  }));
  const action = chooseAiAction(request);
  assert.ok(action);
  assert.deepEqual(action, legalActionsFor(state, level).find(candidate =>
    candidate.unitId === action.unitId && candidate.kind === action.kind &&
    candidate.x === action.x && candidate.y === action.y && candidate.targetId === action.targetId));
  assert.deepEqual(state.units, before);
  assert.equal(state.currentTurn, 'enemy');
});

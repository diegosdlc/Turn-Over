import test from 'node:test';
import assert from 'node:assert/strict';
import { getLevel } from '../src/content/levels/index.js';
import { GameState } from '../src/core/GameState.js';
import { legalActionsFor } from '../src/core/rules.js';
import { aiRequestFor, chooseAiAction } from '../src/ai/AIWorker.js';
import { AIController, DEFAULT_AI_SEARCH_BUDGET_MS } from '../src/ai/AIController.js';
import { readFileSync } from 'node:fs';

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

function searchFixture() {
  const level = getLevel('tutorial-01');
  const state = new GameState(level);
  state.phase = 'play';
  state.currentTurn = 'enemy';
  state.boardElements = [];
  const player = state.units.find(unit => unit.team === 'player' && unit.pieceType === 'king');
  const enemy = state.units.find(unit => unit.team === 'enemy' && unit.pieceType === 'king');
  Object.assign(player, { x: 5, y: 5, inReserve: false });
  Object.assign(enemy, { x: 2, y: 2, inReserve: false });
  state.units = [player, enemy];
  return { state, level };
}

test('iterative search uses the last complete depth when the time budget expires', () => {
  const { state, level } = searchFixture();
  let ticks = 0;
  const shallow = new AIController({ ...level.ai, depth: 1, searchBudgetMs: 10000 });
  shallow.chooseAction(state, level, { now: () => ticks++ });
  assert.equal(shallow.lastSearch.completedDepth, 1);
  const firstDepthTicks = ticks;
  const before = structuredClone(state.units);
  ticks = 0;
  const deep = new AIController({ ...level.ai, depth: 10, searchBudgetMs: firstDepthTicks + 1 });
  const action = deep.chooseAction(state, level, { now: () => ticks++ });
  assert.equal(deep.lastSearch.completedDepth, 1);
  assert.equal(deep.lastSearch.timedOut, true);
  assert.ok(legalActionsFor(state, level).some(candidate => JSON.stringify(candidate) === JSON.stringify(action)));
  assert.deepEqual(state.units, before);
  assert.equal(state.currentTurn, 'enemy');
});

test('a deadline before any completed evaluation still returns a legal move', () => {
  const { state, level } = searchFixture();
  let ticks = 0;
  const ai = new AIController({ ...level.ai, depth: 10, searchBudgetMs: 1 });
  const action = ai.chooseAction(state, level, { now: () => ticks++ });
  assert.deepEqual(action, legalActionsFor(state, level)[0]);
  assert.equal(ai.lastSearch.completedDepth, 0);
  assert.equal(ai.lastSearch.timedOut, true);
  assert.equal(new AIController().searchBudgetMs, DEFAULT_AI_SEARCH_BUDGET_MS);
});

test('worker watchdog is independent of the search and is cleared on cancel, failure and result', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /request\.watchdog = window\.setTimeout/);
  assert.match(main, /this\.ai\.searchBudgetMs \+ 2500/);
  assert.match(main, /clearTimeout\(this\.aiRequest\.watchdog\)/);
  assert.equal([...main.matchAll(/clearTimeout\(request\.watchdog\)/g)].length, 2);
});

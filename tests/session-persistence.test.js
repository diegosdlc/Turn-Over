import test from 'node:test';
import assert from 'node:assert/strict';

import { GameState } from '../src/core/GameState.js';
import { getLevel } from '../src/content/levels/index.js';
import { victoryResultFor } from '../src/core/victory.js';
import { GameSessionStore, restoreSessionState } from '../src/systems/GameSessionStore.js';

function withLocalStorage(run) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const entries = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem(key) { return entries.get(key) ?? null; },
      setItem(key, value) { entries.set(key, String(value)); },
      removeItem(key) { entries.delete(key); }
    }
  });
  try {
    return run();
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
}

function survivalSession() {
  const level = getLevel('scenario-survive');
  const store = new GameSessionStore('turn-over:test-survival', 6, ['green', 'red', 'yellow']);
  return { level, store };
}

test('survival rounds survive saving and restoring a session', () => withLocalStorage(() => {
  const { level, store } = survivalSession();
  const initial = new GameState(level);
  initial.roundsElapsed = 5;
  initial.currentTurn = 'enemy';

  store.save(level, initial);
  const saved = store.load();
  assert.equal(saved.schemaVersion, 6);
  assert.equal(saved.state.roundsElapsed, 5);

  const restored = new GameState(level);
  restored.selectedId = 'old-selection';
  restored.pendingCapture = { unitId: 'old-selection' };
  restoreSessionState(restored, saved.state);

  assert.equal(restored.roundsElapsed, 5);
  assert.equal(restored.currentTurn, 'enemy');
  assert.deepEqual(restored.units, initial.units);
  assert.equal(restored.selectedId, null);
  assert.equal(restored.pendingCapture, null);
  assert.equal(victoryResultFor(restored, level), null);

  restored.roundsElapsed = 8;
  assert.equal(victoryResultFor(restored, level)?.winner, 'player');
}));

test('old schema-6 sessions without roundsElapsed remain loadable', () => withLocalStorage(() => {
  const { level, store } = survivalSession();
  const initial = new GameState(level);
  initial.roundsElapsed = 5;
  store.save(level, initial);

  const legacy = JSON.parse(localStorage.getItem(store.storageKey));
  delete legacy.state.roundsElapsed;
  localStorage.setItem(store.storageKey, JSON.stringify(legacy));

  const saved = store.load();
  assert.ok(saved);
  const restored = new GameState(level);
  restored.roundsElapsed = 3;
  restoreSessionState(restored, saved.state);

  assert.equal(restored.roundsElapsed, 0);
  assert.deepEqual(restored.units, initial.units);
}));

test('invalid saved round counters safely fall back to zero', () => {
  const { level } = survivalSession();
  for (const counter of [-1, 1.5, '5', null, Number.MAX_SAFE_INTEGER + 1]) {
    const state = new GameState(level);
    state.roundsElapsed = 4;
    restoreSessionState(state, { units: state.units, roundsElapsed: counter });
    assert.equal(state.roundsElapsed, 0, `counter: ${String(counter)}`);
  }

  const zero = new GameState(level);
  restoreSessionState(zero, { units: zero.units, roundsElapsed: 0 });
  assert.equal(zero.roundsElapsed, 0);
});


test('saved campaign battles adopt their configured rival faction without losing piece state', () => {
  for (const [levelId, expectedFaction] of [
    ['tutorial-01', 'red'], ['tutorial-02', 'yellow'],
    ['tutorial-03', 'red'], ['tutorial-04', 'yellow']
  ]) {
    const level = getLevel(levelId);
    const savedUnits = new GameState(level).units.map(unit => ({
      ...unit,
      faction: unit.team === 'enemy' ? 'green' : unit.faction
    }));
    const savedQueen = savedUnits.find(unit => unit.id === 'enemy-queen');
    savedQueen.x = 7;
    savedQueen.y = 3;
    savedQueen.evolutionStage = 'evolved';
    const restored = new GameState(level);
    restoreSessionState(restored, { units: savedUnits, currentTurn: 'enemy', phase: 'play' });
    assert.equal(restored.currentTurn, 'enemy');
    assert.ok(restored.units.filter(unit => unit.team === 'enemy')
      .every(unit => unit.faction === expectedFaction), levelId);
    const queen = restored.units.find(unit => unit.id === 'enemy-queen');
    assert.deepEqual([queen.x, queen.y, queen.evolutionStage], [7, 3, 'evolved']);
    assert.equal(savedQueen.faction, 'green', 'restoration does not mutate saved input');
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../src/core/GameState.js';
import { getLevel } from '../src/content/levels/index.js';
import { deployEnemyWave } from '../src/ai/DeploymentAI.js';
import { GameSessionStore, restoreSessionState } from '../src/systems/GameSessionStore.js';

function withLocalStorage(run) {
  const old = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const entries = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem(key) { return entries.get(key) ?? null; },
      setItem(key, value) { entries.set(key, String(value)); },
      removeItem(key) { entries.delete(key); }
    }
  });
  try { return run(); }
  finally {
    if (old) Object.defineProperty(globalThis, 'localStorage', old);
    else delete globalThis.localStorage;
  }
}

function placePlayers(state, quota) {
  let placed = 0;
  const size = state.level.board.size ?? 8;
  for (const unit of state.deploymentRoster('player').filter(piece => piece.inReserve)) {
    if (placed >= quota) break;
    if (!state.canAffordDeploymentUnit(unit)) continue;
    let done = false;
    for (let y = 0; y < size && !done; y++) {
      for (let x = 0; x < size && !done; x++) {
        if (state.placeDeploymentUnit(unit, x, y)) { placed++; done = true; }
      }
    }
  }
  return placed;
}

test('three alternating rounds: enemy first, quotas, locked pieces, then combat', () => {
  const level = getLevel('tutorial-01');
  const state = new GameState(level);
  const king = state.deploymentRoster('enemy').find(unit => unit.pieceType === 'king');
  assert.equal(state.deploymentTurn, 'enemy');
  assert.ok(king && !king.inReserve && state.isDeploymentCommitted(king));
  for (let round = 1; round <= 3; round++) {
    assert.equal(state.deploymentRound, round);
    deployEnemyWave(state, level);
    assert.equal(state.deploymentRoundPlaced('enemy'), state.deploymentRoundQuota('enemy'));
    assert.equal(state.finishEnemyDeploymentRound(), true);
    assert.equal(state.deploymentTurn, 'player');
    assert.equal(placePlayers(state, state.deploymentRoundQuota('player')), state.deploymentRoundQuota('player'));
    assert.equal(state.canFinishDeploymentRound(), true);
    if (round < 3) {
      const previous = [...state.deploymentUnits('player')];
      assert.equal(state.advanceDeploymentRound(), true);
      for (const unit of previous) {
        assert.ok(state.isDeploymentCommitted(unit));
        assert.equal(state.canDeployAt(unit, unit.x, unit.y), false);
        assert.equal(state.reserveDeploymentUnit(unit), false);
      }
    }
  }
  assert.equal(state.deploymentRoster('enemy').some(unit => unit.inReserve), false);
  assert.equal(state.deploymentComplete(), true);
  assert.equal(state.beginPlay(), true);
  assert.equal(state.phase, 'play');
});

test('round quotas cover roster sizes and missing configured garrison', () => {
  const level = getLevel('tutorial-01');
  const players = level.units.filter(unit => unit.team === 'player');
  for (const count of [1, 2, 4, 7]) {
    const expanded = Array.from({ length: count }, (_, i) => ({
      ...players[i % players.length], id: 'extra-' + i
    }));
    const state = new GameState({
      ...level, units: [...expanded, ...level.units.filter(unit => unit.team === 'enemy')]
    });
    const quotas = [1, 2, 3].map(round => {
      state.deploymentRound = round;
      return state.deploymentRoundQuota('player');
    });
    assert.equal(quotas.reduce((a, b) => a + b, 0), count);
  }
  const noKing = { ...level, deployment: { ...level.deployment, initialEnemyPieceTypes: ['missing'] } };
  const state = new GameState(noKing);
  assert.equal(state.deploymentRoster('enemy').filter(unit => !unit.inReserve).length, 1);
  const quotas = [1, 2, 3].map(round => {
    state.deploymentRound = round;
    return state.deploymentRoundQuota('enemy');
  });
  assert.equal(quotas.reduce((a, b) => a + b, 0), state.deploymentRoster('enemy').length - 1);
});

test('schema-7 saves resume deployment and preserve locked pieces', () => withLocalStorage(() => {
  const level = getLevel('tutorial-01');
  const store = new GameSessionStore('test:alternating', 7, ['green', 'red', 'yellow']);
  const state = new GameState(level);
  deployEnemyWave(state, level);
  state.finishEnemyDeploymentRound();
  assert.equal(placePlayers(state, state.deploymentRoundQuota('player')), state.deploymentRoundQuota('player'));
  assert.equal(state.advanceDeploymentRound(), true);
  store.save(level, state);
  const saved = store.load();
  assert.equal(saved.schemaVersion, 7);
  const resumed = new GameState(level);
  restoreSessionState(resumed, saved.state);
  assert.equal(resumed.deploymentRound, 2);
  assert.equal(resumed.deploymentTurn, 'enemy');
  const locked = resumed.deploymentUnits('player')[0];
  assert.ok(resumed.isDeploymentCommitted(locked));
  assert.equal(resumed.canDeployAt(locked, locked.x, locked.y), false);
  deployEnemyWave(resumed, level);
  assert.equal(resumed.finishEnemyDeploymentRound(), true);
  assert.equal(resumed.deploymentTurn, 'player');
}));

test('schema-6 sessions preserve classic deployment and survival rounds', () => withLocalStorage(() => {
  const level = getLevel('tutorial-01');
  const store = new GameSessionStore('test:legacy', 7, ['green', 'red', 'yellow']);
  const original = new GameState({ ...level, deployment: { ...level.deployment, mode: 'classic' } });
  localStorage.setItem(store.storageKey, JSON.stringify({
    schemaVersion: 6, levelId: level.id, playerFactionId: level.teams.player,
    state: { units: original.units, currentTurn: 'player', phase: 'deployment', roundsElapsed: 5 }
  }));
  const saved = store.load();
  assert.equal(saved.schemaVersion, 6);
  const resumed = new GameState(level);
  restoreSessionState(resumed, saved.state);
  assert.equal(resumed.roundsElapsed, 5);
  assert.equal(resumed.isAlternatingDeployment(), false);
  assert.deepEqual(resumed.units, original.units);
  store.save(level, resumed);
  assert.equal(store.load().schemaVersion, 7);
  assert.equal(store.load().state.deploymentMode, 'classic');
  const again = new GameState(level);
  restoreSessionState(again, store.load().state);
  assert.equal(again.isAlternatingDeployment(), false);
}));
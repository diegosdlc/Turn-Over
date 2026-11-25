import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCSV } from '../src/i18n/index.js';
import { GameState } from '../src/core/GameState.js';
import { getLevel } from '../src/content/levels/index.js';
import { deployEnemyWave } from '../src/ai/DeploymentAI.js';
import { playerPresetBandForLevel } from '../src/content/balance.js';
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
    assert.ok(state.deploymentRoundPlaced('enemy') > 0);
    assert.ok(state.deploymentRoundPlaced('enemy') <= state.deploymentRoundQuota('enemy'));
    assert.equal(state.finishEnemyDeploymentRound(), true);
    assert.equal(state.deploymentTurn, 'player');
    assert.equal(placePlayers(state, 1), 1);
    assert.ok(state.deploymentRoundPlaced('player') > 0);
    assert.ok(state.deploymentRoundPlaced('player') <= state.deploymentRoundQuota('player'));
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
    assert.deepEqual(quotas, [7, 7, 7], 'point cap does not depend on roster size');
  }
  const noKing = { ...level, deployment: { ...level.deployment, initialEnemyPieceTypes: ['missing'] } };
  const state = new GameState(noKing);
  assert.equal(state.deploymentRoster('enemy').filter(unit => !unit.inReserve).length, 1);
  const plan = state.enemyDeploymentPlan();
  assert.equal(plan.waves.flat().length, state.deploymentRoster('enemy').length - 1);
  assert.ok(plan.waves.every(wave => wave.length > 0));
  assert.equal(state.deploymentRoundQuota('enemy'), plan.quota);
});

test('player can place multiple cheap pieces, limited only by points per round', () => {
  const base = getLevel('tutorial-01');
  const pawn = base.units.find(unit => unit.team === 'player' && unit.pieceType === 'pawn');
  const players = Array.from({ length: 6 }, (_, i) => ({ ...pawn, id: 'pawn-' + i }));
  const state = new GameState({ ...base, units: [...players, ...base.units.filter(unit => unit.team === 'enemy')] });
  deployEnemyWave(state, base);
  state.finishEnemyDeploymentRound();
  assert.equal(state.deploymentRoundQuota('player'), 7);
  assert.equal(placePlayers(state, 3), 3);
  assert.equal(state.deploymentRoundPlaced('player'), 6);
  const next = state.deploymentRoster('player').find(unit => unit.inReserve);
  assert.equal(state.canAffordDeploymentUnit(next), false, 'no fourth pawn despite remaining overall budget');
  const placed = state.deploymentUnits('player')[0];
  assert.equal(state.reserveDeploymentUnit(placed), true);
  assert.equal(state.deploymentRoundPlaced('player'), 4);
  assert.equal(state.canAffordDeploymentUnit(next), true, 'removing a piece refunds this wave');
  assert.equal(placePlayers(state, 1), 1);
  assert.equal(state.advanceDeploymentRound(), true);
  deployEnemyWave(state, base);
  state.finishEnemyDeploymentRound();
  assert.equal(state.deploymentRoundPlaced('player'), 0, 'round spend resets, previous placements stay locked');
  assert.equal(placePlayers(state, 2), 2);
  assert.equal(state.deploymentRoundPlaced('player'), 4);
  assert.equal(state.advanceDeploymentRound(), true);
  deployEnemyWave(state, base);
  state.finishEnemyDeploymentRound();
  assert.equal(placePlayers(state, 1), 1);
  assert.equal(state.deploymentRoundPlaced('player'), 2);
  assert.equal(state.beginPlay(), true);
});

test('enemy uses three affordable point-budgeted waves without leaving reserve units', () => {
  for (const id of ['tutorial-01', 'tutorial-02', 'tutorial-03', 'tutorial-04']) {
    const level = getLevel(id);
    const state = new GameState(level);
    const plan = state.enemyDeploymentPlan();
    assert.ok(plan.waves.every(wave => wave.length > 0), id);
    for (let round = 1; round <= 3; round++) {
      assert.equal(state.deploymentTurn, 'enemy');
      deployEnemyWave(state, level);
      const placed = state.deploymentUnits('enemy')
        .filter(unit => !state.isDeploymentCommitted(unit));
      assert.deepEqual(placed.map(unit => unit.id).sort(), [...plan.waves[round - 1]].sort(), id + ': wave ' + round);
      assert.ok(state.deploymentRoundPlaced('enemy') <= state.deploymentRoundQuota('enemy'));
      assert.equal(state.finishEnemyDeploymentRound(), true);
      if (round < 3) {
        assert.equal(state.advanceDeploymentRound(), true);
      }
    }
    assert.equal(state.deploymentRoster('enemy').some(unit => unit.inReserve), false);
  }
});

test('all four CSV playtest bands have an affordable player piece in every wave', () => {
  for (const id of ['tutorial-01', 'tutorial-02', 'tutorial-03', 'tutorial-04']) {
    const level = getLevel(id, { playerBand: playerPresetBandForLevel(id, 'green') });
    const state = new GameState(level);
    for (let round = 1; round <= 3; round++) {
      deployEnemyWave(state, level);
      assert.equal(state.finishEnemyDeploymentRound(), true, id + ': enemy wave ' + round);
      assert.equal(placePlayers(state, 1), 1, id + ': player wave ' + round);
      assert.ok(state.deploymentRoundPlaced('player') <= state.deploymentRoundQuota('player'));
      if (round < 3) assert.equal(state.advanceDeploymentRound(), true);
    }
    assert.equal(state.beginPlay(), true, id + ': combat starts');
  }
});

test('schema-7 saves resume deployment and preserve locked pieces', () => withLocalStorage(() => {
  const level = getLevel('tutorial-01');
  const store = new GameSessionStore('test:alternating', 7, ['green', 'red', 'yellow']);
  const state = new GameState(level);
  deployEnemyWave(state, level);
  state.finishEnemyDeploymentRound();
  assert.equal(placePlayers(state, 1), 1);
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
test('unaffordable reserves have a distinct localized status, including accessible labels', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const rows = new Map(parseCSV(readFileSync(new URL('../locales/texts.csv', import.meta.url), 'utf8')).map(row => [row[0], row]));
  assert.equal(rows.get('ui.deployment.status_insufficient_points')[2], 'Puntos insuficientes');
  assert.equal(rows.get('ui.deployment.status_insufficient_points')[3], 'Insufficient points');
  assert.equal(rows.get('ui.deployment.status_insufficient_points_lower')[2], 'puntos insuficientes');
  assert.ok(main.includes('const insufficientPoints = unit.inReserve && !affordable;'));
  assert.ok(main.includes("const statusKey = insufficientPoints ? 'ui.deployment.status_insufficient_points'"));
  assert.ok(main.includes("status: t(statusKey + '_lower')"));
  assert.ok(main.includes("statusLabel.textContent = unit.missionKing ? t('ui.mission.king_status') : t(statusKey);"));
});

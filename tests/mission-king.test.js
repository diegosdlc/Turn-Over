import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getLevel } from '../src/content/levels/index.js';
import { GameState } from '../src/core/GameState.js';
import { bandPointValue, parseBalanceTables } from '../src/content/balance.js';
import { victoryResultFor } from '../src/core/victory.js';
import { buildNextPlayerBand } from '../src/core/campaign.js';
import { missionTextFor } from '../src/content/mission.js';
import { restoreSessionState } from '../src/systems/GameSessionStore.js';

const levelIds = ['tutorial-01', 'tutorial-02', 'tutorial-03', 'tutorial-04'];
const files = Object.fromEntries(Object.entries({
  pieces: '../balance/pieces.csv',
  levels: '../balance/levels.csv',
  enemies: '../balance/enemy-formations.csv',
  obstacles: '../balance/obstacles.csv'
}).map(([key, path]) => [key, readFileSync(new URL(path, import.meta.url), 'utf8')]));

test('mission king is added only to escort and survival, without replacing the carried king', () => {
  for (const id of levelIds) {
    const level = getLevel(id);
    const mission = level.units.filter(unit => unit.missionKing);
    assert.equal(mission.length, ['tutorial-02','tutorial-04'].includes(id) ? 1 : 0);
    if (!mission.length) continue;
    assert.equal(mission[0].team, 'player');
    assert.equal(mission[0].pieceType, 'king');
    assert.equal(mission[0].evolutionProfile, null);
    assert.equal(level.units.filter(unit => unit.team === 'player' && unit.pieceType === 'king').length, 2);
    assert.equal(mission[0].y, 7);
  }
});

test('protected king is placed, locked, free and excluded from deployment quotas', () => {
  for (const id of ['tutorial-02', 'tutorial-04']) {
    const level = getLevel(id);
    const state = new GameState(level);
    const king = state.units.find(unit => unit.missionKing);
    assert.ok(king && !king.inReserve);
    assert.ok(state.active(king));
    assert.equal(state.deploymentUnitCost(king), 0);
    assert.equal(state.deploymentPointsSpent(), 0);
    assert.equal(state.isDeploymentCommitted(king), true);
    assert.equal(state.canDeployAt(king, 3, 7), false);
    assert.equal(state.reserveDeploymentUnit(king), false);
    assert.equal(state.deploymentRoundPlaced('player'), 0);
    const roster = state.deploymentRoster('player').filter(unit => !unit.missionKing);
    const quota = [1, 2, 3].map(round => { state.deploymentRound = round; return state.deploymentRoundQuota('player'); });
    assert.equal(quota.reduce((a,b)=>a+b,0), roster.length);
    state.deploymentRound = 3;
    assert.equal(state.deploymentComplete(), false, 'Mission king alone cannot finish deployment');
    const available = roster.find(unit => state.canAffordDeploymentUnit(unit));
    assert.ok(available);
    assert.ok(state.placeDeploymentUnit(available, 3, 7));
    assert.equal(state.deploymentPointsSpent(), bandPointValue([available]));
    assert.deepEqual([king.x, king.y], [2,7]);
  }
});

test('escort and survival end on the special king, ignoring another player king', () => {
  const escort = getLevel('tutorial-02');
  const escortState = new GameState(escort);
  escortState.phase = 'play';
  const target = escortState.units.find(unit => unit.missionKing);
  const carried = escortState.units.find(unit => unit.team === 'player' && unit.pieceType === 'king' && !unit.missionKing);
  carried.x = 3; carried.y = 0; carried.inReserve = false;
  assert.equal(victoryResultFor(escortState, escort), null, 'Campaign king at target does not win');
  target.y = 0;
  assert.equal(victoryResultFor(escortState, escort)?.winner, 'player');
  target.destroyed = true;
  assert.equal(victoryResultFor(escortState, escort)?.winner, 'enemy');
  assert.equal(victoryResultFor(escortState, escort)?.reason, 'king-captured');

  const survival = getLevel('tutorial-04');
  const survivalState = new GameState(survival);
  survivalState.phase = 'play';
  survivalState.roundsElapsed = survival.rules.surviveRounds - 1;
  const protectedUnit = survivalState.units.find(unit => unit.missionKing);
  protectedUnit.captured = true;
  protectedUnit.capturedBy = 'enemy';
  assert.equal(victoryResultFor(survivalState, survival)?.winner, 'enemy');
  survivalState.roundsElapsed = survival.rules.surviveRounds;
  assert.equal(victoryResultFor(survivalState, survival)?.winner, 'enemy');
  protectedUnit.captured = false;
  assert.equal(victoryResultFor(survivalState, survival)?.winner, 'player');
});

test('mission king is excluded from campaign evolution, recruitment and reserve carry', () => {
  for (const id of ['tutorial-02', 'tutorial-04']) {
    const level = getLevel(id);
    const state = new GameState(level);
    const king = state.units.find(unit => unit.missionKing);
    const next = buildNextPlayerBand(state.units, id);
    assert.ok(!next.some(unit => unit.missionKing));
    assert.ok(!next.some(unit => unit.id === king.id));
  }
});

test('session restoration preserves mission king and migrates legacy snapshots missing it', () => {
  const level = getLevel('tutorial-02');
  const state = new GameState(level);
  state.phase = 'play';
  const king = state.units.find(unit => unit.missionKing);
  king.captured = true;
  restoreSessionState(state, { units: structuredClone(state.units), phase: 'play' });
  assert.equal(state.units.filter(unit => unit.missionKing).length, 1);
  assert.equal(state.units.find(unit => unit.missionKing).captured, true);
  assert.equal(victoryResultFor(state, level)?.winner, 'enemy');

  const legacy = new GameState(level);
  restoreSessionState(legacy, { units: state.units.filter(unit => !unit.missionKing), phase: 'deployment' });
  assert.equal(legacy.units.filter(unit => unit.missionKing).length, 1);
  assert.equal(legacy.units.find(unit => unit.missionKing).inReserve, false);
});

test('invalid mission king coordinates are rejected by balance CSV validator', () => {
  assert.throws(() => parseBalanceTables({
    ...files, levels: files.levels.replace('tutorial-02,campaign,Nivel 2 · Escolta,level.tutorial_02,escort-king,tutorial-03,22,0,,3,0.02,450,2,7',
      'tutorial-02,campaign,Nivel 2 · Escolta,level.tutorial_02,escort-king,tutorial-03,22,0,,3,0.02,450,2,5')
  }), /Rey de misión inválido/);
  assert.throws(() => parseBalanceTables({
    ...files, levels: files.levels.replace('tutorial-04,campaign,Nivel 4 · Supervivencia,level.tutorial_04,survive,,30,,8,2,0.03,450,2,7',
      'tutorial-04,campaign,Nivel 4 · Supervivencia,level.tutorial_04,survive,,30,,8,2,0.03,450,2,3')
  }), /Rey de misión inválido/);
});

test('mission objective copy follows level rules and interpolates the parameters', () => {
  const translator = (key, params = {}) => key + JSON.stringify(params);
  const expected = ['mission.elimination','mission.escort_king','mission.capture_king','mission.survive_king'];
  for (const [i,id] of levelIds.entries()) {
    assert.ok(missionTextFor(getLevel(id), translator).startsWith(expected[i]));
  }
  assert.ok(missionTextFor(getLevel('tutorial-02'),translator).includes('"row":1'));
  assert.ok(missionTextFor(getLevel('tutorial-04'),translator).includes('"rounds":8'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getLevel } from '../src/content/levels/index.js';
import { GameState } from '../src/core/GameState.js';
import { victoryResultFor, objectiveScoreFor } from '../src/core/victory.js';
import { survivalProgressFor, countSkippedSurvivalTurn } from '../src/core/survival.js';
import { restoreSessionState } from '../src/systems/GameSessionStore.js';
import { bandPointValue } from '../src/content/balance.js';

function ready() {
  const level = getLevel('tutorial-04');
  const state = new GameState(level);
  state.phase = 'play';
  const survivor = state.units.find(unit => unit.team === 'player' && unit.pieceType !== 'king');
  survivor.inReserve = false;
  survivor.x = 1;
  survivor.y = 7;
  return { level, state, survivor };
}

for (const condition of ['capture', 'destroy']) {
  test('survival continues without a player king after ' + condition, () => {
    const {level,state,survivor} = ready();
    const king = state.units.find(unit => unit.team === 'player' && unit.pieceType === 'king');
    king.inReserve = false;
    if (condition === 'capture') {
      king.captured = true;
      king.capturedBy = 'enemy';
    } else {
      king.destroyed = true;
    }
    state.roundsElapsed = 7;
    assert.equal(state.active(survivor), true);
    assert.equal(victoryResultFor(state,level),null);
    assert.ok(Number.isFinite(objectiveScoreFor(state,level,'enemy')));
    state.roundsElapsed = 8;
    assert.deepEqual(victoryResultFor(state,level),{winner:'player',reason:'survived'});
  });
}

test('the entire player band must be eliminated for the enemy to win, even in the last round', () => {
  const {level,state,survivor} = ready();
  state.roundsElapsed = level.rules.surviveRounds;
  survivor.captured = true;
  survivor.capturedBy = 'enemy';
  assert.deepEqual(victoryResultFor(state,level),{winner:'enemy',reason:'elimination'});
});

test('survival retains early victory if all threats are eliminated', () => {
  const {level,state} = ready();
  for (const unit of state.units.filter(unit => unit.team === 'enemy')) unit.destroyed = true;
  assert.deepEqual(victoryResultFor(state,level),{winner:'player',reason:'elimination'});
});

test('survival starts at a deliberate budget disadvantage with no free protected king', () => {
  const {level,state} = ready();
  assert.equal(level.deployment.pointLimit,20);
  assert.equal(bandPointValue(level.units.filter(u => u.team === 'enemy')),30);
  assert.ok(state.units.every(unit => !unit.missionKing));
  assert.equal(level.rules.surviveRounds,8);
  assert.equal(level.rules.victory,'survive');
});

test('the remaining-round counter clamps, resumes, and does not appear on other missions', () => {
  const {level,state} = ready();
  assert.deepEqual(survivalProgressFor(state,level),{total:8,completed:0,remaining:8});
  state.roundsElapsed = 3;
  assert.deepEqual(survivalProgressFor(state,level),{total:8,completed:3,remaining:5});
  const resumed = new GameState(level);
  restoreSessionState(resumed,{units:structuredClone(state.units),phase:'play',roundsElapsed:3});
  assert.equal(survivalProgressFor(resumed,level).remaining,5);
  state.roundsElapsed = 20;
  assert.deepEqual(survivalProgressFor(state,level),{total:8,completed:8,remaining:0});
  assert.equal(survivalProgressFor(state,getLevel('tutorial-02')),null);
});

test('only a skipped enemy turn advances survival rounds', () => {
  const {level,state} = ready();
  assert.equal(countSkippedSurvivalTurn(state,level,'player'),false);
  assert.equal(state.roundsElapsed,0);
  assert.equal(countSkippedSurvivalTurn(state,level,'enemy'),true);
  assert.equal(state.roundsElapsed,1);
  assert.equal(countSkippedSurvivalTurn(state,getLevel('tutorial-02'),'enemy'),false);
  assert.equal(state.roundsElapsed,1);
});

test('old survival saves drop the obsolete mission king but preserve the band and countdown', () => {
  const {level,state} = ready();
  const oldKing={id:'tutorial-04-mission-king',pieceType:'king',team:'player',
    missionKing:true,x:2,y:7,inReserve:false,destroyed:false,captured:false};
  const saved={units:[...structuredClone(state.units),oldKing],
    phase:'play',currentTurn:'enemy',roundsElapsed:5,
    deploymentCommittedIds:[oldKing.id]};
  const restored = new GameState(level);
  restoreSessionState(restored,saved);
  assert.equal(restored.units.length,state.units.length);
  assert.ok(restored.units.every(unit => !unit.missionKing));
  assert.ok(!restored.deploymentCommittedIds.includes(oldKing.id));
  assert.equal(survivalProgressFor(restored,level).remaining,3);
});

test('the round counter is always visible during survival combat and localized', () => {
  const html = readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const js = readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  const css = readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
  const locale = readFileSync(new URL('../locales/texts.csv',import.meta.url),'utf8');
  assert.match(html,/id="survival-counter"/);
  assert.match(html,/id="survival-rounds-remaining"/);
  assert.match(html,/data-i18n="ui\.survival\.remaining"/);
  assert.match(js,/renderSurvivalCounter\(\)/);
  assert.match(js,/countSkippedSurvivalTurn/);
  assert.match(css,/\.survival-counter/);
  assert.match(locale,/"ui\.survival\.remaining"/);
  assert.match(locale,/"mission\.survive_band"/);
});

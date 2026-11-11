import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BALANCE, parseBalanceTables, bandPointValue, enemyBandForLevel, obstaclesForLevel } from '../src/content/balance.js';
import { getLevel, getNextLevel } from '../src/content/levels/index.js';
import { GameState } from '../src/core/GameState.js';
import { deployEnemyWave } from '../src/ai/DeploymentAI.js';

const sources = Object.fromEntries(Object.entries({
  pieces: '../balance/pieces.csv',
  levels: '../balance/levels.csv',
  enemies: '../balance/enemy-formations.csv',
  obstacles: '../balance/obstacles.csv',
  playerPresets: '../balance/player-presets.csv'
}).map(([key, path]) => [key, readFileSync(new URL(path, import.meta.url), 'utf8')]));
const ids = ['tutorial-01', 'tutorial-02', 'tutorial-03', 'tutorial-04'];
const victories = ['elimination', 'escort-king', 'capture-king', 'survive'];

test('four campaign levels use CSV budgets, objectives, enemy formations and obstacle positions', () => {
  assert.deepEqual(Object.values(BALANCE.levelDefinitions).filter(level => level.kind === 'campaign').map(level => level.id), ids);
  for (const [index, id] of ids.entries()) {
    const level = getLevel(id);
    assert.equal(level.rules.victory, victories[index]);
    assert.equal(level.nextLevelId, ids[index + 1] ?? null);
    assert.equal(level.deployment.pointLimit, BALANCE.levelPointLimits[id]);
    assert.equal(level.deployment.pointLimit, bandPointValue(enemyBandForLevel(id)));
    assert.deepEqual(level.units.filter(unit => unit.team === 'enemy'), enemyBandForLevel(id));
    assert.deepEqual(level.boardElements, obstaclesForLevel(id));
    assert.equal(level.deployment.mode, 'alternating');
    assert.equal(getNextLevel(level)?.id ?? null, ids[index + 1] ?? null);
    const occupied = new Set(level.units.filter(unit => unit.team === 'enemy').map(unit => unit.x + ',' + unit.y));
    assert.ok(level.boardElements.every(item => !item.blocking || !occupied.has(item.x + ',' + item.y)));
  }
  assert.equal(getLevel('tutorial-02').rules.targetRow, 0);
  assert.equal(getLevel('tutorial-04').rules.surviveRounds, 8);
  assert.ok(!Object.values(BALANCE.levelDefinitions).some(level => level.kind === 'lab'));
});

test('enemy wave deployment respects configured CSV formation squares', () => {
  for (const id of ids) {
    const level = getLevel(id);
    const state = new GameState(level);
    for (let round = 1; round <= 3; round++) {
      state.deploymentRound = round;
      state.deploymentTurn = 'enemy';
      deployEnemyWave(state, level);
      state.finishEnemyDeploymentRound();
    }
    for (const expected of level.units.filter(unit => unit.team === 'enemy')) {
      const actual = state.units.find(unit => unit.id === expected.id);
      assert.ok(actual && !actual.inReserve, id + ': missing ' + expected.id);
      assert.deepEqual([actual.x, actual.y], [expected.x, expected.y], id + ': position ' + expected.id);
    }
  }
});

test('editing a CSV cell changes parsed costs, budgets, formations and obstacles', () => {
  const edited = parseBalanceTables({
    ...sources,
    pieces: sources.pieces.replace('pawn,2,3', 'pawn,3,5'),
    levels: sources.levels.replace('tutorial-01,campaign,Nivel 1 · Destrucción,level.tutorial_01,elimination,tutorial-02,18', 'tutorial-01,campaign,Nivel 1 · Destrucción,level.tutorial_01,elimination,tutorial-02,19'),
    enemies: sources.enemies.replace('tutorial-01,enemy-queen,queen,green,south,base,4,0','tutorial-01,enemy-queen,queen,green,south,base,3,0'),
    obstacles: sources.obstacles.replace('tutorial-01,tutorial-blocker-c4,2,3', 'tutorial-01,tutorial-blocker-c4,1,3')
  });
  assert.equal(edited.pieceCosts.pawn.base, 3);
  assert.equal(edited.levelPointLimits['tutorial-01'], 19);
  assert.equal(edited.enemyFormations['tutorial-01'].find(unit => unit.id === 'enemy-queen').x, 3);
  assert.equal(edited.levelObstacles['tutorial-01'][0].x, 1);
});

test('invalid CSV headers, duplicated units and blocked formation squares are rejected', () => {
  assert.throws(() => parseBalanceTables({ ...sources, pieces: sources.pieces.replace('piece_type,base,evolved', 'type,base,evolved') }), /Cabecera/);
  assert.throws(() => parseBalanceTables({ ...sources, enemies: sources.enemies.replace(
    'tutorial-01,enemy-bishop,bishop,green,south,base,6,0',
    'tutorial-01,enemy-bishop,bishop,green,south,base,5,0'
  ) }), /duplicada/);
  assert.throws(() => parseBalanceTables({ ...sources, obstacles: sources.obstacles.replace('tutorial-01,tutorial-blocker-c4,2,3','tutorial-01,tutorial-blocker-c4,5,0') }), /encima de formación/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { BALANCE, parseBalanceTables, playerPresetBandForLevel } from '../src/content/balance.js';
import { getLevel, listMechanicLabs } from '../src/content/levels/index.js';
import { GameState } from '../src/core/GameState.js';
import { victoryResultFor } from '../src/core/victory.js';
import { escortGoalCells } from '../src/render/escortGoals.js';

const sources = Object.fromEntries(Object.entries({
  pieces: '../balance/pieces.csv',
  levels: '../balance/levels.csv',
  enemies: '../balance/enemy-formations.csv',
  obstacles: '../balance/obstacles.csv',
  playerPresets: '../balance/player-presets.csv'
}).map(([key, path]) => [key, readFileSync(new URL(path, import.meta.url), 'utf8')]));
const campaign = ['tutorial-01', 'tutorial-02', 'tutorial-03', 'tutorial-04'];

test('the reused lab dropdown lists exactly the four real campaign levels', () => {
  assert.deepEqual(listMechanicLabs().map(level => level.id), campaign);
  assert.ok(campaign.every(id => getLevel(id)?.deployment?.mode === 'alternating'));
  assert.equal(getLevel('deployment-budget-lab'), null);
  assert.equal(getLevel('facing-lab'), null);
});

test('CSV presets simulate an evolving and recruited band at every campaign level', () => {
  const counts = [4, 5, 6, 7];
  for (const [index, id] of campaign.entries()) {
    const band = playerPresetBandForLevel(id, 'green');
    const level = getLevel(id, { playerFactionId: 'green', playerBand: band });
    const state = new GameState(level);
    const playable = state.deploymentRoster('player').filter(unit => !unit.missionKing);
    assert.equal(playable.length, counts[index]);
    assert.ok(playable.every(unit => unit.inReserve), 'preselect roster, keep manual deployment');
    assert.ok(playable.some(unit => state.canAffordDeploymentUnit(unit)));
    assert.equal(new Set(playable.map(unit => unit.id)).size, playable.length);
    assert.equal(playable.filter(unit => unit.evolutionStage === 'evolved').length > 0, index > 0);
    assert.deepEqual(playable.map(unit => unit.id), BALANCE.playerPresetBands[id].map(unit => unit.id));
  }
});

test('special placeholder follows the selected faction, recruited pieces retain origin', () => {
  const red = playerPresetBandForLevel('tutorial-03', 'red');
  const yellow = playerPresetBandForLevel('tutorial-03', 'yellow');
  assert.equal(red.find(unit => unit.id === 'player-special').pieceType, 'rook');
  assert.equal(yellow.find(unit => unit.id === 'player-special').pieceType, 'knight');
  assert.equal(red.find(unit => unit.id === 'player-special').faction, 'red');
  assert.equal(red.find(unit => unit.id === 'player-recruit-pawn').faction, 'green');
  assert.throws(() => playerPresetBandForLevel('tutorial-01', 'unknown'), /Banda de prueba/);
});

test('editing a preset CSV row changes the parsed test roster without changing the real level', () => {
  const edited = parseBalanceTables({
    ...sources,
    playerPresets: sources.playerPresets.replace(
      'tutorial-02,player-recruit-pawn,pawn,green,north,base',
      'tutorial-02,player-recruit-pawn,knight,green,north,evolved'
    )
  });
  assert.equal(edited.playerPresetBands['tutorial-02'].at(-1).pieceType, 'knight');
  assert.equal(edited.playerPresetBands['tutorial-02'].at(-1).evolutionStage, 'evolved');
  assert.equal(getLevel('tutorial-02').id, 'tutorial-02');
});

test('bad test rosters fail validation instead of starting corrupt levels', () => {
  assert.throws(() => parseBalanceTables({ ...sources, playerPresets: sources.playerPresets.replace(
    'tutorial-02,player-recruit-pawn,pawn,green,north,base',
    'tutorial-02,player-king,pawn,green,north,base'
  ) }), /duplicada/);
  assert.throws(() => parseBalanceTables({ ...sources, playerPresets: sources.playerPresets.replace(
    'tutorial-01,player-king,king,player,north,base',
    'tutorial-01,player-king,dragon,player,north,base'
  ) }), /inválida/);
  assert.throws(() => parseBalanceTables({ ...sources, playerPresets: sources.playerPresets.split('\n')
    .filter(row => !row.startsWith('tutorial-04,')).join('\n') }), /Falta banda de prueba/);
});

test('escort highlights the true victory row and skips blocked destinations', () => {
  const level = getLevel('tutorial-02');
  const goals = escortGoalCells(level);
  assert.equal(goals.length, level.board.size);
  assert.ok(goals.every(cell => cell.y === level.rules.targetRow));
  assert.deepEqual(escortGoalCells(getLevel('tutorial-03')), []);
  assert.deepEqual(escortGoalCells({ ...level, rules: { ...level.rules, targetRow: 5 } }, [
    { blocking: true, x: 2, y: 5 }, { blocking: true, x: 6, y: 1 }
  ]).map(({ x, y }) => [x, y]), Array.from({ length: 8 }, (_, x) => x)
    .filter(x => x !== 2).map(x => [x, 5]));

  const state = new GameState(level);
  state.phase = 'play';
  const protectedKing = state.units.find(unit => unit.missionKing);
  protectedKing.x = 7;
  protectedKing.y = level.rules.targetRow;
  assert.equal(victoryResultFor(state, level)?.winner, 'player');
});

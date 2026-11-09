import test from 'node:test';
import assert from 'node:assert/strict';

import { PIECES } from '../src/content/bands.js';
import { getLevel, getNextLevel } from '../src/content/levels/index.js';
import { buildNextPlayerBand } from '../src/core/campaign.js';
import { isEvolved } from '../src/core/evolution.js';

function piece(pieceType, overrides = {}) {
  const definition = PIECES[pieceType];
  return {
    id: overrides.id ?? `player-${pieceType}`,
    team: overrides.team ?? 'player',
    faction: overrides.faction ?? 'green',
    facing: overrides.facing ?? 'north',
    name: definition.name,
    pieceType,
    fallbackGlyph: definition.fallbackGlyph,
    moveProfile: definition.moveProfile,
    evolutionProfile: definition.evolutionProfile,
    evolutionStage: 'base',
    x: 1,
    y: 1,
    captured: overrides.captured ?? false,
    destroyed: overrides.destroyed ?? false,
    capturedBy: overrides.capturedBy ?? null
  };
}

test('level 1 links to level 2', () => {
  const first = getLevel('tutorial-01', { playerFactionId: 'red' });
  assert.equal(first.nextLevelId, 'tutorial-02');
  assert.equal(getNextLevel(first).id, 'tutorial-02');
});

test('the next band keeps survivors and recruits, drops losses and evolves eligible pieces', () => {
  const units = [
    piece('king'),
    piece('queen'),
    piece('rook', { destroyed: true }),
    piece('pawn', { captured: true, capturedBy: 'enemy' }),
    piece('bishop', { id: 'enemy-bishop', team: 'enemy', faction: 'red', captured: true, capturedBy: 'player' })
  ];
  const band = buildNextPlayerBand(units, 'tutorial-01');

  assert.deepEqual(band.map(unit => unit.pieceType).sort(), ['bishop', 'king', 'queen']);
  assert.ok(band.every(unit => unit.team === 'player'));
  assert.ok(band.filter(unit => ['king', 'queen'].includes(unit.pieceType)).every(isEvolved));
  const recruit = band.find(unit => unit.id === 'player-recruit-tutorial-01-enemy-bishop');
  assert.ok(recruit && recruit.faction === 'red');
  assert.equal(isEvolved(recruit), false);

  const second = getLevel('tutorial-02', { playerFactionId: 'green', playerBand: band });
  const deployedBand = second.units.filter(unit => unit.team === 'player' && !unit.missionKing);
  assert.equal(deployedBand.length, band.length);
  assert.equal(isEvolved(deployedBand.find(unit => unit.id === recruit.id)), false);
  assert.ok(deployedBand.filter(unit => ['king', 'queen'].includes(unit.pieceType)).every(isEvolved));

  const afterAnotherVictory = buildNextPlayerBand(band, 'tutorial-02');
  assert.equal(isEvolved(afterAnotherVictory.find(unit => unit.id === recruit.id)), true);
});

test('level 2 uses the carried composition and resets it into deployment', () => {
  const band = buildNextPlayerBand([piece('knight'), piece('pawn')], 'tutorial-01');
  const second = getLevel('tutorial-02', { playerFactionId: 'yellow', playerBand: band });
  const playerUnits = second.units.filter(unit => unit.team === 'player' && !unit.missionKing);

  assert.deepEqual(playerUnits.map(unit => unit.pieceType).sort(), ['knight', 'pawn']);
  assert.ok(playerUnits.every(isEvolved));
  assert.equal(second.deployment.team, 'player');
  assert.deepEqual(second.deployment.rows, [6, 7]);
});

test('direct level 2 testing can create each faction special piece already evolved', () => {
  const yellow = getLevel('tutorial-02', { playerFactionId: 'yellow' });
  const knight = yellow.units.find(unit => unit.team === 'player' && unit.pieceType === 'knight');
  assert.ok(knight && isEvolved(knight));
});

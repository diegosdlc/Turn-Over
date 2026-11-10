import test from 'node:test';
import assert from 'node:assert/strict';

import { GameState, completeUnitMove } from '../src/core/GameState.js';
import { optionsFor } from '../src/core/rules.js';
import { restoreSessionState } from '../src/systems/GameSessionStore.js';
import { AssetRegistry } from '../src/systems/AssetRegistry.js';
import { FACTIONS } from '../src/content/factions.js';

const assets = new AssetRegistry(FACTIONS);

function pawn(team, y, facing, evolutionStage = 'base') {
  return {
    id: team + '-pawn',
    team,
    faction: 'green',
    pieceType: 'pawn',
    name: 'Peón',
    moveProfile: 'pawn',
    evolutionProfile: 'pawn',
    evolutionStage,
    facing,
    x: 3,
    y
  };
}

function level(units, size = 8) {
  return { id: 'pawn-facing-test', board: { size }, units, boardElements: [], specialTiles: [] };
}

function moveOneRow(state, subject, y, kind = 'move') {
  assert.ok(optionsFor(state, state.level, subject).some(option =>
    option.x === subject.x && option.y === y && option.kind === 'move'
  ), 'expected legal forward/backward movement to row ' + y);
  state.leaveOrigin(subject);
  state.completeMove(subject, { x: 3, y, kind });
}

test('player pawn turns toward south sprite on the top edge and north on the bottom edge', () => {
  const state = new GameState(level([pawn('player', 1, 'north')]));
  const subject = state.units[0];
  assert.equal(assets.pieceAsset(subject), './assets/pieces/green/pawn-north.webp');

  moveOneRow(state, subject, 0);
  assert.equal(subject.evolutionStage, 'evolved');
  assert.equal(subject.facing, 'south');
  assert.equal(assets.pieceAsset(subject), './assets/pieces/green/pawn-south.webp');

  for (let y = 1; y <= 7; y++) {
    moveOneRow(state, subject, y);
    assert.equal(subject.facing, y === 7 ? 'north' : 'south');
  }
  assert.equal(assets.pieceAsset(subject), './assets/pieces/green/pawn-north.webp');

  for (let y = 6; y >= 0; y--) {
    moveOneRow(state, subject, y);
    assert.equal(subject.facing, y === 0 ? 'south' : 'north');
  }
  assert.equal(assets.pieceAsset(subject), './assets/pieces/green/pawn-south.webp');
});

test('enemy pawn also turns at both edges, regardless of starting direction', () => {
  const state = new GameState(level([pawn('enemy', 6, 'south')]));
  state.currentTurn = 'enemy';
  const subject = state.units[0];

  moveOneRow(state, subject, 7);
  assert.equal(subject.evolutionStage, 'evolved');
  assert.equal(subject.facing, 'north');
  assert.equal(assets.pieceAsset(subject), './assets/pieces/green/pawn-north.webp');

  for (let y = 6; y >= 0; y--) moveOneRow(state, subject, y);
  assert.equal(subject.facing, 'south');
  assert.equal(assets.pieceAsset(subject), './assets/pieces/green/pawn-south.webp');
});

test('captures and destruction landing on either edge set pawn facing', () => {
  const testLevel = level([]);
  const subject = pawn('player', 1, 'north', 'evolved');
  assert.equal(completeUnitMove({}, testLevel, subject, {
    kind: 'capture', x: 2, y: 0, targetId: 'target'
  }), false);
  assert.equal(subject.facing, 'south');

  assert.equal(completeUnitMove({}, testLevel, subject, {
    kind: 'destroy', x: 2, y: 7, targetId: 'target2'
  }), false);
  assert.equal(subject.facing, 'north');
});

test('interior moves do not change facing; non-pawns are unaffected', () => {
  const testLevel = level([]);
  const subject = pawn('player', 2, 'south', 'evolved');
  completeUnitMove({}, testLevel, subject, { x: 3, y: 3 });
  assert.equal(subject.facing, 'south');

  const queen = { pieceType: 'queen', facing: 'north' };
  completeUnitMove({}, testLevel, queen, { x: 3, y: 0 });
  assert.equal(queen.facing, 'north');
});

test('pawn facing persists when a game session is restored', () => {
  const source = new GameState(level([pawn('player', 1, 'north')]));
  moveOneRow(source, source.units[0], 0);
  const savedState = JSON.parse(JSON.stringify({
    units: source.units, phase: source.phase, currentTurn: source.currentTurn,
    teamEvolution: source.teamEvolution
  }));

  const resumed = new GameState(source.level);
  restoreSessionState(resumed, savedState);
  assert.equal(resumed.units[0].facing, 'south');
  assert.equal(assets.pieceAsset(resumed.units[0]), './assets/pieces/green/pawn-south.webp');
});

test('board size controls both rebound rows', () => {
  const testLevel = level([], 6);
  const subject = pawn('player', 1, 'north', 'evolved');
  completeUnitMove({}, testLevel, subject, { x: 3, y: 0 });
  assert.equal(subject.facing, 'south');
  completeUnitMove({}, testLevel, subject, { x: 3, y: 5 });
  assert.equal(subject.facing, 'north');
});

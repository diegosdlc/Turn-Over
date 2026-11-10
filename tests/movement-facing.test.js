import test from 'node:test';
import assert from 'node:assert/strict';

import { GameState, applyRookShieldRejection, applyRoyalSwap, completeUnitMove } from '../src/core/GameState.js';
import { facingForDisplacement } from '../src/core/facing.js';
import { STANDARD_BOARD } from '../src/content/levels/shared.js';

function createUnit(pieceType, overrides = {}) {
  return {
    id: overrides.id ?? pieceType,
    pieceType,
    team: overrides.team ?? 'player',
    faction: 'green',
    facing: overrides.facing ?? 'south',
    x: overrides.x ?? 3,
    y: overrides.y ?? 3,
    moveProfile: pieceType,
    evolutionProfile: overrides.evolutionProfile ?? null,
    evolutionStage: overrides.evolutionStage ?? null
  };
}

function createLevel(units) {
  return {
    id: 'movement-facing-test',
    board: STANDARD_BOARD,
    units,
    rules: { victory: 'elimination' },
    boardElements: [],
    specialTiles: []
  };
}

test('both board axes influence visible north/south facing, including east/west', () => {
  const level = createLevel([]);
  assert.equal(facingForDisplacement(level, 3, 3, 4, 3, 'north'), 'south');
  assert.equal(facingForDisplacement(level, 3, 3, 2, 3, 'south'), 'north');
  assert.equal(facingForDisplacement(level, 3, 3, 3, 2, 'south'), 'north');
  assert.equal(facingForDisplacement(level, 3, 3, 3, 4, 'north'), 'south');
});

test('almost perfectly lateral screen movement preserves last facing', () => {
  const level = createLevel([]);
  // xAxis.y = 31.5, yAxis.y = 31.375; these differences are effectively horizontal.
  assert.equal(facingForDisplacement(level, 3, 3, 4, 2, 'north'), 'north');
  assert.equal(facingForDisplacement(level, 3, 3, 2, 4, 'south'), 'south');
  assert.equal(facingForDisplacement(level, 3, 3, 3, 3, 'south'), 'south');
  assert.equal(facingForDisplacement(level, null, null, 4, 3, 'north'), 'north');
});

test('every piece type automatically turns with movement in normal GameState', () => {
  for (const type of ['pawn', 'king', 'queen', 'bishop', 'knight', 'rook']) {
    const state = new GameState(createLevel([createUnit(type, { facing: 'south' })]));
    const unit = state.units[0];
    state.leaveOrigin(unit);
    state.completeMove(unit, { x: 2, y: 3 });
    assert.equal(unit.facing, 'north', type + ' should face up on westward board-axis movement');

    state.leaveOrigin(unit);
    state.completeMove(unit, { x: 3, y: 3 });
    assert.equal(unit.facing, 'south', type + ' should face down on eastward board-axis movement');
  }
});

test('diagonal capture and destruction update facing for any faction or team', () => {
  const level = createLevel([]);
  const piece = createUnit('knight', { team: 'enemy', facing: 'south' });
  assert.equal(completeUnitMove({}, level, piece, { x: 2, y: 2, kind: 'capture' }), false);
  assert.equal(piece.facing, 'north');
  completeUnitMove({}, level, piece, { x: 3, y: 3, kind: 'destroy' });
  assert.equal(piece.facing, 'south');
});

test('pawn changes facing on reversal before reaching either edge', () => {
  const state = new GameState(createLevel([createUnit('pawn', { facing: 'north' })]));
  const unit = state.units[0];
  state.leaveOrigin(unit);
  state.completeMove(unit, { x: 3, y: 4 });
  assert.equal(unit.facing, 'south');
  state.leaveOrigin(unit);
  state.completeMove(unit, { x: 3, y: 3 });
  assert.equal(unit.facing, 'north');
});

test('shield rejection uses attacker departure coordinates', () => {
  const state = new GameState(createLevel([
    createUnit('queen', { id: 'attacker', team: 'enemy', x: 0, y: 3, facing: 'north' }),
    createUnit('rook', { id: 'defender', x: 3, y: 3, facing: 'north',
      evolutionProfile: 'rook', evolutionStage: 'evolved' })
  ]));
  const [attacker, defender] = state.units;
  assert.equal(applyRookShieldRejection(state, state.level, attacker, defender), true);
  assert.equal(attacker.x, 4);
  assert.equal(attacker.facing, 'south');
});

test('royal swap also orients both swapped pieces', () => {
  const state = new GameState(createLevel([
    createUnit('king', { id: 'king', x: 2, y: 3, facing: 'north',
      evolutionProfile: 'royal', evolutionStage: 'evolved' }),
    createUnit('queen', { id: 'queen', x: 5, y: 3, facing: 'south',
      evolutionProfile: 'royal', evolutionStage: 'evolved' })
  ]));
  const [king, queen] = state.units;
  assert.equal(applyRoyalSwap(state, king, queen), true);
  assert.equal(king.facing, 'south');
  assert.equal(queen.facing, 'north');
});

test('an orthographic board does not rotate pieces on purely horizontal moves', () => {
  const level = createLevel([]);
  level.board = {
    size: 8,
    projection: { xAxis: { y: 0 }, yAxis: { y: 35 } }
  };
  assert.equal(facingForDisplacement(level, 1, 2, 2, 2, 'north'), 'north');
  assert.equal(facingForDisplacement(level, 2, 2, 2, 3, 'north'), 'south');
});

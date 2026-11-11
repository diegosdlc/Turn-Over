import test from 'node:test';
import assert from 'node:assert/strict';

import { GameState } from '../src/core/GameState.js';
import { isEvolved, moveProfileFor } from '../src/core/evolution.js';
import { optionsFor } from '../src/core/rules.js';
import { getLevel, listMechanicLabs } from '../src/content/levels/index.js';

function pawn(overrides = {}) {
  return {
    id: overrides.id ?? 'pawn',
    team: overrides.team ?? 'player',
    faction: 'green',
    name: 'Peón de prueba',
    pieceType: 'pawn',
    fallbackGlyph: '♟',
    moveProfile: 'pawn',
    evolutionProfile: 'pawn',
    evolutionStage: overrides.evolutionStage ?? 'base',
    facing: overrides.team === 'enemy' ? 'south' : 'north',
    x: overrides.x ?? 3,
    y: overrides.y ?? 3
  };
}

function level(units) {
  return {
    id: 'test-level',
    board: { size: 8 },
    units,
    boardElements: [],
    specialTiles: []
  };
}

function optionKeys(options) {
  return new Set(options.map(option => `${option.kind}:${option.x},${option.y}`));
}

test('a base pawn still moves and captures only toward the opposite edge', () => {
  const subject = pawn({ x: 3, y: 3 });
  const state = new GameState(level([
    subject,
    pawn({ id: 'forward-target', team: 'enemy', x: 2, y: 2 }),
    pawn({ id: 'back-target', team: 'enemy', x: 4, y: 4 })
  ]));
  const options = optionKeys(optionsFor(state, state.level, state.units[0]));

  assert.deepEqual(options, new Set(['move:3,2', 'capture:2,2']));
});

test('a player pawn evolves when a move or capture reaches the opposite edge', () => {
  const state = new GameState(level([pawn({ x: 3, y: 1 })]));
  const subject = state.units[0];

  state.leaveOrigin(subject);
  const evolvedNow = state.completeMove(subject, { kind: 'move', x: 3, y: 0 });

  assert.equal(evolvedNow, true);
  assert.equal(isEvolved(subject), true);
  assert.equal(moveProfileFor(subject), 'evolved-pawn');
  assert.ok(optionKeys(optionsFor(state, state.level, subject)).has('move:3,1'));

  const captureState = new GameState(level([pawn({ x: 4, y: 1 })]));
  const capturingPawn = captureState.units[0];
  captureState.leaveOrigin(capturingPawn);
  captureState.completeMove(capturingPawn, { kind: 'capture', targetId: 'target', x: 5, y: 0 });
  assert.equal(isEvolved(capturingPawn), true);
});

test('an enemy pawn evolves at the player edge', () => {
  const state = new GameState(level([pawn({ team: 'enemy', x: 4, y: 6 })]));
  state.currentTurn = 'enemy';
  const subject = state.units[0];

  state.leaveOrigin(subject);
  state.completeMove(subject, { kind: 'move', x: 4, y: 7 });

  assert.equal(isEvolved(subject), true);
  assert.ok(optionKeys(optionsFor(state, state.level, subject)).has('move:4,6'));
});

test('an evolved pawn moves both ways and captures on all four diagonals', () => {
  const units = [
    pawn({ evolutionStage: 'evolved', x: 3, y: 3 }),
    pawn({ id: 'north-west', team: 'enemy', x: 2, y: 2 }),
    pawn({ id: 'north-east', team: 'enemy', x: 4, y: 2 }),
    pawn({ id: 'south-west', team: 'enemy', x: 2, y: 4 }),
    pawn({ id: 'south-east', team: 'enemy', x: 4, y: 4 })
  ];
  const state = new GameState(level(units));
  const options = optionKeys(optionsFor(state, state.level, state.units[0]));

  assert.deepEqual(options, new Set([
    'move:3,2',
    'move:3,4',
    'capture:2,2',
    'capture:4,2',
    'capture:2,4',
    'capture:4,4'
  ]));
});

test('evolution remains active after the pawn leaves the evolution edge', () => {
  const state = new GameState(level([pawn({ evolutionStage: 'evolved', x: 3, y: 0 })]));
  const subject = state.units[0];

  state.leaveOrigin(subject);
  state.completeMove(subject, { kind: 'move', x: 3, y: 1 });

  assert.equal(isEvolved(subject), true);
  const options = optionKeys(optionsFor(state, state.level, subject));
  assert.ok(options.has('move:3,0'));
  assert.ok(options.has('move:3,2'));
});

test('the temporary playtest picker replaces all retired mechanics labs', () => {
  assert.deepEqual(listMechanicLabs().map(lab => lab.id), [
    'tutorial-01', 'tutorial-02', 'tutorial-03', 'tutorial-04'
  ]);
  for (const oldId of [
    'facing-lab', 'pawn-evolution-lab', 'deployment-budget-lab',
    'lab-victory-capture', 'lab-victory-escort', 'lab-victory-survive'
  ]) {
    assert.equal(getLevel(oldId), null);
  }
});

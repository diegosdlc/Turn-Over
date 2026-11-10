import test from 'node:test';
import assert from 'node:assert/strict';
import { getLevel } from '../src/content/levels/index.js';
import { GameState } from '../src/core/GameState.js';
import { legalActionsFor } from '../src/core/rules.js';
import { objectiveScoreFor, victoryResultFor } from '../src/core/victory.js';

function encounter(id) {
  const level = getLevel(id);
  const state = new GameState(level);
  state.phase = 'play';
  for (const unit of state.units) {
    if (unit.inReserve) {
      const source = level.units.find(piece => piece.id === unit.id);
      unit.x = source.x; unit.y = source.y; unit.inReserve = false;
    }
  }
  return {level,state};
}
function remove(unit, way) {
  if (way === 'capture') {
    unit.captured = true;
    unit.capturedBy = unit.team === 'player' ? 'enemy' : 'player';
  } else {
    unit.destroyed = true;
    unit.x = null; unit.y = null;
  }
}

for (const id of ['tutorial-03', 'scenario-capture-king']) {
  for (const way of ['capture','destroy']) {
    test(id + ': losing the player king by ' + way + ' does not end the game or disable surviving units', () => {
      const {state,level} = encounter(id);
      const king = state.units.find(unit => unit.team === 'player' && unit.pieceType === 'king');
      const survivor = state.units.find(unit => unit.team === 'player' && unit.pieceType !== 'king');
      assert.ok(king && survivor);
      remove(king,way);
      assert.equal(victoryResultFor(state,level),null);
      assert.equal(state.active(survivor),true);
      state.currentTurn = 'player';
      assert.ok(legalActionsFor(state,level).some(action => action.unitId === survivor.id));
    });

    test(id + ': the enemy king ' + way + ' ends the match even with defenders remaining', () => {
      const {state,level} = encounter(id);
      const king=state.units.find(unit=>unit.team==='enemy' && unit.pieceType==='king');
      assert.ok(state.units.some(unit => unit.team==='enemy' && unit.id !== king.id));
      remove(king,way);
      assert.deepEqual(victoryResultFor(state,level),{winner:'player',reason:'king-captured'});
    });
  }

  test(id + ': the enemy wins only after eliminating the entire attacking band', () => {
    const {state,level} = encounter(id);
    const player = state.units.filter(unit => unit.team === 'player');
    for (const unit of player.slice(0,-1)) remove(unit,'destroy');
    assert.equal(victoryResultFor(state,level),null);
    remove(player.at(-1),'destroy');
    assert.deepEqual(victoryResultFor(state,level),{winner:'enemy',reason:'elimination'});
  });

  test(id + ': objective scoring cares about enemy king but not a player king assassination', () => {
    const {state,level}=encounter(id);
    const initial=objectiveScoreFor(state,level,'enemy');
    const playerKing=state.units.find(unit=>unit.team==='player' && unit.pieceType==='king');
    remove(playerKing,'destroy');
    assert.equal(objectiveScoreFor(state,level,'enemy'),initial);
    const enemyKing=state.units.find(unit=>unit.team==='enemy' && unit.pieceType==='king');
    remove(enemyKing,'capture');
    assert.ok(objectiveScoreFor(state,level,'enemy') < initial);
  });
}

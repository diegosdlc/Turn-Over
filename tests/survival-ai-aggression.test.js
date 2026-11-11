import test from 'node:test';
import assert from 'node:assert/strict';
import { getLevel } from '../src/content/levels/index.js';
import { GameState } from '../src/core/GameState.js';
import { AIController, survivalAssaultScore } from '../src/ai/AIController.js';
import { parseBalanceTables } from '../src/content/balance.js';
import { readFileSync } from 'node:fs';

function preparedFight() {
  const level = getLevel('tutorial-04');
  const state = new GameState(level);
  state.phase = 'play';
  state.currentTurn = 'enemy';
  state.finished = false;
  state.combatActionsCompleted = 0;
  const unit = (team, type) => {
    const item = state.units.find(u => u.team === team && u.pieceType === type);
    assert.ok(item, team + ' ' + type);
    item.inReserve = false;
    item.captured = false;
    item.destroyed = false;
    return item;
  };
  const rook = unit('enemy', 'rook');
  const enemyQueen = unit('enemy', 'queen');
  const enemyKing = unit('enemy', 'king');
  const pawn = unit('player', 'pawn');
  const playerQueen = unit('player', 'queen');
  const playerKing = unit('player', 'king');
  Object.assign(rook, {x:3,y:3});
  Object.assign(enemyQueen, {x:0,y:0});
  Object.assign(enemyKing, {x:6,y:0});
  Object.assign(pawn, {x:3,y:4});
  Object.assign(playerQueen, {x:4,y:5});
  Object.assign(playerKing, {x:5,y:7});
  state.units = [rook,enemyQueen,enemyKing,pawn,playerQueen,playerKing];
  return {level,state,rook,enemyQueen,pawn,playerQueen};
}

test('survival AI has configurable extreme aggression without changing other missions', () => {
  const survival = getLevel('tutorial-04');
  assert.equal(survival.rules.victory,'survive');
  assert.equal(survival.ai.aggression,4);
  assert.equal(survival.ai.randomness,0);
  for (const id of ['tutorial-01','tutorial-02','tutorial-03']) {
    assert.equal(getLevel(id).ai.aggression,0,id);
  }
  const ai = new AIController({...survival.ai,team:'enemy'});
  assert.equal(ai.aggression,4);
});

test('giving up a valuable attacker is preferable to leaving a player pawn alive', () => {
  const {level,state,enemyQueen,pawn} = preparedFight();
  const ai = new AIController({team:'enemy',depth:2,randomness:0,aggression:4});
  const noSacrifice = survivalAssaultScore(state,level,ai);
  enemyQueen.destroyed = true;
  pawn.destroyed = true;
  const trade = survivalAssaultScore(state,level,ai);
  assert.ok(trade > noSacrifice, 'remove a pawn even at the cost of a queen');
});

test('irreversible destruction is more valuable than a rescuable capture', () => {
  const {level,state,pawn} = preparedFight();
  const ai = new AIController({team:'enemy',aggression:4});
  pawn.captured = true;
  pawn.capturedBy = 'enemy';
  const captured = survivalAssaultScore(state,level,ai);
  pawn.captured = false;
  pawn.capturedBy = null;
  pawn.destroyed = true;
  const destroyed = survivalAssaultScore(state,level,ai);
  assert.ok(destroyed > captured);
});

test('without an attack the AI is drawn toward the remaining targets', () => {
  const {level,state,rook} = preparedFight();
  const ai = new AIController({team:'enemy',aggression:4});
  rook.x = 1; rook.y = 1;
  const far = survivalAssaultScore(state,level,ai);
  rook.x = 3; rook.y = 2;
  const near = survivalAssaultScore(state,level,ai);
  assert.ok(near > far);
});

test('survival minimax willingly destroys a pawn even when the attacking rook can be recaptured', () => {
  const {level,state,pawn,rook} = preparedFight();
  const ai = new AIController({team:'enemy',depth:2,randomness:0,aggression:4});
  const priorTurn = state.currentTurn;
  const action = ai.chooseAction(state,level);
  assert.equal(action?.unitId,rook.id);
  assert.equal(action?.targetId,pawn.id);
  assert.equal(action?.kind,'destroy');
  assert.equal(state.currentTurn,priorTurn,'search must not change the live turn');
  assert.equal(state.units.find(u=>u.id===pawn.id)?.destroyed,false,'search must not destroy live units');
});

test('CSV validates aggression intensity to keep tactical tuning safe', () => {
  const sources = Object.fromEntries(Object.entries({
    pieces:'pieces.csv', levels:'levels.csv', enemies:'enemy-formations.csv',
    obstacles:'obstacles.csv', playerPresets:'player-presets.csv'
  }).map(([name,file]) => [name,readFileSync(new URL('../balance/'+file,import.meta.url),'utf8')]));
  assert.equal(parseBalanceTables(sources).levelDefinitions['tutorial-04'].aiAggression,4);
  assert.throws(() => parseBalanceTables({
    ...sources,levels:sources.levels.replace('450,,,10,4','450,,,10,6')
  }),/ai_aggression/);
});

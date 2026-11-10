import test from 'node:test';
import assert from 'node:assert/strict';
import { getLevel } from '../src/content/levels/index.js';
import { GameState } from '../src/core/GameState.js';
import { legalActionsFor } from '../src/core/rules.js';
import { validClosureCells, connectedAfterClosure, applyEncroachment } from '../src/core/encroachment.js';
import { victoryResultFor } from '../src/core/victory.js';
import { restoreSessionState } from '../src/systems/GameSessionStore.js';
import { AIController } from '../src/ai/AIController.js';

function ready(id = 'tutorial-02') {
  const level = getLevel(id);
  const state = new GameState(level);
  state.phase = 'play';
  state.currentTurn = 'player';
  for (const unit of state.units) {
    if (unit.inReserve) {
      unit.inReserve = false;
      const original = level.units.find(piece => piece.id === unit.id);
      unit.x = original.x; unit.y = original.y;
    }
  }
  return {level, state};
}

function movesFor(state,level,team) {
  state.currentTurn=team;
  return legalActionsFor(state,level);
}

test('the shrinking arena is configured by the four campaign CSV levels, not labs', () => {
  for (const id of ['tutorial-01','tutorial-02','tutorial-03','tutorial-04']) {
    assert.equal(getLevel(id).rules.encroachmentStartAction,10);
  }
  assert.equal(getLevel('scenario-escort-king').rules.encroachmentStartAction,undefined);
});

test('no closure before action 10 and one new wall per completed action thereafter', () => {
  const {level,state}=ready('tutorial-01');
  state.combatActionsCompleted=9;
  const existing=state.boardElements.length;
  assert.equal(applyEncroachment(state,level).status,'inactive');
  assert.equal(state.boardElements.length,existing);
  state.combatActionsCompleted=10;
  const result=applyEncroachment(state,level);
  assert.equal(result.status,'blocked');
  assert.equal(state.boardElements.length,existing+1);
  assert.equal(state.boardElements.at(-1).blocking,true);
  assert.equal(state.boardElements.at(-1).type,'encroachment');
  state.combatActionsCompleted=11;
  const again=applyEncroachment(state,level);
  assert.equal(again.status,'blocked');
  assert.equal(state.boardElements.length,existing+2);
  assert.notDeepEqual([result.element.x,result.element.y],[again.element.x,again.element.y]);
});

test('every available closing tile preserves both bands actions, army connectivity and escort route', () => {
  const {level,state}=ready();
  const before=structuredClone(state.boardElements);
  const existingUnits=state.units.filter(u=>!u.destroyed && Number.isInteger(u.x) && Number.isInteger(u.y))
    .map(u=>u.x+','+u.y);
  const candidates=validClosureCells(state,level);
  assert.ok(candidates.length);
  assert.deepEqual(state.boardElements,before,'candidate probing must not mutate the board');
  for(const candidate of candidates) {
    assert.ok(!existingUnits.includes(candidate.x+','+candidate.y));
    state.boardElements.push({x:candidate.x,y:candidate.y,blocking:true});
    assert.ok(connectedAfterClosure(state,level));
    assert.ok(movesFor(state,level,'player').length>0);
    assert.ok(movesFor(state,level,'enemy').length>0);
    state.boardElements.pop();
  }
});

test('a tile occupied only by a frozen prisoner never becomes a wall', () => {
  const {state,level}=ready('tutorial-01');
  const prisoner=state.units.find(u=>u.team==='player' && u.pieceType==='pawn');
  prisoner.inReserve=false;
  prisoner.captured=true;
  prisoner.x=7; prisoner.y=4;
  const candidates=validClosureCells(state,level);
  assert.ok(!candidates.some(c=>c.x===7 && c.y===4));
});

test('if no tile can close, the mechanic reports a loss instead of blocking a piece', () => {
  const {state,level}=ready('tutorial-01');
  state.units=state.units.filter(u=>u.pieceType==='king').slice(0,2);
  state.units[0].team='player';
  state.units[0].x=0;state.units[0].y=0;
  state.units[1].team='enemy';
  state.units[1].x=1;state.units[1].y=1;
  state.boardElements=[];
  const tiny={...level,board:{...level.board,size:2},rules:{...level.rules,encroachmentStartAction:10}};
  state.phase='play';state.combatActionsCompleted=10;
  state.boardElements.push({x:0,y:1,blocking:true},{x:1,y:0,blocking:true});
  assert.deepEqual(validClosureCells(state,tiny),[]);
  assert.equal(applyEncroachment(state,tiny).status,'trapped');
  assert.equal(state.boardElements.length,2);
});

test('closing a corridor is rejected if it separates king from goal', () => {
  const {level,state}=ready('tutorial-02');
  // Keep a single continuous corridor between the special king and its goal.
  const king=state.units.find(u=>u.missionKing);
  const enemy=state.units.find(u=>u.team==='enemy' && u.pieceType==='king');
  state.units=[king,enemy];
  king.x=0;king.y=3;
  enemy.x=0;enemy.y=0;
  state.boardElements=[];
  const narrow={...level,board:{...level.board,size:4},rules:{...level.rules,targetRow:0}};
  for(let y=0;y<4;y++)for(let x=0;x<4;x++)if(x>0)state.boardElements.push({x,y,blocking:true});
  assert.equal(connectedAfterClosure(state,narrow),true);
  state.boardElements.push({x:0,y:2,blocking:true});
  assert.equal(connectedAfterClosure(state,narrow),false);
  state.boardElements.pop();
  assert.ok(!validClosureCells(state,narrow).some(c=>c.x===0&&c.y===2));
});

test('closing the board is repeatable and survives session restoration', () => {
  const {level,state}=ready('tutorial-01');
  state.combatActionsCompleted=10;
  const first=applyEncroachment(state,level);
  const saved={
    units:structuredClone(state.units),phase:'play',currentTurn:'player',
    boardElements:structuredClone(state.boardElements),
    combatActionsCompleted:state.combatActionsCompleted,
    encroachmentSeed:state.encroachmentSeed
  };
  const resumed=new GameState(level);
  restoreSessionState(resumed,saved);
  assert.equal(resumed.combatActionsCompleted,10);
  assert.deepEqual(resumed.boardElements,state.boardElements);
  assert.equal(resumed.encroachmentSeed,state.encroachmentSeed);
  state.combatActionsCompleted=11;resumed.combatActionsCompleted=11;
  assert.deepEqual(applyEncroachment(state,level),applyEncroachment(resumed,level));
  assert.equal(first.status,'blocked');
  assert.deepEqual(state.boardElements,resumed.boardElements);
});

test('victory is evaluated before closing the board; AI handles active obstacles', () => {
  const {level,state}=ready('tutorial-01');
  state.units.filter(u=>u.team==='enemy').forEach(u=>{u.destroyed=true;u.x=null;u.y=null;});
  assert.equal(victoryResultFor(state,level)?.winner,'player');
  assert.equal(applyEncroachment(state,level).status,'inactive');
  const fresh=ready('tutorial-01');
  fresh.state.combatActionsCompleted=9;
  fresh.state.currentTurn='enemy';
  const ai=new AIController({team:'enemy',depth:1,randomness:0});
  const before=structuredClone(fresh.state.boardElements);
  const action=ai.chooseAction(fresh.state,fresh.level);
  assert.ok(action);
  assert.deepEqual(fresh.state.boardElements,before,'search may not modify the real board');
});

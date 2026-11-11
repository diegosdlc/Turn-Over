import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BALANCE, parseBalanceTables, aiProfileForLevel } from '../src/content/balance.js';
import { getLevel } from '../src/content/levels/index.js';
import { GameState } from '../src/core/GameState.js';
import { AIController, profileTacticalScore, survivalAssaultScore } from '../src/ai/AIController.js';

const sources = Object.fromEntries(Object.entries({
  pieces: 'pieces.csv', levels: 'levels.csv', enemies: 'enemy-formations.csv',
  obstacles: 'obstacles.csv', playerPresets: 'player-presets.csv', aiProfiles: 'ai-profiles.csv'
}).map(([name,file]) => [name, readFileSync(new URL('../balance/' + file, import.meta.url), 'utf8')]));

const mapping = {
  'tutorial-01':'balanced',
  'tutorial-02':'interceptor',
  'tutorial-03':'defensive',
  'tutorial-04':'aggressive'
};

test('all five reusable tactical profiles are loaded and linked to campaign levels', () => {
  assert.deepEqual(Object.keys(BALANCE.aiProfiles), [
    'balanced','defensive','interceptor','hunter','aggressive'
  ]);
  for (const [id,name] of Object.entries(mapping)) {
    const level = getLevel(id);
    const profile = aiProfileForLevel(id);
    assert.equal(level.ai.profileId,name);
    assert.equal(level.ai.profileId,profile.id);
    assert.deepEqual(level.ai.weights,profile.weights);
    assert.deepEqual(level.ai.tactics,profile.tactics);
    assert.equal(level.ai.depth,BALANCE.levelDefinitions[id].aiDepth);
    assert.equal(level.ai.randomness,BALANCE.levelDefinitions[id].aiRandomness);
  }
  assert.equal(getLevel('tutorial-04').ai.aggression,4);
});

test('changing a profile value updates every level that selects it', () => {
  const edited = parseBalanceTables({
    ...sources, aiProfiles:sources.aiProfiles.replace(
      'defensive,2.5,0.9', 'defensive,3.5,0.9')
  });
  assert.equal(edited.aiProfiles.defensive.weights.material,3.5);
  assert.equal(edited.levelDefinitions['tutorial-03'].aiProfileId,'defensive');
  assert.equal(edited.aiProfiles.balanced.weights.material,1);
});

test('unknown/duplicate profiles, invalid columns and numerical weights fail validation', () => {
  assert.throws(() => parseBalanceTables({
    ...sources, levels:sources.levels.replace(',0,defensive', ',0,unknown-profile')
  }), /Perfil de IA desconocido/);
  assert.throws(() => parseBalanceTables({
    ...sources, aiProfiles:sources.aiProfiles + sources.aiProfiles.split('\n')[1] + '\n'
  }), /repetido/);
  assert.throws(() => parseBalanceTables({
    ...sources, aiProfiles:sources.aiProfiles.replace(
      'profile_id,material,captured', 'profile_id,importance,captured')
  }), /Cabecera/);
  assert.throws(() => parseBalanceTables({
    ...sources, aiProfiles:sources.aiProfiles.replace('aggressive,0.35', 'aggressive,-1')
  }), /aiProfiles/);
  assert.throws(() => parseBalanceTables({
    ...sources, aiProfiles:sources.aiProfiles.replace('aggressive,0.35', 'aggressive,NaN')
  }), /aiProfiles/);
});

test('defensive profile penalizes exposing its king, while balanced has no extra king penalty', () => {
  const level = getLevel('tutorial-03');
  const state = new GameState(level);
  state.phase='play';
  state.currentTurn='enemy';
  state.boardElements=[];
  const king=state.units.find(u => u.team === 'enemy' && u.pieceType === 'king');
  const queen=state.units.find(u => u.team === 'player' && u.pieceType === 'queen');
  assert.ok(king && queen);
  Object.assign(king, {x:4,y:4,inReserve:false,captured:false,destroyed:false});
  Object.assign(queen, {x:4,y:2,inReserve:false,captured:false,destroyed:false});
  state.units=[king,queen];
  const balanced=new AIController({team:'enemy',...BALANCE.aiProfiles.balanced});
  const defensive=new AIController({team:'enemy',...BALANCE.aiProfiles.defensive});
  assert.equal(profileTacticalScore(state,level,'enemy',balanced),0);
  assert.ok(profileTacticalScore(state,level,'enemy',defensive) < -400);
  assert.equal(state.currentTurn,'enemy');
});

test('hunter profile favors approaching prey more strongly than interceptor', () => {
  const level=getLevel('tutorial-01');
  const state=new GameState(level);
  state.phase='play';
  state.boardElements=[];
  const king=state.units.find(u=>u.team==='enemy' && u.pieceType==='king');
  const pawn=state.units.find(u=>u.team==='player' && u.pieceType==='pawn');
  Object.assign(king,{inReserve:false,captured:false,destroyed:false,x:0,y:0});
  Object.assign(pawn,{inReserve:false,captured:false,destroyed:false,x:7,y:7});
  state.units=[king,pawn];
  const hunter=new AIController({team:'enemy',...BALANCE.aiProfiles.hunter});
  const interceptor=new AIController({team:'enemy',...BALANCE.aiProfiles.interceptor});
  const hunterFar=profileTacticalScore(state,level,'enemy',hunter);
  const interceptorFar=profileTacticalScore(state,level,'enemy',interceptor);
  king.x=6;king.y=6;
  assert.ok(profileTacticalScore(state,level,'enemy',hunter)>hunterFar);
  assert.ok(profileTacticalScore(state,level,'enemy',interceptor)>interceptorFar);
});

test('survival still accepts sacrifices under the aggressive CSV profile', () => {
  const level=getLevel('tutorial-04');
  const state=new GameState(level);
  state.phase='play';
  state.currentTurn='enemy';
  state.boardElements=[];
  const king=state.units.find(u=>u.team==='enemy' && u.pieceType==='king');
  const queen=state.units.find(u=>u.team==='enemy' && u.pieceType==='queen');
  const pawn=state.units.find(u=>u.team==='player' && u.pieceType==='pawn');
  assert.ok(king && queen && pawn);
  Object.assign(king,{inReserve:false,x:7,y:0});
  Object.assign(queen,{inReserve:false,x:3,y:3});
  Object.assign(pawn,{inReserve:false,x:3,y:4});
  state.units=[king,queen,pawn];
  const ai=new AIController({team:'enemy',...level.ai});
  const before=survivalAssaultScore(state,level,ai);
  queen.destroyed=true;
  pawn.destroyed=true;
  assert.ok(survivalAssaultScore(state,level,ai)>before);
});

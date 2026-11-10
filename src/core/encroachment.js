import { legalActionsFor } from './rules.js';

// Board connectivity is intentionally geometric, independent of current occupancy:
// units can move away, but permanent walls must not separate armies or seal escort routes.
const DIRECTIONS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
const key = (x, y) => x + ',' + y;
const isActive = unit => unit && !unit.inReserve && !unit.destroyed && !unit.captured &&
  Number.isInteger(unit.x) && Number.isInteger(unit.y);

function components(state, level) {
  const size = level.board.size ?? 8;
  const blocked = new Set((state.boardElements ?? level.boardElements ?? [])
    .filter(element => element.blocking).map(element => key(element.x, element.y)));
  const visited = new Set();
  const found = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const start = key(x, y);
    if (blocked.has(start) || visited.has(start)) continue;
    const squares = new Set([start]);
    const queue = [[x,y]];
    visited.add(start);
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const [cx, cy] = queue[cursor];
      for (const [dx,dy] of DIRECTIONS) {
        const nx=cx+dx, ny=cy+dy, k=key(nx,ny);
        if (nx<0 || ny<0 || nx>=size || ny>=size || blocked.has(k) || visited.has(k)) continue;
        visited.add(k);
        squares.add(k);
        queue.push([nx,ny]);
      }
    }
    found.push(squares);
  }
  return found;
}

function liveActions(state, level, team) {
  const previousTurn = state.currentTurn;
  state.currentTurn = team;
  try {
    return legalActionsFor(state, level).length;
  } finally {
    state.currentTurn = previousTurn;
  }
}

export function connectedAfterClosure(state, level) {
  const active = state.units.filter(isActive);
  const playerCells = active.filter(u=>u.team==='player').map(u=>key(u.x,u.y));
  const enemyCells = active.filter(u=>u.team==='enemy').map(u=>key(u.x,u.y));
  if (!playerCells.length || !enemyCells.length) return false;
  const regions = components(state, level);
  // Prevent any active piece from becoming isolated from its own army's contested region.
  const contested = regions.find(region =>
    playerCells.some(cell=>region.has(cell)) && enemyCells.some(cell=>region.has(cell)));
  if (!contested || !active.every(unit => contested.has(key(unit.x,unit.y)))) return false;

  if (level.rules?.victory === 'escort-king') {
    const mission = active.find(unit=>unit.team==='player' && unit.missionKing) ??
      active.find(unit=>unit.team==='player' && unit.pieceType==='king');
    if (!mission) return false;
    const row = Number.isInteger(level.rules.targetRow) ? level.rules.targetRow : 0;
    const region = regions.find(cells=>cells.has(key(mission.x,mission.y)));
    if (!region || ![...region].some(cell=>Number(cell.split(',')[1])===row)) return false;
  }
  return true;
}

export function validClosureCells(state, level) {
  if (state.phase !== 'play' || state.finished) return [];
  const size = level.board.size ?? 8;
  const occupied = new Set(state.units.filter(u=>(!u.destroyed || u.captured) &&
      Number.isInteger(u.x) && Number.isInteger(u.y) && !u.inReserve)
    .map(u=>key(u.x,u.y)));
  const blocked = new Set((state.boardElements ?? level.boardElements ?? [])
    .map(element=>key(element.x,element.y)));
  const candidates = [];
  if (liveActions(state,level,'player')===0 || liveActions(state,level,'enemy')===0) return [];
  if (!connectedAfterClosure(state,level)) return [];

  if (!state.boardElements) state.boardElements = [...(level.boardElements ?? [])];
  for (let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const cell=key(x,y);
    if (occupied.has(cell) || blocked.has(cell)) continue;
    const obstacle={ id:'encroachment-probe',type:'encroachment',blocking:true,x,y };
    state.boardElements.push(obstacle);
    try {
      if (!connectedAfterClosure(state,level)) continue;
      if (liveActions(state,level,'player') && liveActions(state,level,'enemy')) {
        candidates.push({x,y});
      }
    } finally {
      state.boardElements.pop();
    }
  }
  return candidates;
}

function nextSeed(seed) {
  let x=(seed>>>0) || 0x9e3779b9;
  x^=x<<13; x^=x>>>17; x^=x<<5;
  return x>>>0;
}

export function applyEncroachment(state, level) {
  const start=level.rules?.encroachmentStartAction;
  if (!Number.isInteger(start) || state.combatActionsCompleted < start || state.phase!=='play' || state.finished) {
    return {status:'inactive'};
  }
  const cells=validClosureCells(state,level);
  if (!cells.length) return {status:'trapped'};
  state.encroachmentSeed=nextSeed(state.encroachmentSeed);
  const chosen=cells[state.encroachmentSeed%cells.length];
  if (!state.boardElements) state.boardElements=[...(level.boardElements ?? [])];
  const element={
    id:'encroachment-'+state.combatActionsCompleted,
    type:'encroachment',blocking:true,
    name:'Casilla cerrada',i18nNameKey:'ui.encroachment.blocked',
    className:'encroachment-blocker',
    x:chosen.x,y:chosen.y,
    fallbackGlyph:'×'
  };
  state.boardElements.push(element);
  return {status:'blocked',element};
}

import { legalActionsFor } from './rules.js';
import { victoryResultFor } from './victory.js';

// Geometric connectivity ignores movable units but respects every permanent wall.
const DIRECTIONS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
const key = (x,y) => x + ',' + y;
const onBoard = (unit) => unit && !unit.inReserve && !unit.destroyed &&
  Number.isInteger(unit.x) && Number.isInteger(unit.y);
const activeUnit = unit => onBoard(unit) && !unit.captured;

function components(state, level) {
  const size = level.board.size ?? 8;
  const blocked = new Set((state.boardElements ?? level.boardElements ?? [])
    .filter(element => element.blocking).map(element => key(element.x, element.y)));
  const visited = new Set();
  const found = [];
  for (let y=0; y<size; y++) for (let x=0; x<size; x++) {
    const start = key(x,y);
    if (blocked.has(start) || visited.has(start)) continue;
    const squares = new Set([start]);
    const queue = [[x,y]];
    visited.add(start);
    for (let index=0; index<queue.length; index++) {
      const [cx,cy] = queue[index];
      for (const [dx,dy] of DIRECTIONS) {
        const nx=cx+dx, ny=cy+dy, next=key(nx,ny);
        if (nx<0 || ny<0 || nx>=size || ny>=size || blocked.has(next) || visited.has(next)) continue;
        visited.add(next);
        squares.add(next);
        queue.push([nx,ny]);
      }
    }
    found.push(squares);
  }
  return found;
}

function actionsForTeam(state, level, team) {
  const original = state.currentTurn;
  state.currentTurn = team;
  try {
    return legalActionsFor(state, level).length;
  } finally {
    state.currentTurn = original;
  }
}

export function connectedAfterClosure(state, level) {
  const active = state.units.filter(activeUnit);
  const player = active.filter(u=>u.team==='player');
  const enemy = active.filter(u=>u.team==='enemy');
  if (!player.length || !enemy.length) return false;
  const regions = components(state, level);
  const contested = regions.find(region =>
    player.some(u=>region.has(key(u.x,u.y))) && enemy.some(u=>region.has(key(u.x,u.y))));
  if (!contested || !active.every(unit => contested.has(key(unit.x,unit.y)))) return false;

  if (level.rules?.victory === 'escort-king') {
    const mission = player.find(unit => unit.missionKing) ?? player.find(unit => unit.pieceType==='king');
    if (!mission) return false;
    const targetRow = Number.isInteger(level.rules.targetRow) ? level.rules.targetRow : 0;
    if (![...contested].some(cell => Number(cell.split(',')[1]) === targetRow)) return false;
  }
  return true;
}

function destroyAt(state, x, y) {
  const victims = state.units.filter(unit => onBoard(unit) && unit.x===x && unit.y===y);
  for (const unit of victims) {
    unit.destroyed=true;
    unit.captured=false;
    unit.capturedBy=null;
    unit.recruitedBy=null;
    unit.inReserve=false;
    unit.x=null;
    unit.y=null;
  }
  return victims;
}

function cellInside(level, x, y) {
  const size=level.board.size ?? 8;
  return Number.isInteger(x) && Number.isInteger(y) && x>=0 && y>=0 && x<size && y<size;
}

// Evaluate the exact post-collapse state, including any active units or prisoners
// destroyed on the warned square. Restore every field after the probe.
export function canCloseCell(state, level, x, y) {
  if (!cellInside(level,x,y) || (state.boardElements ?? level.boardElements ?? [])
    .some(item => item.x===x && item.y===y)) return false;
  const victims = state.units.filter(unit => onBoard(unit) && unit.x===x && unit.y===y);
  const original = victims.map(unit => ({
    unit, x:unit.x, y:unit.y, destroyed:unit.destroyed, captured:unit.captured,
    capturedBy:unit.capturedBy, recruitedBy:unit.recruitedBy, inReserve:unit.inReserve
  }));
  if (!state.boardElements) state.boardElements=[...(level.boardElements ?? [])];
  const probe={id:'encroachment-probe',type:'encroachment',blocking:true,x,y};
  state.boardElements.push(probe);
  try {
    destroyAt(state,x,y);
    if (victoryResultFor(state,level)) return true;
    return connectedAfterClosure(state,level) &&
      actionsForTeam(state,level,'player')>0 && actionsForTeam(state,level,'enemy')>0;
  } finally {
    state.boardElements.pop();
    for (const saved of original) Object.assign(saved.unit, {
      x:saved.x,y:saved.y,destroyed:saved.destroyed,captured:saved.captured,
      capturedBy:saved.capturedBy,recruitedBy:saved.recruitedBy,inReserve:saved.inReserve
    });
  }
}

// Warnings are issued only for initially empty squares: no piece is doomed
// without having had a chance to see the warning. Pieces may move into one later.
export function validClosureCells(state, level) {
  if (state.phase!=='play' || state.finished) return [];
  const occupied=new Set(state.units.filter(onBoard).map(unit=>key(unit.x,unit.y)));
  const size=level.board.size ?? 8;
  const cells=[];
  for (let y=0;y<size;y++) for(let x=0;x<size;x++) {
    if (!occupied.has(key(x,y)) && canCloseCell(state,level,x,y)) cells.push({x,y});
  }
  return cells;
}

function nextSeed(seed) {
  let value=(seed>>>0) || 0x9e3779b9;
  value^=value<<13;
  value^=value>>>17;
  value^=value<<5;
  return value>>>0;
}

function announce(state, level) {
  const cells=validClosureCells(state,level);
  if (!cells.length) {
    state.pendingClosure=null;
    return {status:'trapped'};
  }
  state.encroachmentSeed=nextSeed(state.encroachmentSeed);
  const chosen=cells[state.encroachmentSeed%cells.length];
  state.pendingClosure={...chosen,forAction:state.combatActionsCompleted+1};
  return {status:'warning',warning:state.pendingClosure};
}

function closeWarnedCell(state, level, warning) {
  const {x,y}=warning;
  const victims=destroyAt(state,x,y);
  if (!state.boardElements) state.boardElements=[...(level.boardElements ?? [])];
  const element={
    id:'encroachment-'+state.combatActionsCompleted,
    type:'encroachment',blocking:true,
    name:'Casilla cerrada',i18nNameKey:'ui.encroachment.blocked',
    className:'encroachment-blocker',
    x,y,scale:0.65,insetX:0.21,insetY:0.18,yOffset:-0.05,
    fallbackGlyph:'×'
  };
  state.boardElements.push(element);
  state.pendingClosure=null;
  return {status:'blocked',element,destroyedUnitIds:victims.map(unit=>unit.id)};
}

// Call only after an action completes, before changing turn. A warning is shown
// after action start-1 and resolves after the NEXT action, not immediately.
export function applyEncroachment(state, level) {
  const start=level.rules?.encroachmentStartAction;
  if (!Number.isInteger(start) || state.phase!=='play' || state.finished ||
      (state.combatActionsCompleted < start-1 && !state.pendingClosure)) {
    return {status:'inactive'};
  }

  const warning=state.pendingClosure;
  if (!warning || warning.forAction !== state.combatActionsCompleted) {
    if (warning && warning.forAction > state.combatActionsCompleted) return {status:'warning',warning};
    // Includes legacy saves with no previous warning.
    return announce(state,level);
  }

  if (!canCloseCell(state,level,warning.x,warning.y)) {
    // Never silently change the warned square or break connectivity. Rewarn
    // another legal tile for the next action instead.
    return announce(state,level);
  }

  const result=closeWarnedCell(state,level,warning);
  if (victoryResultFor(state,level)) return result; // No next warning after a normal victory.
  const next=announce(state,level);
  return next.status==='trapped' ? {...result,nextWarning:null,noNextCandidate:true} :
    {...result,nextWarning:next.warning};
}

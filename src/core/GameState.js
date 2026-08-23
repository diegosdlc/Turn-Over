import {
  applyEvolutionEvent,
  createTeamEvolutionState,
  evolutionCapabilitiesFor,
  initialEvolutionState,
  normalizeEvolutionStage
} from './evolution.js?v=20260821-evolution-3';
import { pointCostForUnit } from '../content/balance.js?v=20260821-budget-1';

const NEXT_TEAM = Object.freeze({ player: 'enemy', enemy: 'player' });
const OPPOSITE_FACING = Object.freeze({ north: 'south', south: 'north' });

function clone(value) {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function physicallyActive(unit) {
  return Boolean(unit && !unit.captured && !unit.destroyed && !unit.inReserve);
}

export function completeUnitMove(state, level, unit, action) {
  if (!unit || !Number.isInteger(action?.x) || !Number.isInteger(action?.y)) return false;
  unit.x = action.x;
  unit.y = action.y;
  return applyEvolutionEvent({
    state,
    level,
    unit,
    event: {
      type: 'move-completed',
      kind: action.kind ?? 'move',
      x: action.x,
      y: action.y,
      targetId: action.targetId ?? null
    }
  });
}

function releaseFriendlyPrisoners(state, x, y, team) {
  state.units
    .filter(piece => piece.captured && !piece.destroyed && piece.x === x && piece.y === y && piece.team === team)
    .forEach(piece => {
      piece.captured = false;
      piece.capturedBy = null;
    });
}

export function applyRookShieldRejection(state, level, attacker, target) {
  if (!physicallyActive(attacker) || !physicallyActive(target)) return false;
  if (!evolutionCapabilitiesFor(target).rejectsFirstAttack) return false;
  if ((target.evolutionState?.shieldCharges ?? 0) < 1) return false;

  target.evolutionState.shieldCharges -= 1;
  const dx = Math.sign(target.x - attacker.x);
  const dy = Math.sign(target.y - attacker.y);
  const x = target.x + dx;
  const y = target.y + dy;
  const size = level.board.size ?? 8;
  const blocked = x < 0 || x >= size || y < 0 || y >= size ||
    level.boardElements?.some(element => element.blocking && element.x === x && element.y === y) ||
    state.units.some(unit => physicallyActive(unit) && unit.x === x && unit.y === y) ||
    state.units.some(unit => unit.captured && !unit.destroyed && unit.x === x && unit.y === y);

  if (!blocked) {
    const originX = attacker.x;
    const originY = attacker.y;
    attacker.x = null;
    attacker.y = null;
    releaseFriendlyPrisoners(state, originX, originY, attacker.team);
    completeUnitMove(state, level, attacker, { kind: 'rejected', x, y });
  }
  return true;
}

export function applyRoyalSwap(state, first, second) {
  if (!physicallyActive(first) || !physicallyActive(second) || first.team !== second.team) return false;
  if ((state.teamEvolution?.[first.team]?.royalSwapCharges ?? 0) < 1) return false;
  if (!evolutionCapabilitiesFor(first).royalSwap || !evolutionCapabilitiesFor(second).royalSwap) return false;
  if (!['king', 'queen'].includes(first.pieceType) || !['king', 'queen'].includes(second.pieceType) || first.pieceType === second.pieceType) return false;

  const firstPosition = { x: first.x, y: first.y };
  const secondPosition = { x: second.x, y: second.y };
  first.x = null;
  first.y = null;
  second.x = null;
  second.y = null;
  first.x = secondPosition.x;
  first.y = secondPosition.y;
  second.x = firstPosition.x;
  second.y = firstPosition.y;
  state.teamEvolution[first.team].royalSwapCharges -= 1;
  return true;
}

export class GameState {
  constructor(level) {
    this.level = level;
    this.reset();
  }

  reset() {
    this.units = clone(this.level.units).map(unit => ({
      ...unit,
      evolutionStage: normalizeEvolutionStage(unit),
      evolutionState: initialEvolutionState(unit),
      inReserve: false,
      captured: false,
      destroyed: false,
      capturedBy: null,
      recruitedBy: null
    }));
    this.selectedId = null;
    this.currentTurn = 'player';
    this.roundsElapsed = 0;
    this.finished = false;
    this.pendingCapture = null;
    this.phase = this.level.deployment ? 'deployment' : 'play';

    if (this.isDeploying()) {
      const team = this.deploymentTeam();
      const usesBudget = this.deploymentPointLimit() != null;
      this.units
        .filter(unit => unit.team === team)
        .forEach(unit => {
          unit.x = null;
          unit.y = null;
          unit.inReserve = usesBudget;
        });
    }

    this.teamEvolution = createTeamEvolutionState(this.units.filter(unit => !unit.inReserve));
  }

  active(unit) {
    if (!physicallyActive(unit)) return false;
    if (this.finished) return true;

    const victory = this.level?.rules?.victory ?? 'elimination';
    if (victory === 'capture-king') {
      const kingAlive = this.units.some(piece => physicallyActive(piece) && piece.team === unit.team && piece.pieceType === 'king');
      if (!kingAlive) return false;
    }

    if (victory === 'escort-king') {
      const playerKing = this.units.find(piece => physicallyActive(piece) && piece.team === 'player' && piece.pieceType === 'king');
      if (!playerKing && unit.team === 'player') return false;
      const targetRow = Number.isInteger(this.level?.rules?.targetRow) ? this.level.rules.targetRow : 0;
      if (playerKing?.y === targetRow && unit.team === 'enemy') return false;
    }

    if (victory === 'survive') {
      const rounds = Math.max(1, Number(this.level?.rules?.surviveRounds) || 1);
      if (this.roundsElapsed >= rounds && unit.team === 'enemy') return false;
    }

    return true;
  }

  activeAt(x, y) {
    return this.units.find(unit => this.active(unit) && unit.x === x && unit.y === y) ?? null;
  }

  prisonersAt(x, y) {
    return this.units.filter(unit => unit.captured && !unit.destroyed && unit.x === x && unit.y === y);
  }

  selected() {
    return this.units.find(unit => unit.id === this.selectedId) ?? null;
  }

  unresolvedPrisoners() {
    return this.units.filter(unit => unit.captured && !unit.destroyed);
  }

  setSelected(unitId) {
    this.selectedId = unitId;
  }

  clearSelection() {
    this.selectedId = null;
  }

  setFacing(unit, facing) {
    if (!unit || !OPPOSITE_FACING[facing]) return false;
    unit.facing = facing;
    return true;
  }

  turnAround(unit) {
    if (!unit || !OPPOSITE_FACING[unit.facing]) return false;
    unit.facing = OPPOSITE_FACING[unit.facing];
    return true;
  }

  isDeploying() {
    return this.phase === 'deployment';
  }

  deploymentTeam() {
    return this.level.deployment?.team ?? 'player';
  }

  deploymentPointLimit() {
    const limit = this.level.deployment?.pointLimit;
    return Number.isFinite(limit) && limit > 0 ? limit : null;
  }

  deploymentRoster() {
    const team = this.deploymentTeam();
    return this.units.filter(unit => unit.team === team && !unit.captured && !unit.destroyed);
  }

  deploymentUnitCost(unit) {
    return pointCostForUnit(unit);
  }

  deploymentPointsSpent() {
    return this.deploymentUnits().reduce((total, unit) => total + this.deploymentUnitCost(unit), 0);
  }

  deploymentPointsRemaining() {
    const limit = this.deploymentPointLimit();
    return limit == null ? Infinity : Math.max(0, limit - this.deploymentPointsSpent());
  }

  canAffordDeploymentUnit(unit) {
    if (!unit || unit.team !== this.deploymentTeam()) return false;
    if (!unit.inReserve) return true;
    const limit = this.deploymentPointLimit();
    return limit == null || this.deploymentPointsSpent() + this.deploymentUnitCost(unit) <= limit;
  }

  deploymentRows(unit = null) {
    const rows = Array.isArray(this.level.deployment?.rows) ? [...this.level.deployment.rows] : [];
    const depth = evolutionCapabilitiesFor(unit).deploymentDepth;
    if (!Number.isInteger(depth) || depth < 1) return rows;
    const size = this.level.board.size ?? 8;
    const advancedRows = unit.team === 'enemy'
      ? Array.from({ length: depth }, (_, index) => index)
      : Array.from({ length: depth }, (_, index) => size - 1 - index);
    return [...new Set([...rows, ...advancedRows])];
  }

  deploymentUnits() {
    const team = this.deploymentTeam();
    return this.units.filter(unit => this.active(unit) && unit.team === team);
  }

  isDeploymentCell(x, y, unit = null) {
    const size = this.level.board.size ?? 8;
    return Number.isInteger(x) && Number.isInteger(y) &&
      x >= 0 && x < size && y >= 0 && y < size &&
      this.deploymentRows(unit).includes(y);
  }

  deploymentCellBlocked(x, y, ignoredUnitId = null) {
    const occupied = this.activeAt(x, y);
    if (occupied && occupied.id !== ignoredUnitId) return true;
    return (this.level.boardElements ?? []).some(element => element.blocking && element.x === x && element.y === y);
  }

  canDeployAt(unit, x, y) {
    if (!this.isDeploying() || !unit || unit.team !== this.deploymentTeam()) return false;
    if (unit.inReserve && !this.canAffordDeploymentUnit(unit)) return false;
    if (!this.isDeploymentCell(x, y, unit)) return false;
    return !this.deploymentCellBlocked(x, y, unit.id);
  }

  placeDeploymentUnit(unit, x, y) {
    if (!this.canDeployAt(unit, x, y)) return false;
    unit.inReserve = false;
    unit.x = x;
    unit.y = y;
    return true;
  }

  reserveDeploymentUnit(unit) {
    if (!this.isDeploying() || !unit || unit.team !== this.deploymentTeam()) return false;
    unit.inReserve = true;
    unit.x = null;
    unit.y = null;
    if (this.selectedId === unit.id) this.clearSelection();
    return true;
  }

  deploymentComplete() {
    const units = this.deploymentUnits();
    if (!units.length) return false;
    const limit = this.deploymentPointLimit();
    if (limit != null && this.deploymentPointsSpent() > limit) return false;
    if (!units.every(unit => this.isDeploymentCell(unit.x, unit.y, unit) && !this.deploymentCellBlocked(unit.x, unit.y, unit.id))) return false;
    const occupiedCells = new Set(units.map(unit => `${unit.x},${unit.y}`));
    return occupiedCells.size === units.length;
  }

  beginPlay() {
    if (!this.isDeploying() || this.selected()?.inReserve || !this.deploymentComplete()) return false;
    this.phase = 'play';
    this.currentTurn = 'player';
    this.roundsElapsed = 0;
    this.teamEvolution = createTeamEvolutionState(this.units.filter(unit => this.active(unit)));
    this.clearSelection();
    return true;
  }

  releaseFriendlyPrisonerFrom(x, y, team) {
    if (x == null || y == null) return;
    this.prisonersAt(x, y)
      .filter(piece => piece.team === team)
      .forEach(piece => {
        piece.captured = false;
        piece.capturedBy = null;
      });
  }

  leaveOrigin(unit) {
    const originX = unit.x;
    const originY = unit.y;
    this.level.behavior?.beforeLeaveOrigin?.({ state: this, unit, x: originX, y: originY });
    unit.x = null;
    unit.y = null;
    this.releaseFriendlyPrisonerFrom(originX, originY, unit.team);
  }

  completeMove(unit, action) {
    const changed = completeUnitMove(this, this.level, unit, action);
    if (unit?.team === 'enemy') this.roundsElapsed += 1;
    return changed;
  }

  rejectAttack(attacker, target) {
    const rejected = applyRookShieldRejection(this, this.level, attacker, target);
    if (rejected && attacker?.team === 'enemy') this.roundsElapsed += 1;
    return rejected;
  }

  swapRoyalPair(first, second) {
    const swapped = applyRoyalSwap(this, first, second);
    if (swapped && first?.team === 'enemy') this.roundsElapsed += 1;
    return swapped;
  }

  changeTurn() {
    if (this.level.behavior?.beforeChangeTurn?.({ state: this }) === false) return;
    this.currentTurn = NEXT_TEAM[this.currentTurn];
  }
}

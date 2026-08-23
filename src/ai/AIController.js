import { legalActionsFor, optionsFor } from '../core/rules.js?v=20260821-evolution-3';
import { applyRookShieldRejection, applyRoyalSwap, completeUnitMove } from '../core/GameState.js?v=20260822-victory-1';
import { objectiveScoreFor, victoryResultFor } from '../core/victory.js?v=20260822-victory-1';

export class AIController {
  constructor(config = {}) {
    this.team = config.team ?? 'enemy';
    this.depth = config.depth ?? 2;
    this.randomness = config.randomness ?? 0.08;
    this.thinkDelayMs = config.thinkDelayMs ?? 450;
    this.values = {
      pawn: 100,
      knight: 320,
      bishop: 320,
      rook: 500,
      queen: 900,
      king: 1000,
      ...(config.pieceValues ?? {})
    };
    this.weights = {
      material: 1,
      captured: 0.65,
      mobility: 2,
      objective: 1,
      prisonerSafety: 0.8,
      rescuePotential: 0.55,
      ...(config.weights ?? {})
    };
  }

  isTurn(state) {
    return !state.finished && state.currentTurn === this.team;
  }

  chooseAction(state, level) {
    const actions = legalActions(state, level);
    if (!actions.length) return null;

    const scored = actions.map(action => {
      const next = simulate(state, level, action);
      return {
        action,
        score: minimax(next, level, this.depth - 1, -Infinity, Infinity, this.team, this)
      };
    }).sort((a, b) => b.score - a.score);

    const candidates = scored.filter(item => item.score >= scored[0].score - Math.abs(scored[0].score * this.randomness + 8));
    return candidates[Math.floor(Math.random() * candidates.length)]?.action ?? scored[0].action;
  }
}

export function legalActions(state, level) {
  return legalActionsFor(state, level);
}

function minimax(state, level, depth, alpha, beta, aiTeam, ai) {
  const result = victoryResultFor(state, level);
  if (result || depth <= 0) return evaluate(state, level, aiTeam, ai, result);

  const actions = legalActions(state, level);
  if (!actions.length) return evaluate(state, level, aiTeam, ai, result);
  const maximizing = state.currentTurn === aiTeam;

  if (maximizing) {
    let best = -Infinity;
    for (const action of actions) {
      best = Math.max(best, minimax(simulate(state, level, action), level, depth - 1, alpha, beta, aiTeam, ai));
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }

  let best = Infinity;
  for (const action of actions) {
    best = Math.min(best, minimax(simulate(state, level, action), level, depth - 1, alpha, beta, aiTeam, ai));
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

function advanceTurn(state) {
  const completedRound = state.currentTurn === 'enemy';
  state.currentTurn = state.currentTurn === 'player' ? 'enemy' : 'player';
  if (completedRound) state.roundsElapsed = (state.roundsElapsed ?? 0) + 1;
}

function simulate(state, level, action) {
  const next = cloneState(state);
  const unit = next.units.find(piece => piece.id === action.unitId);
  if (!unit) return next;

  if (action.kind === 'royal-swap') {
    const partner = next.units.find(piece => piece.id === action.targetId);
    if (partner) applyRoyalSwap(next, unit, partner);
    advanceTurn(next);
    return next;
  }

  if (action.kind === 'capture' || action.kind === 'destroy') {
    const target = next.units.find(piece => piece.id === action.targetId);
    if (target && applyRookShieldRejection(next, level, unit, target)) {
      advanceTurn(next);
      return next;
    }
  }

  const originX = unit.x;
  const originY = unit.y;
  unit.x = null;
  unit.y = null;
  releaseFriendlyPrisoners(next, originX, originY, unit.team);

  if (action.kind === 'capture' || action.kind === 'destroy') {
    const target = next.units.find(piece => piece.id === action.targetId);
    if (target) {
      if (action.kind === 'capture') {
        target.captured = true;
        target.destroyed = false;
        target.capturedBy = unit.team;
        target.x = action.x;
        target.y = action.y;
      } else {
        target.destroyed = true;
        target.captured = false;
        target.capturedBy = null;
        target.x = null;
        target.y = null;
      }
    }
  }

  completeUnitMove(next, level, unit, action);
  advanceTurn(next);
  return next;
}

function cloneState(state) {
  const units = typeof structuredClone === 'function'
    ? structuredClone(state.units)
    : JSON.parse(JSON.stringify(state.units));
  const teamEvolution = typeof structuredClone === 'function'
    ? structuredClone(state.teamEvolution)
    : JSON.parse(JSON.stringify(state.teamEvolution));
  return {
    ...state,
    units,
    teamEvolution,
    roundsElapsed: state.roundsElapsed ?? 0,
    active(unit) { return Boolean(unit && !unit.captured && !unit.destroyed && !unit.inReserve); },
    activeAt(x, y) { return this.units.find(unit => this.active(unit) && unit.x === x && unit.y === y) ?? null; },
    prisonersAt(x, y) { return this.units.filter(unit => unit.captured && !unit.destroyed && unit.x === x && unit.y === y); }
  };
}

function releaseFriendlyPrisoners(state, x, y, team) {
  state.prisonersAt(x, y)
    .filter(piece => piece.team === team)
    .forEach(piece => {
      piece.captured = false;
      piece.capturedBy = null;
    });
}

function evaluate(state, level, aiTeam, ai, result) {
  if (result) return result.winner === aiTeam ? 100000 : -100000;
  const opponent = aiTeam === 'player' ? 'enemy' : 'player';

  let score = 0;
  for (const unit of state.units) {
    const sign = unit.team === aiTeam ? 1 : -1;
    const value = ai.values[unit.pieceType] ?? 250;
    if (state.active(unit)) score += sign * value * ai.weights.material;
    else if (unit.captured && !unit.destroyed) score -= sign * value * ai.weights.captured;
  }

  score += prisonerPositionScore(state, level, aiTeam, ai);
  score += (mobilityFor(state, level, aiTeam) - mobilityFor(state, level, opponent)) * ai.weights.mobility;
  score += objectiveScoreFor(state, level, aiTeam) * ai.weights.objective;
  return score;
}

function prisonerPositionScore(state, level, aiTeam, ai) {
  let score = 0;

  for (const prisoner of state.units) {
    if (!prisoner.captured || prisoner.destroyed || prisoner.x == null || prisoner.y == null) continue;

    const prisonerValue = ai.values[prisoner.pieceType] ?? 250;
    const captor = state.activeAt(prisoner.x, prisoner.y);
    const owner = prisoner.team;
    const capturingTeam = prisoner.capturedBy;

    // A prisoner that can already be reached by its own side is much closer to returning
    // than the flat captured-material score suggests.
    if (canTeamReachSquare(state, level, owner, prisoner.x, prisoner.y, ['move-frozen'])) {
      const recovery = prisonerValue * ai.weights.rescuePotential;
      score += owner === aiTeam ? recovery : -recovery;
    }

    if (!captor || !capturingTeam || captor.team !== capturingTeam) continue;

    // The key exchange pattern: if the opposing side can immediately capture the piece
    // standing on its prisoner, the capture is insecure. Discount the prisoner and charge
    // part of the exposed captor's value, because the following exchange tends to restore
    // the frozen material instead of creating a durable material lead.
    if (canTeamReachSquare(state, level, owner, captor.x, captor.y, ['capture'])) {
      const captorValue = ai.values[captor.pieceType] ?? 250;
      const risk = (prisonerValue + captorValue * 0.5) * ai.weights.prisonerSafety;
      score += capturingTeam === aiTeam ? -risk : risk;
    }
  }

  return score;
}

function canTeamReachSquare(state, level, team, x, y, kinds) {
  const previousTurn = state.currentTurn;
  state.currentTurn = team;
  try {
    return state.units.some(unit =>
      state.active(unit) && unit.team === team &&
      optionsFor(state, level, unit).some(option => option.x === x && option.y === y && kinds.includes(option.kind))
    );
  } finally {
    state.currentTurn = previousTurn;
  }
}

function mobilityFor(state, level, team) {
  const previousTurn = state.currentTurn;
  state.currentTurn = team;
  let moves = 0;
  for (const unit of state.units) {
    if (state.active(unit) && unit.team === team) moves += optionsFor(state, level, unit).length;
  }
  state.currentTurn = previousTurn;
  return moves;
}

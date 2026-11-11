import { legalActionsFor, optionsFor } from '../core/rules.js?v=20260821-evolution-3';
import { applyRookShieldRejection, applyRoyalSwap, completeUnitMove } from '../core/GameState.js?v=20261110-move-facing-1';
import { objectiveScoreFor, victoryResultFor } from '../core/victory.js?v=20260822-victory-1';
import { applyEncroachment } from '../core/encroachment.js';

export class AIController {
  constructor(config = {}) {
    this.team = config.team ?? 'enemy';
    this.depth = config.depth ?? 2;
    this.randomness = config.randomness ?? 0.08;
    // A tunable assault profile is active only in survival. Other objectives
    // retain their existing material-conscious minimax evaluation.
    this.aggression = Number.isFinite(config.aggression) ? Math.max(0, config.aggression) : 1;
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
      space: 4,
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
      const next = simulate(state, level, action, true);
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
  const result = state.forcedClosureLoss ? { winner: 'enemy', reason: 'encroachment' } : victoryResultFor(state, level);
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

function simulate(state, level, action, simulateImmediateClosure = false) {
  // Exact closure is evaluated for each root choice; projecting every random
  // closure at deeper minimax plies would multiply the search tree dramatically.
  function finishSimulatedAction() {
    next.combatActionsCompleted = (next.combatActionsCompleted ?? 0) + 1;
    advanceTurn(next); // roundsElapsed must be current before a survival victory check.
    if (simulateImmediateClosure && !victoryResultFor(next, level)) {
      const closure = applyEncroachment(next, level);
      if (closure.status === 'trapped' || closure.noNextCandidate) next.forcedClosureLoss = true;
    }
    return next;
  }
  const next = cloneState(state);
  const unit = next.units.find(piece => piece.id === action.unitId);
  if (!unit) return next;

  if (action.kind === 'royal-swap') {
    const partner = next.units.find(piece => piece.id === action.targetId);
    if (partner) applyRoyalSwap(next, unit, partner);
    return finishSimulatedAction();
  }

  if (action.kind === 'capture' || action.kind === 'destroy') {
    const target = next.units.find(piece => piece.id === action.targetId);
    if (target && applyRookShieldRejection(next, level, unit, target)) {
      return finishSimulatedAction();
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

  completeUnitMove(next, level, unit, { ...action, fromX: originX, fromY: originY });
  return finishSimulatedAction();
}

function cloneState(state) {
  const units = typeof structuredClone === 'function'
    ? structuredClone(state.units)
    : JSON.parse(JSON.stringify(state.units));
  const teamEvolution = typeof structuredClone === 'function'
    ? structuredClone(state.teamEvolution)
    : JSON.parse(JSON.stringify(state.teamEvolution));
  const boardElements = typeof structuredClone === 'function'
    ? structuredClone(state.boardElements ?? levelBoardElements(state))
    : JSON.parse(JSON.stringify(state.boardElements ?? levelBoardElements(state)));
  return {
    ...state,
    units,
    teamEvolution,
    boardElements,
    combatActionsCompleted: state.combatActionsCompleted ?? 0,
    encroachmentSeed: state.encroachmentSeed ?? 0,
    pendingClosure: state.pendingClosure ? {...state.pendingClosure} : null,
    roundsElapsed: state.roundsElapsed ?? 0,
    isDeploying() { return this.phase === 'deployment'; },
    active(unit) {
      if (typeof state.active === 'function') return state.active.call(this, unit);
      return Boolean(unit && !unit.captured && !unit.destroyed && !unit.inReserve);
    },
    activeAt(x, y) { return this.units.find(unit => this.active(unit) && unit.x === x && unit.y === y) ?? null; },
    prisonersAt(x, y) { return this.units.filter(unit => unit.captured && !unit.destroyed && unit.x === x && unit.y === y); }
  };
}

function levelBoardElements(state) { return state.level?.boardElements ?? []; }

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
  if (level?.rules?.victory === 'survive' && aiTeam === 'enemy' && ai.aggression > 0) {
    return survivalAssaultScore(state, level, ai);
  }
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
  if (Number.isInteger(level.rules?.encroachmentStartAction)) {
    // Adjacent free cells give a team local options when the arena contracts.
    const approaching = Math.min(1, (state.combatActionsCompleted ?? 0) /
      Math.max(1, level.rules.encroachmentStartAction));
    score += (localSpace(state, level, aiTeam) - localSpace(state, level, opponent)) *
      ai.weights.space * approaching;
  }
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

function localSpace(state, level, team) {
  const size = level.board.size ?? 8;
  const blocked = new Set((state.boardElements ?? level.boardElements ?? [])
    .filter(item=>item.blocking).map(item=>item.x+','+item.y));
  let space=0;
  for (const unit of state.units) {
    if (!state.active(unit) || unit.team!==team) continue;
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) {
      if (!dx && !dy) continue;
      const x=unit.x+dx, y=unit.y+dy;
      if(x>=0 && y>=0 && x<size && y<size && !blocked.has(x+','+y)) space++;
    }
  }
  return space;
}

// In survival the enemy must eliminate every participating player piece before
// the deadline. Conventional material trading is a losing strategy: an enemy
// rook sacrificed to permanently remove one pawn is usually a good exchange.
// Terminal losses (including elimination of every enemy) are still handled by
// victoryResultFor() with a much larger +/-100000 score.
export function survivalAssaultScore(state, level, ai) {
  const aggression = ai.aggression ?? 1;
  const totalRounds = Math.max(1, Number(level?.rules?.surviveRounds) || 1);
  const elapsed = Math.min(totalRounds, Math.max(0, state.roundsElapsed ?? 0));
  const urgency = aggression * (1 + 0.65 * elapsed / totalRounds);
  const players = state.units.filter(unit => unit.team === 'player' && !unit.inReserve);
  const enemies = state.units.filter(unit => unit.team === 'enemy' && !unit.inReserve);
  const livingEnemies = enemies.filter(unit => state.active(unit));
  let score = 0;

  // A single player piece surviving the deadline defeats the AI. Removing
  // a piece matters drastically more than the value of any sacrificed attacker.
  for (const player of players) {
    if (state.active(player)) {
      score -= 1350 * urgency;
      if (livingEnemies.length) {
        // Pursue whichever player can be reached most quickly, rather than
        // maneuvering to preserve a large defensive formation.
        const distance = Math.min(...livingEnemies.map(enemy =>
          Math.max(Math.abs(enemy.x - player.x), Math.abs(enemy.y - player.y))
        ));
        score -= 32 * urgency * distance;
      }
    } else if (player.destroyed) {
      score += 140 * urgency; // permanent elimination beats a rescuable capture
    } else if (player.captured) {
      score += 25 * urgency;
    }
  }

  // Preserve a minimum attacking force so careless sacrifices do not wipe out
  // the enemy (which would grant the player an immediate victory).
  for (const enemy of livingEnemies) {
    score += 95 + (ai.values[enemy.pieceType] ?? 250) * 0.12;
  }

  // Reward immediate threats that can force engagements on the following turn.
  // This is computed using the real movement rules (including dynamic walls).
  const threatened = new Set();
  const originalTurn = state.currentTurn;
  state.currentTurn = 'enemy';
  try {
    for (const enemy of livingEnemies) {
      for (const move of optionsFor(state, level, enemy)) {
        if (move.kind !== 'capture') continue;
        const target = state.activeAt(move.x, move.y);
        if (target?.team === 'player') threatened.add(target.id);
      }
    }
  } finally {
    state.currentTurn = originalTurn;
  }
  score += threatened.size * 185 * urgency;
  return score;
}

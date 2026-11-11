export function restoreSessionState(state, savedState) {
  if (!Array.isArray(savedState?.units)) return;

  // Discard the free protected king from saves created before survival became
  // an any-unit objective. Escort still has its own dedicated mission king.
  state.units = state.level.rules?.victory === 'survive'
    ? savedState.units.filter(unit => !unit.missionKing)
    : savedState.units;
  state.boardElements = Array.isArray(savedState.boardElements)
    ? structuredClone(savedState.boardElements) : structuredClone(state.level.boardElements ?? []);
  const pending = savedState.pendingClosure;
  const size = state.level.board.size ?? 8;
  state.pendingClosure = pending && Number.isInteger(pending.x) && Number.isInteger(pending.y)
    && Number.isInteger(pending.forAction) && pending.x >= 0 && pending.y >= 0
    && pending.x < size && pending.y < size && pending.forAction > 0
    && !(state.boardElements ?? []).some(item => item.blocking && item.x === pending.x && item.y === pending.y)
    ? {x: pending.x, y: pending.y, forAction: pending.forAction} : null;
  state.combatActionsCompleted = Number.isSafeInteger(savedState.combatActionsCompleted) && savedState.combatActionsCompleted >= 0
    ? savedState.combatActionsCompleted : 0;
  state.encroachmentSeed = Number.isSafeInteger(savedState.encroachmentSeed)
    ? savedState.encroachmentSeed >>> 0 : state.encroachmentSeed;
  // Older in-progress campaigns were saved before the free mission king existed.
  // Add it only when missing; never resurrect an existing captured/destroyed king.
  const requiredKing = state.level.units.find(unit => unit.missionKing);
  if (requiredKing && !state.units.some(unit => unit.id === requiredKing.id)) {
    const size = state.level.board.size ?? 8;
    const occupied = new Set(state.units.filter(unit => !unit.inReserve && !unit.destroyed && !unit.captured &&
      Number.isInteger(unit.x) && Number.isInteger(unit.y)).map(unit => unit.x + ',' + unit.y));
    const blocking = new Set((state.boardElements ?? []).filter(item => item.blocking)
      .map(item => item.x + ',' + item.y));
    const candidates = [requiredKing, ...Array.from({ length: size * 2 }, (_, index) => ({
      x: index % size, y: size - 1 - Math.floor(index / size)
    }))];
    const position = candidates.find(({ x, y }) => x >= 0 && x < size && y >= 0 && y < size &&
      !occupied.has(x + ',' + y) && !blocking.has(x + ',' + y));
    if (!position) throw new Error('No hay casilla libre para restaurar el Rey de misión.');
    state.units = [...state.units, { ...structuredClone(requiredKing), x: position.x, y: position.y,
      inReserve: false, captured: false, destroyed: false, capturedBy: null, recruitedBy: null }];
  }
  state.currentTurn = savedState.currentTurn === 'enemy' ? 'enemy' : 'player';
  state.finished = Boolean(savedState.finished);
  state.phase = savedState.phase === 'deployment' ? 'deployment' : 'play';
  if (savedState.teamEvolution) state.teamEvolution = savedState.teamEvolution;
  state.roundsElapsed = Number.isSafeInteger(savedState.roundsElapsed) && savedState.roundsElapsed >= 0
    ? savedState.roundsElapsed
    : 0;
  const configuredMode = state.level?.deployment?.mode ?? 'classic';
  // Older deployment saves keep the original mode so in-progress games remain playable.
  const legacyDeployment = state.phase === 'deployment' && configuredMode === 'alternating'
    && !Number.isInteger(savedState.deploymentRound);
  state.deploymentMode = legacyDeployment || savedState.deploymentMode === 'classic'
    ? 'classic' : configuredMode;
  state.deploymentRound = Number.isInteger(savedState.deploymentRound)
    && savedState.deploymentRound >= 1 && savedState.deploymentRound <= 3
    ? savedState.deploymentRound : 1;
  state.deploymentTurn = state.isAlternatingDeployment() && savedState.deploymentTurn === 'enemy'
    ? 'enemy' : 'player';
  const knownIds = new Set(state.units.map(unit => unit.id));
  state.deploymentCommittedIds = Array.isArray(savedState.deploymentCommittedIds)
    ? [...new Set(savedState.deploymentCommittedIds.filter(id => typeof id === 'string' && knownIds.has(id)))]
    : [];

  state.selectedId = null;
  state.pendingCapture = null;
}

export class GameSessionStore {
  constructor(storageKey, schemaVersion, validFactionIds) {
    this.storageKey = storageKey;
    this.schemaVersion = schemaVersion;
    this.validFactionIds = validFactionIds;
  }

  load() {
    try {
      const saved = JSON.parse(localStorage.getItem(this.storageKey));
      const supportedSchema = saved?.schemaVersion === this.schemaVersion ||
        (this.schemaVersion === 7 && saved?.schemaVersion === 6);
      return supportedSchema &&
        saved?.levelId &&
        this.validFactionIds.includes(saved?.playerFactionId) &&
        saved?.state
        ? saved
        : null;
    } catch {
      return null;
    }
  }

  save(level, state) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({
        schemaVersion: this.schemaVersion,
        levelId: level.id,
        playerFactionId: level.teams.player,
        state: {
          units: state.units,
          boardElements: state.boardElements,
          combatActionsCompleted: state.combatActionsCompleted,
          encroachmentSeed: state.encroachmentSeed,
          pendingClosure: state.pendingClosure,
          currentTurn: state.currentTurn,
          finished: state.finished,
          phase: state.phase,
          deploymentMode: state.deploymentMode,
          deploymentRound: state.deploymentRound,
          deploymentTurn: state.deploymentTurn,
          deploymentCommittedIds: state.deploymentCommittedIds,
          teamEvolution: state.teamEvolution,
          roundsElapsed: state.roundsElapsed
        }
      }));
    } catch {
      // Storage is optional.
    }
  }

  clear() {
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      // Storage is optional.
    }
  }
}

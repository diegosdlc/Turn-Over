export function restoreSessionState(state, savedState) {
  if (!Array.isArray(savedState?.units)) return;

  state.units = savedState.units;
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

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
      return saved?.schemaVersion === this.schemaVersion &&
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

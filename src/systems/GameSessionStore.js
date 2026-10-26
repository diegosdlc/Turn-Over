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
          deploymentRound: state.deploymentRound,
          deploymentTurn: state.deploymentTurn,
          deploymentCommittedIds: state.deploymentCommittedIds,
          roundsElapsed: state.roundsElapsed,
          teamEvolution: state.teamEvolution
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

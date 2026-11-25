import { AIController } from './AIController.js?v=20261125-search-budget-1';
import { GameState } from '../core/GameState.js?v=20261118-deployment-points-1';

// Only clone the rules-facing level data, not UI metadata or behavior hooks.
// The authoritative state remains on the main thread.
export function aiRequestFor(state, level) {
  const { level: originalLevel, ...snapshot } = state;
  return {
    snapshot,
    level: { board: level.board, rules: level.rules, boardElements: level.boardElements },
    config: level.ai
  };
}

export function chooseAiAction({ snapshot, level, config }) {
  // structured cloning removes class prototypes. Restore the same state
  // methods used by the human player and minimax, without resetting the game.
  const state = Object.assign(Object.create(GameState.prototype), snapshot, { level });
  return new AIController(config).chooseAction(state, level);
}

if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  self.addEventListener('message', event => {
    try {
      self.postMessage({ action: chooseAiAction(event.data) });
    } catch (error) {
      self.postMessage({ error: String(error) });
    }
  });
}

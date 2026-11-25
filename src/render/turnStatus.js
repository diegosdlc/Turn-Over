// Derive the UI label from the encounter phase and actual worker activity.
export function turnStatusFor(state, thinking = false) {
  if (!state || state.finished) return null;
  if (state.isDeploying()) {
    const enemy = state.isAlternatingDeployment() && state.deploymentTurn === 'enemy';
    return { kind: enemy ? 'enemy' : 'player', key: enemy ? 'ui.deployment.enemy_turn' : 'ui.deployment.your_turn' };
  }
  if (state.currentTurn === 'player') return { kind: 'player', key: 'ui.turn.player' };
  return thinking
    ? { kind: 'thinking', key: 'ui.turn.thinking' }
    : { kind: 'enemy', key: 'ui.turn.enemy' };
}

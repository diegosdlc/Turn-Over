import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { turnStatusFor } from '../src/render/turnStatus.js';

const state = (overrides = {}) => ({
  currentTurn: 'player',
  finished: false,
  isDeploying() { return false; },
  isAlternatingDeployment() { return false; },
  ...overrides
});

test('turn label follows player, enemy and actual worker processing', () => {
  assert.equal(turnStatusFor(state()).key, 'ui.turn.player');
  const enemy = state({ currentTurn: 'enemy' });
  assert.equal(turnStatusFor(enemy).key, 'ui.turn.enemy');
  assert.equal(turnStatusFor(enemy, true).key, 'ui.turn.thinking');
  assert.equal(turnStatusFor(enemy, false).key, 'ui.turn.enemy');
  assert.equal(turnStatusFor(state(), true).kind, 'player');
  assert.equal(turnStatusFor(state({ finished: true }), true), null);
  assert.equal(turnStatusFor(null), null);
});

test('deployment shows its own turn rather than combat thinking', () => {
  const deployment = state({
    isDeploying: () => true, isAlternatingDeployment: () => true, deploymentTurn: 'enemy'
  });
  assert.equal(turnStatusFor(deployment, true).key, 'ui.deployment.enemy_turn');
  deployment.deploymentTurn = 'player';
  assert.equal(turnStatusFor(deployment).key, 'ui.deployment.your_turn');
});

test('piece feedback does not override projected paint order', () => {
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  const renderer = readFileSync(new URL('../src/render/BoardRenderer.js', import.meta.url), 'utf8');
  for (const selector of [
    '.unit.selected:not(.unit-moving):not(.unit-deploying)',
    '.unit.unit-deploying',
    '.unit.unit-moving'
  ]) {
    const block = css.split(selector + '{')[1]?.split('}')[0];
    assert.ok(block, selector);
    assert.doesNotMatch(block, /z-index/);
  }
  assert.match(renderer, /depth: box.top \+ box.height/);
  assert.match(renderer, /cells.sort\(\(a, b\) => a.depth - b.depth/);
});

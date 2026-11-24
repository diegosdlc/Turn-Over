import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { getLevel } from '../src/content/levels/index.js';
import { TutorialSystem } from '../src/systems/TutorialSystem.js';
import { parseCSV } from '../src/i18n/index.js';

const levels = ['tutorial-01','tutorial-02','tutorial-03','tutorial-04'].map(id => getLevel(id));
const csv = parseCSV(readFileSync(new URL('../locales/texts.csv', import.meta.url), 'utf8'));
const textByKey = new Map(csv.slice(1).map(row => [row[0], { es: row[2], en: row[3] }]));

test('level 1 has deployment and pawn-promotion tutorial before the original combat steps', () => {
  const steps = levels[0].tutorial.steps;
  assert.deepEqual(steps.map(item => item.id), [
    'deployment-select','deployment-place','deployment-rounds',
    'select-piece','move-piece','pawn-promotion','capture-choice'
  ]);
  assert.deepEqual(steps.slice(0,3).map(step => step.advanceOn),
    ['deployment-unit-selected','deployment-unit-placed','deployment-round-confirmed']);
  assert.equal(steps[5].advanceOn,'acknowledged');
});

test('level 2 explains the earned promotions and their abilities during deployment', () => {
  const steps = levels[1].tutorial.steps;
  assert.deepEqual(steps.map(item => item.id), ['promoted-pieces','promoted-abilities']);
  assert.ok(steps.every(step => step.phase === 'deployment' && step.advanceOn === 'acknowledged'));
});

test('all campaign levels explain arena traps when the first real warning is shown', () => {
  for(const level of levels){
    assert.ok(Number.isInteger(level.rules.encroachmentStartAction));
    assert.ok(level.tutorial.tips.some(tip => tip.id === 'arena-traps' &&
      tip.trigger === 'trap-warning' && tip.phase === 'play'));
  }
});

test('tutorial stays active for trap warning after the linear lesson and resuming during play skips deployment', () => {
  const tutor = new TutorialSystem({ storagePrefix: 'unit-test:' });
  tutor.configure(levels[0].id, levels[0].tutorial, { forceEnabled: true });
  tutor.setPhase('deployment');
  assert.equal(tutor.currentStep().id, 'deployment-select');
  tutor.notify('deployment-unit-selected');
  tutor.notify('deployment-unit-placed');
  tutor.notify('deployment-round-confirmed');
  tutor.setPhase('play');
  assert.equal(tutor.currentStep().id, 'select-piece');
  tutor.notify('unit-selected');
  tutor.notify('move-completed');
  assert.equal(tutor.currentStep().id, 'pawn-promotion');
  tutor.acknowledge();
  tutor.notify('capture-resolved');
  assert.equal(tutor.enabled, true);
  assert.equal(tutor.currentStep(), null);
  assert.equal(tutor.notify('trap-warning'), true);
  assert.equal(tutor.currentStep().id, 'arena-traps');
  tutor.acknowledge();
  assert.equal(tutor.currentStep(), null);
  assert.equal(tutor.enabled, false);

  const resumed = new TutorialSystem({ storagePrefix: 'unit-test:' });
  resumed.configure('tutorial-01', levels[0].tutorial, { forceEnabled: true });
  resumed.setPhase('play');
  assert.equal(resumed.currentStep().id, 'select-piece');
});

test('contextual arena warning interrupts and resumes the linear lesson without losing its place', () => {
  const tutor = new TutorialSystem({ storagePrefix:'unit-test:' });
  tutor.configure(levels[0].id,levels[0].tutorial,{forceEnabled:true});
  tutor.setPhase('play');
  assert.equal(tutor.currentStep().id,'select-piece');
  tutor.notify('trap-warning');
  assert.equal(tutor.currentStep().id,'arena-traps');
  tutor.acknowledge();
  assert.equal(tutor.currentStep().id,'select-piece');
  assert.equal(tutor.notify('trap-warning'),false);
});

test('texts are available as editable ES/EN keys, and main connects the necessary events', () => {
  for(const key of [
    'ui.tutorial.got_it','tutorial.deployment_select','tutorial.deployment_place',
    'tutorial.deployment_rounds','tutorial.pawn_promotion','tutorial.promoted_pieces',
    'tutorial.promoted_abilities','tutorial.arena_traps'
  ]){
    assert.ok(textByKey.get(key)?.es,key+': es');
    assert.ok(textByKey.get(key)?.en,key+': en');
  }
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  for(const code of [
    "this.tutorial.notify('deployment-unit-selected')",
    "this.tutorial.notify('deployment-unit-placed')",
    "this.tutorial.notify('deployment-round-confirmed')",
    "this.tutorial.notify('trap-warning')",
    'this.tutorial.setPhase('
  ]) assert.ok(main.includes(code),code);
});

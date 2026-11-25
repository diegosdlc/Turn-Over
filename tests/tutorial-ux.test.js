import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getLevel } from '../src/content/levels/index.js';
import { TutorialSystem, positionTutorialCard, notebookFreeRegion } from '../src/systems/TutorialSystem.js';
import { parseCSV } from '../src/i18n/index.js';

const source = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const tutorial1 = getLevel('tutorial-01').tutorial;
const tutorial2 = getLevel('tutorial-02').tutorial;

test('deployment guidance stays on the notebook, then the board, then the notebook', () => {
  assert.deepEqual(tutorial1.steps.slice(0, 3).map(x => x.anchor.type),
    ['notebook','deployment-board','notebook']);
  assert.ok(tutorial1.steps.slice(0, 3).every(x => x.phase === 'deployment'));
  assert.ok(tutorial2.steps.every(x => x.phase === 'deployment' && x.anchor.type === 'notebook'));
});

test('combat lesson never appears while a deployment phase is active', () => {
  const tutorial = new TutorialSystem({storagePrefix: 'tutorial-test:'});
  tutorial.configure('phase-regression', tutorial1, {forceEnabled: true});
  tutorial.setPhase('deployment');
  assert.equal(tutorial.currentStep().id, 'deployment-select');
  tutorial.notify('deployment-unit-selected');
  tutorial.notify('deployment-unit-placed');
  tutorial.notify('deployment-round-confirmed');
  assert.equal(tutorial.currentStep(), null, 'do not show select-piece in deployment');
  assert.equal(tutorial.notify('unit-selected'), false);
  assert.equal(tutorial.notify('move-completed'), false);
  tutorial.setPhase('play');
  assert.equal(tutorial.currentStep()?.id, 'select-piece');
  assert.ok(tutorial1.steps.slice(3).every(x => x.phase === 'play'));
});

test('tutorials use unscaled viewport overlay and do not block board clicks', () => {
  const system = source('src/systems/TutorialSystem.js');
  const styles = source('src/styles.css');
  const main = source('src/main.js');
  assert.ok(system.includes('document.body.append(tooltip)'));
  assert.ok(styles.includes('position:fixed;'));
  assert.ok(styles.includes('font-size:clamp(17px,1.4vw,20px)'));
  assert.ok(styles.includes('pointer-events:none;'));
  assert.ok(styles.includes('pointer-events:auto;'));
  assert.ok(main.includes('this.deploymentPieces?.getBoundingClientRect()'));
  assert.ok(main.includes('this.board.getBoundingClientRect()'));
  assert.ok(system.includes('.iso-cell.move-target'));
});

test('positioner keeps the text visible and off an available movement cell', () => {
  const board = {left:380,top:200,right:1300,bottom:700,width:920,height:500};
  const target = {left:850,right:1280,top:270,bottom:440};
  const rect = positionTutorialCard({
    surface:board,kind:'board',width:370,height:180,
    viewport:{left:0,top:0,width:1600,height:900},avoid:[target]
  });
  const card = {left:rect.left,right:rect.left+370,top:rect.top,bottom:rect.top+180};
  assert.ok(card.left >= 12 && card.right <= 1588);
  assert.ok(card.top >= 12 && card.bottom <= 888);
  assert.ok(card.right <= target.left || card.left >= target.right ||
    card.bottom <= target.top || card.top >= target.bottom,
    'card should not hide the legal target');
});

test('small screens still have a fully visible card', () => {
  const board = {left:20,top:90,right:355,bottom:425,width:335,height:335};
  const coords = positionTutorialCard({
    surface:board,kind:'board',width:350,height:175,
    viewport:{left:0,top:0,width:380,height:700},avoid:[]
  });
  assert.ok(coords.left >= 12 && coords.left+350 <= 368);
  assert.ok(coords.top >= 12 && coords.top+175 <= 688);
});

test('main menu action belongs only to Pause, not notebook Settings', () => {
  const html = source('index.html'), ui = source('src/level-ui.js');
  assert.match(html, /id="pause-dialog"[\s\S]*?id="resume-game"[\s\S]*?id="pause-main-menu"[\s\S]*?<\/dialog>/);
  assert.ok(ui.includes("this.mainMenu = document.querySelector('#pause-main-menu')"));
  assert.ok(ui.includes("window.dispatchEvent(new Event('game:return-home'))"));
  assert.ok(!ui.includes('#notebook-main-menu'));
  assert.ok(!ui.includes('showMainMenu'));
});

test('explanations are editable in both languages', () => {
  const rows=parseCSV(source('locales/texts.csv'));
  const keyMap=new Map(rows.slice(1).map(r=>[r[0],r]));
  for(const key of ['ui.tutorial.notebook','ui.tutorial.board','tutorial.deployment_select',
    'tutorial.deployment_place','tutorial.deployment_rounds']){
    assert.ok(keyMap.get(key)?.[2] && keyMap.get(key)?.[3],key);
  }
  assert.ok(keyMap.get('tutorial.deployment_select')[2].includes('cuaderno'));
  assert.ok(keyMap.get('tutorial.deployment_place')[2].includes('casilla verde'));
  assert.ok(keyMap.get('tutorial.deployment_rounds')[2].includes('Confirmar ronda'));
});

test('round explanation closes on confirming or selecting another reserve piece', () => {
  for (const event of ['deployment-round-confirmed', 'deployment-unit-selected']) {
    const tutorial = new TutorialSystem({storagePrefix: 'tutorial-test:'});
    tutorial.configure('round-regression', tutorial1, {forceEnabled: true});
    tutorial.setPhase('deployment');
    tutorial.notify('deployment-unit-selected');
    tutorial.notify('deployment-unit-placed');
    assert.equal(tutorial.currentStep().id, 'deployment-rounds');
    assert.equal(tutorial.currentStep().keepNotebookClear, true);
    assert.equal(tutorial.notify(event), true);
    assert.equal(tutorial.currentStep(), null);
    tutorial.notify('deployment-unit-placed');
    assert.equal(tutorial.currentStep(), null, 'do not repeat the explanation');
    tutorial.setPhase('play');
    assert.equal(tutorial.currentStep()?.id, 'select-piece');
  }
});

test('round explanation has a notebook-free region on desktop and mobile', () => {
  for (const [viewport, notebook] of [
    [{left:0,top:0,width:1280,height:720},{left:-12,top:320,right:500,bottom:732}],
    [{left:0,top:0,width:390,height:700},{left:20,top:375,right:370,bottom:690}],
    [{left:0,top:0,width:780,height:350},{left:0,top:35,right:330,bottom:350}]
  ]) {
    const region = notebookFreeRegion(viewport, notebook);
    assert.ok(region && region.width > 0 && region.height > 0);
    assert.ok(region.right <= notebook.left || region.left >= notebook.right ||
      region.bottom <= notebook.top || region.top >= notebook.bottom);
    assert.ok(region.left >= viewport.left && region.top >= viewport.top);
    assert.ok(region.right <= viewport.left + viewport.width &&
      region.bottom <= viewport.top + viewport.height);
  }
});

test('closing the X hides only the active action-driven lesson until its event', () => {
  const tutorial = new TutorialSystem({storagePrefix:'tutorial-test:'});
  tutorial.configure('close-regression', tutorial1, {forceEnabled:true});
  tutorial.setPhase('deployment');
  assert.equal(tutorial.closeCurrent(), true);
  assert.equal(tutorial.currentStep(), null);
  assert.equal(tutorial.enabled, true);
  assert.equal(tutorial.notify('deployment-unit-selected'), true);
  assert.equal(tutorial.currentStep().id, 'deployment-place');
});

test('closing an acknowledgement lesson or contextual tip leaves tutorials enabled', () => {
  const tutorial = new TutorialSystem({storagePrefix:'tutorial-test:'});
  tutorial.configure('close-regression', tutorial2, {forceEnabled:true});
  tutorial.setPhase('deployment');
  assert.equal(tutorial.closeCurrent(), true);
  assert.equal(tutorial.currentStep().id, 'promoted-abilities');
  tutorial.setPhase('play');
  tutorial.notify('trap-warning');
  assert.equal(tutorial.currentStep().id, 'arena-traps');
  tutorial.closeCurrent();
  assert.equal(tutorial.notify('trap-warning'), false);
});

test('global skip and recovery preserve the current lesson without resetting the game', () => {
  const tutorial = new TutorialSystem({storagePrefix:'tutorial-test:'});
  tutorial.configure('preference-regression', tutorial1, {forceEnabled:true});
  tutorial.setPhase('deployment');
  tutorial.notify('deployment-unit-selected');
  tutorial.setEnabled(false);
  assert.equal(tutorial.currentStep(), null);
  assert.equal(tutorial.notify('deployment-unit-placed'), false);
  tutorial.setEnabled(true);
  assert.equal(tutorial.currentStep().id, 'deployment-place');
  tutorial.notify('deployment-unit-placed');
  assert.equal(tutorial.currentStep().id, 'deployment-rounds');
});

test('all tutorial cards expose X and global skip requires confirmation; both settings expose recovery', () => {
  const system = source('src/systems/TutorialSystem.js');
  const main = source('src/main.js');
  const html = source('index.html');
  const ui = source('src/level-ui.js');
  assert.ok(system.includes("close.className = 'tutorial-close'"));
  assert.ok(system.includes("if (!window.confirm(t('ui.tutorial.skip_confirm'))) return;"));
  assert.ok(main.includes('onSkipTutorials: () => this.setTutorialPreference(false)'));
  assert.ok(main.includes('saveTutorialPreference(enabled)'));
  assert.ok(html.includes('id="settings-tutorials"'));
  assert.ok(ui.includes('id="notebook-tutorials"'));
  const rows = new Map(parseCSV(source('locales/texts.csv')).map(row => [row[0],row]));
  assert.equal(rows.get('ui.tutorial.skip')[2], 'Omitir los tutoriales');
  assert.match(rows.get('ui.tutorial.skip_confirm')[2], /Reglas/);
  assert.match(rows.get('ui.tutorial.skip_confirm')[2], /Ajustes/);
});

test('promotion lessons use X instead of the redundant Got it button', () => {
  const system = source('src/systems/TutorialSystem.js');
  assert.ok(system.includes("if (this.activeTip) {\n      const gotIt"));
  assert.ok(!system.includes("if (this.activeTip || step.advanceOn === 'acknowledged') {\n      const gotIt"));
  assert.ok(system.includes('if (this.closeCurrent()) this.render(board, anchorResolver, options);'));
  const tutorial = new TutorialSystem({storagePrefix:'promotion-test:'});
  tutorial.configure('tutorial-02', tutorial2, {forceEnabled:true});
  tutorial.setPhase('deployment');
  assert.equal(tutorial.currentStep().id, 'promoted-pieces');
  tutorial.closeCurrent();
  assert.equal(tutorial.currentStep().id, 'promoted-abilities');
  tutorial.closeCurrent();
  assert.equal(tutorial.currentStep(), null);
});

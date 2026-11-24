import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCSV } from '../src/i18n/index.js';

const js = readFileSync(new URL('../src/level-ui.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/level-ui.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const [, ...rows] = parseCSV(readFileSync(new URL('../locales/texts.csv', import.meta.url), 'utf8'));
const keys = new Map(rows.map(([key,,es,en]) => [key,{es,en}]));

test('notebook includes traps in position 5 between capture and promotion', () => {
  const def = js.slice(js.indexOf('const NOTEBOOK_RULE_PAGES'), js.indexOf('function notebookTrapsIllustration'));
  const order = [...def.matchAll(/bodyKey: '([^']+)'/g)].map(x => x[1]);
  assert.deepEqual(order, [
    'notebook.rules.deploy.budget',
    'notebook.rules.deploy.area',
    'notebook.rules.movement.body',
    'notebook.rules.capture.body',
    'notebook.rules.traps.body',
    'notebook.rules.promotion.body'
  ]);
  assert.match(def, /illustration: 'traps', altKey: 'notebook\.rules\.traps\.alt', imageSide: 'left'/);
});

test('traps explanation matches the mechanics and stays editable in ES and EN', () => {
  assert.equal(keys.get('notebook.rules.traps.title')?.es, 'Trampas');
  for (const key of ['notebook.rules.traps.body','notebook.rules.traps.alt','notebook.rules.traps.warning','notebook.rules.traps.blocked']) {
    assert.ok(keys.get(key)?.es && keys.get(key)?.en, key);
  }
  const es=keys.get('notebook.rules.traps.body').es;
  for (const phrase of ['acción 10','cualquier bando','bloqueada permanentemente','acción de antelación','pieza o un prisionero','destruido','inmovilizar','se reinicia']) {
    assert.ok(es.includes(phrase), 'Missing explanation: '+phrase);
  }
  assert.equal(new Set(rows.map(r=>r[0])).size,rows.length);
});

test('traps illustration uses the notebook image layout and responsive sizes', () => {
  assert.ok(js.includes("notebookTrapsIllustration(altKey)"));
  assert.ok(js.includes("t('notebook.rules.traps.warning')"));
  assert.ok(js.includes("t('notebook.rules.traps.blocked')"));
  assert.match(css,/\.notebook-traps-illustration\{/);
  assert.match(css,/\.notebook-traps-sequence\{[\s\S]*?grid-template-columns:minmax\(0,1fr\) auto minmax\(0,1fr\)/);
  assert.match(css,/@media \(max-width:900px\)/);
  assert.ok(html.includes('src/level-ui.js?v=20261124-pause-menu-1'));
  assert.ok(html.includes('src/level-ui.css?v=20261124-pause-menu-1'));
});

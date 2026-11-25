import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCSV } from '../src/i18n/index.js';

const js = readFileSync(new URL('../src/level-ui.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/level-ui.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const [header, ...rows] = parseCSV(readFileSync(new URL('../locales/texts.csv', import.meta.url), 'utf8'));
const translations = new Map(rows.map(([key,,es,en]) => [key, { es, en }]));

test('promotion page comes after the four original illustrated notebook rule pages', () => {
  const definitions = js.slice(js.indexOf('const NOTEBOOK_RULE_PAGES'), js.indexOf('function notebookPromotionIllustration'));
  const positions = [
    'notebook.rules.deploy.budget',
    'notebook.rules.deploy.area',
    'notebook.rules.movement.body',
    'notebook.rules.capture.body',
    'notebook.rules.promotion.body'
  ].map(key => definitions.indexOf(key));
  assert.ok(positions.every(x => x > 0));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  assert.ok(definitions.includes("illustration: 'promotion', altKey: 'notebook.rules.promotion.alt', imageSide: 'right'"));
  assert.ok(js.includes('rules: notebookRulePages()'));
});

test('promotion copy and labels are localized and match the implemented rules', () => {
  assert.deepEqual(header, ['key', 'description', 'es', 'en', 'context']);
  assert.equal(translations.get('notebook.rules.promotion.title')?.es, 'Promoción');
  const body = translations.get('notebook.rules.promotion.body');
  assert.ok(body?.en);
  for(const phrase of ['participaron y sobrevivieron','reserva','nuevos reclutas','Rey y Reina','Peón+','Caballería+','Alfil+','Torre+','Rey+ y Reina+','coste de despliegue']){
    assert.ok(body.es.includes(phrase), 'Missing: '+phrase);
  }
  for(const key of ['notebook.rules.promotion.alt','notebook.rules.promotion.base','notebook.rules.promotion.evolved']){
    assert.ok(translations.get(key)?.es && translations.get(key)?.en, 'Missing translation: '+key);
  }
  assert.equal(new Set(rows.map(row=>row[0])).size, rows.length);
});

test('promotion illustration uses the same responsive notebook layout', () => {
  assert.ok(js.includes('notebook-rule-pair notebook-rule-pair--image-'));
  assert.ok(js.includes('notebook-promotion-illustration'));
  assert.ok(js.includes("t('notebook.rules.promotion.base')"));
  assert.ok(js.includes("t('notebook.rules.promotion.evolved')"));
  assert.ok(css.includes('.notebook-promotion-row{'));
  assert.ok(css.includes('grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)'));
  assert.match(html, /src\/level-ui\.js\?v=[\w-]+["']/);
  assert.match(html, /src\/level-ui\.css\?v=[\w-]+["']/);
});

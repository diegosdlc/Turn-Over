import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCSV } from '../src/i18n/index.js';

const source = readFileSync(new URL('../locales/texts.csv', import.meta.url), 'utf8');
const [header, ...rows] = parseCSV(source);
const keys = new Set(rows.map(row => row[0]));

test('translations CSV has unique keys and complete Spanish and English texts', () => {
  assert.deepEqual(header, ['key', 'description', 'es', 'en', 'context']);
  assert.ok(rows.length >= 150);
  assert.equal(keys.size, rows.length, 'Duplicate translation keys');
  for (const [key, description, es, en] of rows) {
    assert.ok(key && description && es && en, 'Incomplete translation: ' + key);
    assert.match(description, /\.$/, 'Description should be one sentence: ' + key);
  }
});

test('placeholders match across translations', () => {
  const params = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const [key, description, es, en] of rows) {
    assert.deepEqual(params(es), params(en), 'Mismatched placeholders: ' + key);
  }
});

test('gender variants are available in both languages', () => {
  for (const gender of ['masculine', 'feminine', 'neutral']) {
    assert.ok(keys.has('player.greeting.' + gender));
    assert.ok(keys.has('ui.gender.' + gender));
  }
});

test('quoted CSV text and punctuation are parsed correctly', () => {
  assert.deepEqual(parseCSV('key,description,es,en,context\n"example","Example location.","Una ""cita"", aquí","A ""quote"", here","test"\n')[1],
    ['example', 'Example location.', 'Una "cita", aquí', 'A "quote", here', 'test']);
});

test('notebook uses the Word three-phase deployment copy in both languages', () => {
  const translations = new Map(rows.map(row => [row[0], { es: row[2], en: row[3] }]));
  assert.equal(translations.get('notebook.rules.deploy.title')?.es, 'Despliegue');
  assert.match(translations.get('notebook.rules.deploy.budget')?.es ?? '', /tres fases/);
  assert.match(translations.get('notebook.rules.deploy.budget')?.es ?? '', /un tercio/);
  assert.match(translations.get('notebook.rules.deploy.budget')?.en ?? '', /three phases/);
  assert.match(translations.get('notebook.rules.deploy.budget')?.en ?? '', /one third/);

  const notebook = readFileSync(new URL('../src/level-ui.js', import.meta.url), 'utf8');
  assert.match(notebook, /bodyKey: 'notebook\.rules\.deploy\.budget'/);
  assert.match(notebook, /rules: notebookRulePages\(\)/);
});
test('piece names are outside sprite tiles in deployment and the Band notebook', () => {
  const deployment = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const notebook = readFileSync(new URL('../src/level-ui.js', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/deployment.css', import.meta.url), 'utf8');
  assert.match(deployment, /card\.append\(tile, name, status\)/);
  assert.match(deployment, /card\.append\(button, name, status\)/);
  assert.match(notebook, /card\.append\(tile, name, meta\)/);
  assert.match(styles, /\.deployment-panel \.deployment-piece-name,\s*\.notebook-roster-card \.deployment-piece-name\s*\{\s*position:static/);
});

test('new faction strings in CSV match the requested UI copy', () => {
  const translations = new Map(rows.map(([key, , es, en]) => [key, { es, en }]));
  const expected = {
    'ui.faction.greeting.masculine': 'Bienvenido',
    'ui.faction.greeting.feminine': 'Bienvenida',
    'ui.faction.greeting.neutral': 'Bienvenide',
    'ui.faction.greeting.end': 'Comandante a Turn Over.',
    'ui.faction.intro': 'Selecciona a tu banda, supera los obstáculos en tu camino y diseña tu estrategia hacia la victoria. La facción que elijas otorgará a tu banda su pieza especial inicial.',
    'ui.faction.select': 'Elige tu facción:',
    'ui.faction.green.option': 'Tolias Sol:',
    'ui.faction.green.special': 'sus Alfiles pueden atacar las diagonales e impulsarse en los bordes del tablero.',
    'ui.faction.yellow.option': 'Gwol Tsung:',
    'ui.faction.yellow.special': 'su veloz Caballería es capaz de saltar obstáculos y desplegarse en la vanguardia de tu territorio.',
    'ui.faction.red.option': 'Kuntdora:',
    'ui.faction.red.special': 'sus altas Torres dominan el campo y cuentan con una resistencia superior.'
  };
  for (const [key, es] of Object.entries(expected)) {
    assert.equal(translations.get(key)?.es, es, key);
    assert.ok(translations.get(key)?.en, 'Missing English text: ' + key);
  }
});

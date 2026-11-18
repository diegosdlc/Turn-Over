import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCSV } from '../src/i18n/index.js';

const js = readFileSync(new URL('../src/level-ui.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/level-ui.css', import.meta.url), 'utf8');
const [header, ...rows] = parseCSV(readFileSync(new URL('../locales/texts.csv', import.meta.url), 'utf8'));
const texts = new Map(rows.map(([key, description, es, en]) => [key, { description, es, en }]));
const assets = ['deployment-points.webp', 'deployment-zones.webp', 'movement.webp', 'capture-destruction.webp'];

test('rules follow the four rows and left/right image order in the source Word', () => {
  const source = js.slice(js.indexOf('const NOTEBOOK_RULE_PAGES'), js.indexOf('function notebookRulePages'));
  const matches = [...source.matchAll(/image: '([^']+)', altKey: '[^']+', imageSide: '(left|right)'/g)];
  assert.deepEqual(matches.map(([, file, side]) => ({ file, side })), [
    { file: assets[0], side: 'right' },
    { file: assets[1], side: 'left' },
    { file: assets[2], side: 'left' },
    { file: assets[3], side: 'right' }
  ]);
  assert.match(js, /rules: notebookRulePages\(\)/);
});

test('images extracted from Word are shipped as valid WebP files', () => {
  for (const file of assets) {
    const bytes = readFileSync(new URL('../assets/notebook/rules/' + file, import.meta.url));
    assert.ok(bytes.length > 1000, 'Missing image: ' + file);
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  }
});

test('Word headings and body text are editable and translated through CSV', () => {
  assert.deepEqual(header, ['key', 'description', 'es', 'en', 'context']);
  const expected = {
    'notebook.rules.deploy.title': 'Despliegue',
    'notebook.rules.movement.title': 'Movimiento',
    'notebook.rules.capture.title': 'Captura y destrucción',
    'notebook.rules.deploy.budget': 'Para cada nivel, dispones de un presupuesto total de puntos que puedes gastar en las distintas piezas disponibles.',
    'notebook.rules.deploy.area': 'Tu zona de despliegue comprende las dos primeras filas del tablero.',
    'notebook.rules.movement.body': 'Tan solo la Caballería puede sortear un obstáculo, aunque no podrá aterrizar en una casilla ocupada por un obstáculo.',
    'notebook.rules.capture.body': 'Las piezas capturadas por el jugador pasan a ser parte de su banda al terminar el nivel y podrán ser utilizadas en siguientes partidas.'
  };
  for (const [key, excerpt] of Object.entries(expected)) {
    assert.ok(texts.get(key)?.es.includes(excerpt), key + ': Spanish text');
    assert.ok(texts.get(key)?.en, key + ': English text');
  }
  for (const key of [...expected, 'notebook.rules.deploy.budget.alt', 'notebook.rules.deploy.area.alt', 'notebook.rules.movement.alt', 'notebook.rules.capture.alt']) {
    assert.ok(texts.has(key), 'Missing key: ' + key);
  }
});

test('rule images scale without cropping or stretching in notebook pages', () => {
  assert.match(css, /\.notebook-rule-pair\{[\s\S]*?display:grid/);
  assert.match(css, /\.notebook-rule-illustration img\{[\s\S]*?width:100%/);
  assert.match(css, /\.notebook-rule-illustration img\{[\s\S]*?height:auto/);
  assert.match(css, /\.notebook-rule-illustration img\{[\s\S]*?max-height:clamp\(/);
  assert.match(css, /\.notebook-rule-illustration img\{[\s\S]*?object-fit:contain/);
  assert.match(css, /notebook-rule-pair--image-left \.notebook-rule-illustration/);
  assert.match(css, /@media \(max-width:900px\)/);
});

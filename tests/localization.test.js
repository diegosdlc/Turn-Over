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

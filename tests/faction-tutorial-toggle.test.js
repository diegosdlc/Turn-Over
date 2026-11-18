import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { loadTutorialPreference, saveTutorialPreference } from '../src/systems/TutorialPreference.js';
import { GAME_CONFIG } from '../src/config/gameConfig.js';
import { parseCSV } from '../src/i18n/index.js';

test('tutorials are enabled by default and the checkbox preference persists', () => {
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };
  assert.equal(loadTutorialPreference(storage), true);
  assert.equal(saveTutorialPreference(false, storage), false);
  assert.equal(values.get(GAME_CONFIG.tutorialStoragePrefix + 'enabled'), '0');
  assert.equal(loadTutorialPreference(storage), false);
  assert.equal(saveTutorialPreference(true, storage), true);
  assert.equal(loadTutorialPreference(storage), true);
});

test('tutorial preference remains usable when browser storage is unavailable', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(loadTutorialPreference(blocked), true);
  assert.equal(saveTutorialPreference(false, blocked), false);
});

test('faction checkbox is below the options and has editable ES/EN localization', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const optionsEnd = html.indexOf('</div>', html.indexOf('data-player-faction="yellow"'));
  const checkboxAt = html.indexOf('id="faction-tutorials"');
  const settingsAt = html.indexOf('id="settings-dialog"');
  assert.ok(checkboxAt > optionsEnd && checkboxAt < settingsAt);
  assert.match(html, /id="faction-tutorials" type="checkbox" checked/);

  const csv = parseCSV(readFileSync(new URL('../locales/texts.csv', import.meta.url), 'utf8'));
  const row = csv.find(([key]) => key === 'ui.faction.tutorials');
  assert.equal(row?.[2], 'Mostrar tutoriales');
  assert.equal(row?.[3], 'Show tutorials');

  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /forceEnabled: forceTutorial \|\| this\.tutorialsEnabled/);
});

test('faction selection uses the requested editable text and inline gender greeting', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const csv = parseCSV(readFileSync(new URL('../locales/texts.csv', import.meta.url), 'utf8'));
  const textByKey = new Map(csv.slice(1).map(row => [row[0], row]));
  const expected = new Map([
    ['ui.faction.greeting.feminine', 'Bienvenida'],
    ['ui.faction.greeting.masculine', 'Bienvenido'],
    ['ui.faction.greeting.neutral', 'Bienvenide'],
    ['ui.faction.greeting.end', 'Comandante a Turn Over.'],
    ['ui.faction.intro', 'Selecciona a tu banda, supera los obstáculos en tu camino y diseña tu estrategia hacia la victoria.'],
    ['ui.faction.select', 'Elige tu facción:'],
    ['ui.faction.green.option', 'Tolias Sol:'],
    ['ui.faction.green.special', 'sus Alfiles pueden atacar las diagonales e impulsarse en los bordes del tablero.'],
    ['ui.faction.yellow.option', 'Gwol Tsung:'],
    ['ui.faction.yellow.special', 'su veloz Caballería es capaz de saltar obstáculos y desplegarse en la vanguardia de tu territorio.'],
    ['ui.faction.red.option', 'Kuntdora:'],
    ['ui.faction.red.special', 'sus altas Torres dominan el campo y cuentan con una resistencia superior.']
  ]);

  for (const [key, value] of expected) {
    assert.equal(textByKey.get(key)?.[2], value, key);
    assert.ok(textByKey.get(key)?.[3], 'Missing English translation: ' + key);
    assert.ok(html.includes('data-i18n="' + key + '"'), 'UI does not use: ' + key);
  }
  const genderOptions = [...html.matchAll(/<option value="(feminine|masculine|neutral)" data-i18n="ui\.faction\.greeting\.[^"]+">/g)];
  assert.equal(genderOptions.length, 3);
  assert.ok(html.indexOf('id="faction-gender"') < html.indexOf('id="faction-title"'));
  assert.ok(html.indexOf('id="faction-tutorials"') > html.indexOf('data-player-faction="yellow"'));
});

test('faction selection has visible Spanish fallbacks even before its CSV is loaded', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const phrase of [
    'Bienvenido', 'Bienvenida', 'Bienvenide', 'Comandante a Turn Over.',
    'Selecciona a tu banda, supera los obstáculos en tu camino y diseña tu estrategia hacia la victoria.',
    'Elige tu facción:', 'Tolias Sol:', 'Gwol Tsung:', 'Kuntdora:',
    'sus Alfiles pueden atacar las diagonales e impulsarse en los bordes del tablero.',
    'su veloz Caballería es capaz de saltar obstáculos y desplegarse en la vanguardia de tu territorio.',
    'sus altas Torres dominan el campo y cuentan con una resistencia superior.'
  ]) {
    assert.ok(html.includes(phrase), 'Missing fallback: ' + phrase);
  }
  const options = [...html.matchAll(/<option value="(masculine|feminine|neutral)" data-i18n="ui\.faction\.greeting\.[^"]+">/g)].map(match => match[1]);
  assert.deepEqual(options, ['masculine', 'feminine', 'neutral']);
});

test('faction UI cannot be overwritten with stale CSV or translation key names', () => {
  const source = readFileSync(new URL('../src/i18n/index.js', import.meta.url), 'utf8');
  assert.match(source, /fetch\(url, \{ cache: 'no-store' \}\)/);
  assert.match(source, /url\.searchParams\.set\('revision', TEXTS_REVISION\)/);
  assert.match(source, /FACTION_COPY_KEYS\.every\(key => catalog\.has\(key\)\)/);
  assert.match(source, /if \(!catalog\.has\(node\.dataset\.i18n\)\) return/);
  assert.match(source, /!factionCopyReady && node\.closest\?\.\('#faction-dialog'\)/);
});

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

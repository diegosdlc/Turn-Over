import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseCSV } from '../src/i18n/index.js';
import { welcomeTextFor } from '../src/content/mission.js';
import { getLevel } from '../src/content/levels/index.js';

const rows = parseCSV(readFileSync(new URL('../locales/texts.csv', import.meta.url), 'utf8'));
const texts = new Map(rows.slice(1).map(([key, , es, en]) => [key, { es, en }]));
const levelIds = ['tutorial-01', 'tutorial-02', 'tutorial-03', 'tutorial-04'];

function translateIn(language) {
  return (key, values = {}) => {
    const text = texts.get(key)?.[language];
    assert.ok(text, 'Missing welcome localization: ' + key);
    return text.replace(/\{(\w+)\}/g, (match, name) => {
      assert.ok(Object.hasOwn(values, name), 'Missing welcome parameter: ' + name);
      return String(values[name]);
    });
  };
}

test('all four campaign levels have editable ES/EN welcome messages', () => {
  assert.ok(texts.has('ui.welcome.eyebrow'));
  assert.ok(texts.has('ui.welcome.start'));
  for (const id of levelIds) {
    const level = getLevel(id);
    for (const language of ['es', 'en']) {
      const content = welcomeTextFor(level, translateIn(language));
      assert.ok(content.length > 25, 'Missing briefing for ' + id + ' (' + language + ')');
      assert.doesNotMatch(content, /\{\w+\}/, 'Unresolved briefing variables');
      assert.ok(texts.has(level.nameKey), 'Level title is not localized: ' + level.nameKey);
    }
  }
});

test('escort and survival briefing parameters reflect editable level rules', () => {
  assert.equal(
    welcomeTextFor({ id: 'tutorial-02', rules: { targetRow: 4 } }, (key, params) => params.row),
    5
  );
  assert.equal(
    welcomeTextFor({ id: 'tutorial-04', rules: { surviveRounds: 12 } }, (key, params) => params.rounds),
    12
  );
});

test('standalone scenarios do not receive a campaign welcome', () => {
  assert.equal(welcomeTextFor({ id: 'scenario-capture-king', rules: { victory: 'capture-king' } }, translateIn('es')), null);
  assert.equal(welcomeTextFor(null, translateIn('es')), null);
});

test('survival welcome preserves the merged PR #23 rules (band, not a mission king)', () => {
  const level = getLevel('tutorial-04');
  assert.equal(level.rules.victory, 'survive');
  assert.equal(level.rules.surviveRounds, 8);
  assert.equal(level.deployment.pointLimit, 20);
  assert.equal(level.units.some(unit => unit.missionKing), false);
  for (const language of ['es', 'en']) {
    const briefing = welcomeTextFor(level, translateIn(language));
    assert.match(briefing, language === 'es' ? /al menos una pieza/ : /at least one member/);
    assert.doesNotMatch(briefing, /Rey de misión|Mission King/);
    assert.match(briefing, language === 'es' ? /8 rondas/ : /8 complete rounds/);
  }
});

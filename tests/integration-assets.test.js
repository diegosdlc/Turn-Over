import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const path = name => resolve(root, name);
function javascriptFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const next = resolve(dir, entry.name);
    return entry.isDirectory() ? javascriptFiles(next) : /\.(?:js|mjs)$/.test(entry.name) ? [next] : [];
  });
}

test('every browser and server script parses successfully', () => {
  const scripts = [...javascriptFiles(path('src')), ...javascriptFiles(path('scripts')), path('game.js')];
  for (const script of scripts) {
    const result = spawnSync(process.execPath, ['--check', script], { encoding: 'utf8' });
    assert.equal(result.status, 0, script.slice(root.length) + ': ' + result.stderr);
  }
});

test('all relative JavaScript module imports and runtime CSV URL references exist', () => {
  const scripts = [...javascriptFiles(path('src')), ...javascriptFiles(path('scripts')), path('game.js')];
  const references = /\b(?:from\s*|import\s*(?:\(\s*)?)(['"])(\.\.?\/[^'"]+)\1|new URL\(\s*(['"])(\.\.?\/[^'"]+)\3\s*,\s*import\.meta\.url\s*\)/g;
  for (const script of scripts) {
    const content = readFileSync(script, 'utf8');
    for (const match of content.matchAll(references)) {
      const target = (match[2] ?? match[4]).split(/[?#]/, 1)[0];
      const absolute = resolve(dirname(script), decodeURIComponent(target));
      assert.ok(existsSync(absolute) && statSync(absolute).isFile(),
        'Missing ' + target + ' referenced by ' + script.slice(root.length));
    }
  }
});

test('HTML browser entrypoints and stylesheets exist in the deployment tree', () => {
  const html = readFileSync(path('index.html'), 'utf8');
  const references = /<(?:script|link)\b[^>]*\b(?:src|href)=(['"])(\.\/[^'"]+)\1/g;
  for (const match of html.matchAll(references)) {
    const target = decodeURIComponent(match[2].split(/[?#]/, 1)[0]);
    assert.ok(existsSync(path(target)) && statSync(path(target)).isFile(), 'Missing HTML asset: ' + target);
  }
});

test('the combat notebook keeps mission king identity, styling and description', () => {
  const notebook = readFileSync(path('src/level-ui.js'), 'utf8');
  const board = readFileSync(path('src/render/BoardRenderer.js'), 'utf8');
  const styles = readFileSync(path('src/deployment.css'), 'utf8');
  const boardStyles = readFileSync(path('src/styles.css'), 'utf8');
  assert.match(notebook, /unit\.missionKing\s*\?\s*' mission-king'/);
  assert.match(notebook, /ui\.mission\.king_status/);
  assert.match(notebook, /html:\s*missionBody/);
  assert.match(board, /piece\.classList\.toggle\('mission-king'/);
  assert.match(styles, /\.deployment-piece\.mission-king/);
  assert.match(boardStyles, /\.unit\.mission-king/);
});

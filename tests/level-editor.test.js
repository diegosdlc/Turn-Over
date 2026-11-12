import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getLevel } from '../src/content/levels/index.js';
import {
  BALANCE_FILES, createEditorDraft, editorCsv, editedFiles,
  validateEditorDraft, levelEnemies, levelObstacles, addEnemy, moveEnemy,
  removeEnemy, addObstacle, moveObstacle, removeObstacle, updateLevelField,
  updateProfileField, previewLevel, serializeCSV
} from '../src/dev/level-editor-data.js';
import { createGitHubEditorClient, validBranchName } from '../src/dev/github-editor-api.js';

async function sourceCsv() {
  return Object.fromEntries(await Promise.all(Object.entries(BALANCE_FILES)
    .map(async ([name, path]) => [name, await readFile(new URL('../' + path, import.meta.url), 'utf8')])));
}

test('CSV serializer quotes commas, quotes and line breaks', () => {
  assert.equal(serializeCSV(['id', 'name'], [{ id: 'x', name: 'A "quoted", item\nline' }]),
    'id,name\nx,"A ""quoted"", item\nline"\n');
});

test('editor changes only selected campaign level and validates obstacles/formations', async () => {
  const source = await sourceCsv();
  const draft = createEditorDraft(source, 'tutorial-01');
  const originalOtherLevel = draft.rows.enemies.filter(row => row.level_id === 'tutorial-02')
    .map(row => ({ ...row }));
  const enemy = levelEnemies(draft).find(row => row.piece_type !== 'king');
  const occupied = levelEnemies(draft).find(row => row.unit_id !== enemy.unit_id);
  assert.throws(() => moveEnemy(draft, enemy.unit_id, Number(occupied.x), Number(occupied.y)), /ocupada/);
  assert.throws(() => moveEnemy(draft, enemy.unit_id, 3, 3), /filas 0 y 1/);
  const addedEnemy = addEnemy(draft, 'pawn');
  assert.ok(levelEnemies(draft).some(row => row.unit_id === addedEnemy.unit_id));
  removeEnemy(draft, addedEnemy.unit_id);
  const obstacle = addObstacle(draft, 7, 5);
  assert.equal(obstacle.x, '7');
  moveObstacle(draft, obstacle.obstacle_id, 7, 4);
  assert.ok(levelObstacles(draft).some(row => row.y === '4' && row.x === '7'));
  removeObstacle(draft, obstacle.obstacle_id);
  assert.deepEqual(draft.rows.enemies.filter(row => row.level_id === 'tutorial-02'), originalOtherLevel);
  assert.doesNotThrow(() => validateEditorDraft(draft));
  assert.equal(editorCsv(draft).pieces, source.pieces);
  assert.ok(editedFiles(draft).every(file => file.path.startsWith('balance/')));
});

test('editor previews changed level AI profile and budget without mutating source level', async () => {
  const draft = createEditorDraft(await sourceCsv(), 'tutorial-04');
  const original = getLevel('tutorial-04');
  updateLevelField(draft, 'point_limit', '24');
  updateLevelField(draft, 'ai_depth', '4');
  updateLevelField(draft, 'ai_profile', 'hunter');
  updateProfileField(draft, 'pursuit', '75');
  const preview = previewLevel(original, draft);
  assert.equal(preview.deployment.pointLimit, 24);
  assert.equal(preview.ai.depth, 4);
  assert.equal(preview.ai.profileId, 'hunter');
  assert.equal(preview.ai.tactics.pursuit, 75);
  assert.equal(original.ai.profileId, 'aggressive');
  assert.equal(original.deployment.pointLimit, 20);
  assert.ok(editedFiles(draft).some(file => file.name === 'levels'));
  assert.ok(editedFiles(draft).some(file => file.name === 'aiProfiles'));
});

test('editor uses the same CSV validator as production', async () => {
  const draft = createEditorDraft(await sourceCsv(), 'tutorial-01');
  updateLevelField(draft, 'ai_depth', '-2');
  assert.throws(() => validateEditorDraft(draft), /Número inválido/);
});

test('GitHub client creates an atomic multi-file commit on the selected branch', async () => {
  const calls = [];
  const mock = async (url, init) => {
    const path = new URL(url).pathname;
    calls.push({ path, method: init.method, body: init.body ? JSON.parse(init.body) : null });
    let data = {};
    if (path.includes('/git/ref/heads/')) data = { object: { sha: 'old-head' } };
    else if (path.includes('/git/commits/old-head')) data = { tree: { sha: 'base-tree' } };
    else if (path.endsWith('/git/trees')) data = { sha: 'new-tree' };
    else if (path.endsWith('/git/commits')) data = { sha: 'new-head' };
    return { ok: true, json: async () => data };
  };
  const client = createGitHubEditorClient('temporary-token', mock);
  const changes = [
    { path: 'balance/levels.csv', content: 'level-data' },
    { path: 'balance/obstacles.csv', content: 'obstacle-data' }
  ];
  const result = await client.commitCsv('balance/test', 'old-head', changes, 'balance update');
  assert.equal(result.head, 'new-head');
  assert.equal(calls.filter(call => call.path.endsWith('/git/trees')).length, 1);
  assert.equal(calls.find(call => call.path.endsWith('/git/trees')).body.tree.length, 2);
  assert.deepEqual(calls.at(-1).body, { sha: 'new-head', force: false });
  await assert.rejects(client.commitCsv('balance/test', 'another-head', changes, 'unsafe'),
    /ha cambiado/);
});

test('branch input validation blocks malformed names', () => {
  assert.equal(validBranchName('balance/nivel-01'), true);
  assert.equal(validBranchName('main'), true);
  for (const name of ['../main', 'refs/heads/main', 'main..other', 'a b', '']) {
    assert.equal(validBranchName(name), false, name);
  }
});

import { parseCSV } from '../i18n/index.js';
import { parseBalanceTables } from '../content/balance.js?v=20261111-ai-profiles-1';
import { PIECES } from '../content/bands.js';

export const BALANCE_FILES = Object.freeze({
  pieces: 'balance/pieces.csv',
  levels: 'balance/levels.csv',
  enemies: 'balance/enemy-formations.csv',
  obstacles: 'balance/obstacles.csv',
  playerPresets: 'balance/player-presets.csv',
  aiProfiles: 'balance/ai-profiles.csv'
});

export const AI_FIELDS = Object.freeze([
  'material', 'captured', 'mobility', 'space', 'objective', 'prisoner_safety',
  'rescue_potential', 'pursuit', 'threat', 'king_safety', 'survival_target',
  'own_force', 'destroy_bonus'
]);

function escapeCell(value) {
  const text = String(value == null ? '' : value);
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

export function serializeCSV(columns, rows) {
  return [columns.map(escapeCell).join(','), ...rows.map(row =>
    columns.map(column => escapeCell(row[column])).join(','))].join('\n') + '\n';
}

export function createEditorDraft(csv, levelId) {
  const rows = {};
  const headers = {};
  for (const name of Object.keys(BALANCE_FILES)) {
    if (typeof csv[name] !== 'string') throw new Error('Falta el CSV: ' + name);
    const [header, ...data] = parseCSV(csv[name]);
    if (!header || !header.length) throw new Error('CSV vacío: ' + name);
    headers[name] = header;
    rows[name] = data.map(record => Object.fromEntries(
      header.map((column, index) => [column, record[index] ?? ''])
    ));
  }
  if (!rows.levels.some(row => row.level_id === levelId && row.kind === 'campaign')) {
    throw new Error('El editor requiere un nivel de campaña.');
  }
  return { levelId, original: { ...csv }, rows, headers, touched: new Set() };
}

export function editorCsv(draft) {
  const result = { ...draft.original };
  for (const name of draft.touched) {
    result[name] = serializeCSV(draft.headers[name], draft.rows[name]);
  }
  return result;
}

export function validateEditorDraft(draft) {
  return parseBalanceTables(editorCsv(draft));
}

export function editedFiles(draft) {
  const csv = editorCsv(draft);
  return Object.keys(BALANCE_FILES).filter(name => csv[name] !== draft.original[name])
    .map(name => ({ name, path: BALANCE_FILES[name], content: csv[name] }));
}

export function levelRow(draft) {
  return draft.rows.levels.find(row => row.level_id === draft.levelId);
}

export function levelEnemies(draft) {
  return draft.rows.enemies.filter(row => row.level_id === draft.levelId);
}

export function levelObstacles(draft) {
  return draft.rows.obstacles.filter(row => row.level_id === draft.levelId);
}

export function activeProfile(draft) {
  const profileId = levelRow(draft).ai_profile;
  return draft.rows.aiProfiles.find(row => row.profile_id === profileId);
}

export function updateLevelField(draft, key, value) {
  const row = levelRow(draft);
  if (!Object.hasOwn(row, key)) throw new Error('Campo de nivel desconocido: ' + key);
  row[key] = String(value);
  draft.touched.add('levels');
}

export function updateProfileField(draft, key, value) {
  const row = activeProfile(draft);
  if (!row || !AI_FIELDS.includes(key)) throw new Error('Campo de IA desconocido: ' + key);
  row[key] = String(value);
  draft.touched.add('aiProfiles');
}

function occupied(rows, x, y, ignoreId) {
  return rows.some(row => row.unit_id !== ignoreId && row.obstacle_id !== ignoreId &&
    Number(row.x) === x && Number(row.y) === y);
}

function checkedPosition(x, y) {
  if (![x, y].every(n => Number.isInteger(n) && n >= 0 && n < 8)) {
    throw new Error('La casilla debe estar dentro del tablero (0–7).');
  }
}

export function moveEnemy(draft, unitId, x, y) {
  checkedPosition(x, y);
  if (y > 1) throw new Error('La banda rival debe desplegar en las filas 0 y 1.');
  const row = levelEnemies(draft).find(enemy => enemy.unit_id === unitId);
  if (!row) throw new Error('Pieza rival desconocida.');
  if (occupied(levelEnemies(draft), x, y, unitId) ||
      levelObstacles(draft).some(item => item.blocking === 'true' && Number(item.x) === x && Number(item.y) === y)) {
    throw new Error('Esa casilla está ocupada.');
  }
  row.x = String(x);
  row.y = String(y);
  draft.touched.add('enemies');
}

export function addEnemy(draft, pieceType) {
  if (!PIECES[pieceType]) throw new Error('Tipo de pieza desconocido.');
  const enemies = levelEnemies(draft);
  const faction = enemies[0]?.faction ?? 'red';
  let pos = null;
  for (let y = 0; y <= 1 && !pos; y++) {
    for (let x = 0; x < 8; x++) {
      if (!occupied(enemies, x, y) &&
          !levelObstacles(draft).some(item => item.blocking === 'true' && Number(item.x) === x && Number(item.y) === y)) {
        pos = { x, y };
        break;
      }
    }
  }
  if (!pos) throw new Error('No quedan casillas libres en el despliegue rival.');
  let index = 1;
  while (enemies.some(row => row.unit_id === draft.levelId + '-editor-' + index)) index++;
  const row = {
    level_id: draft.levelId,
    unit_id: draft.levelId + '-editor-' + index,
    piece_type: pieceType,
    faction,
    facing: 'south',
    evolution_stage: 'base',
    x: String(pos.x),
    y: String(pos.y)
  };
  draft.rows.enemies.push(row);
  draft.touched.add('enemies');
  return row;
}

export function removeEnemy(draft, unitId) {
  const rows = draft.rows.enemies;
  const index = rows.findIndex(row => row.level_id === draft.levelId && row.unit_id === unitId);
  if (index < 0) return;
  if (rows[index].piece_type === 'king' &&
      levelEnemies(draft).filter(row => row.piece_type === 'king').length === 1) {
    throw new Error('El nivel debe conservar al menos un rey rival.');
  }
  rows.splice(index, 1);
  draft.touched.add('enemies');
}

export function updateEnemyField(draft, unitId, field, value) {
  if (!['piece_type', 'faction', 'facing', 'evolution_stage'].includes(field)) {
    throw new Error('Propiedad de pieza inválida.');
  }
  const row = levelEnemies(draft).find(item => item.unit_id === unitId);
  if (!row) throw new Error('Pieza rival desconocida.');
  row[field] = value;
  draft.touched.add('enemies');
}

export function moveObstacle(draft, obstacleId, x, y) {
  checkedPosition(x, y);
  const row = levelObstacles(draft).find(item => item.obstacle_id === obstacleId);
  if (!row) throw new Error('Obstáculo desconocido.');
  if (occupied(levelObstacles(draft), x, y, obstacleId) ||
      (row.blocking === 'true' && levelEnemies(draft).some(enemy =>
        Number(enemy.x) === x && Number(enemy.y) === y))) {
    throw new Error('Esa casilla está ocupada.');
  }
  row.x = String(x);
  row.y = String(y);
  draft.touched.add('obstacles');
}

export function addObstacle(draft, x, y) {
  checkedPosition(x, y);
  if (occupied(levelObstacles(draft), x, y) ||
      levelEnemies(draft).some(enemy => Number(enemy.x) === x && Number(enemy.y) === y)) {
    throw new Error('Esa casilla está ocupada.');
  }
  let index = 1;
  while (levelObstacles(draft).some(row => row.obstacle_id === draft.levelId + '-editor-obstacle-' + index)) index++;
  const row = {
    level_id: draft.levelId,
    obstacle_id: draft.levelId + '-editor-obstacle-' + index,
    x: String(x), y: String(y), type: 'blocker', blocking: 'true',
    asset: './assets/board-elements/tutorial/blocker-placeholder.svg',
    scale: '1.28', y_offset: '-0.32'
  };
  draft.rows.obstacles.push(row);
  draft.touched.add('obstacles');
  return row;
}

export function removeObstacle(draft, id) {
  const index = draft.rows.obstacles.findIndex(row => row.level_id === draft.levelId && row.obstacle_id === id);
  if (index < 0) return;
  draft.rows.obstacles.splice(index, 1);
  draft.touched.add('obstacles');
}

export function previewLevel(level, draft) {
  const parsed = validateEditorDraft(draft);
  const config = parsed.levelDefinitions[draft.levelId];
  const tactical = parsed.aiProfiles[config.aiProfileId];
  const enemies = parsed.enemyFormations[draft.levelId].map(enemy => {
    const piece = PIECES[enemy.pieceType];
    return {
      ...enemy, team: 'enemy', name: piece.name, fallbackGlyph: piece.fallbackGlyph,
      moveProfile: piece.moveProfile, evolutionProfile: piece.evolutionProfile ?? null
    };
  });
  const units = [
    ...level.units.filter(unit => unit.team !== 'enemy').map(unit =>
      unit.missionKing && config.missionKingPosition
        ? { ...unit, ...config.missionKingPosition } : { ...unit }),
    ...enemies
  ];
  return {
    ...level,
    units,
    boardElements: parsed.levelObstacles[draft.levelId].map(item => ({ ...item })),
    deployment: { ...level.deployment, pointLimit: config.pointLimit },
    ai: {
      ...level.ai, depth: config.aiDepth, randomness: config.aiRandomness,
      aggression: config.aiAggression, thinkDelayMs: config.aiThinkDelayMs,
      profileId: tactical.id,
      weights: { ...tactical.weights }, tactics: { ...tactical.tactics }
    },
    rules: {
      ...level.rules, encroachmentStartAction: config.encroachmentStartAction,
      ...(config.targetRow === null ? {} : { targetRow: config.targetRow }),
      ...(config.surviveRounds === null ? {} : { surviveRounds: config.surviveRounds })
    }
  };
}

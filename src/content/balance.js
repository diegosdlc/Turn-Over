import { parseCSV } from '../i18n/index.js';
import { PIECES } from './bands.js';
import { getFaction } from './factions.js';

const TABLE_URLS = Object.freeze({
  pieces: new URL('../../balance/pieces.csv', import.meta.url),
  levels: new URL('../../balance/levels.csv', import.meta.url),
  enemies: new URL('../../balance/enemy-formations.csv', import.meta.url),
  obstacles: new URL('../../balance/obstacles.csv', import.meta.url),
  playerPresets: new URL('../../balance/player-presets.csv', import.meta.url),
  aiProfiles: new URL('../../balance/ai-profiles.csv', import.meta.url)
});
const HEADERS = Object.freeze({
  pieces: 'piece_type,base,evolved',
  levels: 'level_id,kind,name,name_key,victory,next_level_id,point_limit,target_row,survive_rounds,ai_depth,ai_randomness,ai_think_delay_ms,mission_king_x,mission_king_y,encroachment_start_action,ai_aggression,ai_profile',
  enemies: 'level_id,unit_id,piece_type,faction,facing,evolution_stage,x,y',
  obstacles: 'level_id,obstacle_id,x,y,type,blocking,asset,scale,y_offset',
  playerPresets: 'level_id,unit_id,piece_type,faction,facing,evolution_stage',
  aiProfiles: 'profile_id,material,captured,mobility,space,objective,prisoner_safety,rescue_potential,pursuit,threat,king_safety,survival_target,own_force,destroy_bonus'
});
const VICTORIES = new Set(['elimination', 'escort-king', 'capture-king', 'survive']);

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freezeDeep);
  return Object.freeze(value);
}

function rowsFor(csv, name) {
  const [header, ...rows] = parseCSV(String(csv ?? ''));
  const expected = HEADERS[name];
  if (!header || header.join(',') !== expected) throw new Error('Cabecera CSV inválida en balance/' + name + '.');
  const columns = header.length;
  return rows.map((row, index) => {
    if (row.length !== columns) throw new Error('Número de columnas incorrecto en ' + name + ' (fila ' + (index + 2) + ').');
    return Object.fromEntries(header.map((field, i) => [field, row[i].trim()]));
  });
}

function numeric(value, label, { integer = false, min = 0, max = Infinity } = {}) {
  if (value === '' || !Number.isFinite(Number(value)) ||
      (integer && !/^-?\d+$/.test(value)) || Number(value) < min || Number(value) > max) {
    throw new Error('Número inválido para ' + label + ': ' + value);
  }
  return Number(value);
}

function optionalNumber(value, label, options) {
  return value === '' ? null : numeric(value, label, options);
}

function position(x, y, label) {
  return { x: numeric(x, label + '.x', { integer: true, max: 7 }),
    y: numeric(y, label + '.y', { integer: true, max: 7 }) };
}

// Pure parser for CI and editor validation. An omitted preset table keeps legacy callers valid.
export function parseBalanceTables({ pieces, levels, enemies, obstacles, playerPresets = null, aiProfiles = null }) {
  // The runtime always supplies aiProfiles; omitted tables allow older isolated
  // parser tests to remain compatible with the previous four-table contract.
  const tacticalProfiles = {};
  for (const row of aiProfiles === null ? [] : rowsFor(aiProfiles, 'aiProfiles')) {
    const id = row.profile_id;
    if (!id || !/^[a-z][a-z0-9-]*$/.test(id) || tacticalProfiles[id]) {
      throw new Error('Perfil de IA inválido/repetido: ' + id);
    }
    const positive = field => numeric(row[field], 'aiProfiles.' + id + '.' + field, { min: 0, max: 2000 });
    tacticalProfiles[id] = {
      id,
      weights: {
        material: positive('material'),
        captured: positive('captured'),
        mobility: positive('mobility'),
        space: positive('space'),
        objective: positive('objective'),
        prisonerSafety: positive('prisoner_safety'),
        rescuePotential: positive('rescue_potential')
      },
      tactics: {
        pursuit: positive('pursuit'),
        threat: positive('threat'),
        kingSafety: positive('king_safety'),
        survivalTarget: positive('survival_target'),
        ownForce: positive('own_force'),
        destroyBonus: positive('destroy_bonus')
      }
    };
  }
  if (aiProfiles !== null && !Object.keys(tacticalProfiles).length) throw new Error('No hay perfiles de IA.');
  const pieceCosts = {};
  for (const row of rowsFor(pieces, 'pieces')) {
    if (!PIECES[row.piece_type] || pieceCosts[row.piece_type]) throw new Error('Tipo de pieza inválido/repetido: ' + row.piece_type);
    const base = numeric(row.base, row.piece_type + '.base');
    const evolved = numeric(row.evolved, row.piece_type + '.evolved');
    if (evolved <= base) throw new Error('Evolución sin sobrecoste: ' + row.piece_type);
    pieceCosts[row.piece_type] = { base, evolved };
  }
  for (const pieceType of Object.keys(PIECES)) {
    if (!pieceCosts[pieceType]) throw new Error('Falta el coste de ' + pieceType);
  }

  const levelDefinitions = {};
  const levelPointLimits = {};
  for (const row of rowsFor(levels, 'levels')) {
    const id = row.level_id;
    if (!id || levelDefinitions[id] || !['campaign', 'lab'].includes(row.kind) ||
        !VICTORIES.has(row.victory)) throw new Error('Nivel inválido/repetido: ' + id);
    const limit = numeric(row.point_limit, id + '.point_limit', { integer: true, min: 1 });
    const targetRow = optionalNumber(row.target_row, id + '.target_row', { integer: true, max: 7 });
    const surviveRounds = optionalNumber(row.survive_rounds, id + '.survive_rounds', { integer: true, min: 1 });
    if (row.victory === 'escort-king' && targetRow === null) throw new Error('Falta target_row en ' + id);
    if (row.victory === 'survive' && surviveRounds === null) throw new Error('Falta survive_rounds en ' + id);
    const missionX = optionalNumber(row.mission_king_x, id + '.mission_king_x', { integer: true, max: 7 });
    const missionY = optionalNumber(row.mission_king_y, id + '.mission_king_y', { integer: true, max: 7 });
    const encroachmentStartAction = optionalNumber(row.encroachment_start_action, id + '.encroachment_start_action', { integer: true, min: 1 });
    const aiAggression = numeric(row.ai_aggression, id + '.ai_aggression', { min: 0, max: 5 });
    const aiProfileId = row.ai_profile;
    if (!aiProfileId || (aiProfiles !== null && !tacticalProfiles[aiProfileId])) {
      throw new Error('Perfil de IA desconocido para ' + id + ': ' + aiProfileId);
    }
    const requiresMissionKing = row.kind === 'campaign' && row.victory === 'escort-king';
    if ((missionX === null) !== (missionY === null) ||
        requiresMissionKing !== (missionX !== null) ||
        (requiresMissionKing && ![6, 7].includes(missionY))) {
      throw new Error('Rey de misión inválido en ' + id);
    }
    levelDefinitions[id] = {
      id, kind: row.kind, name: row.name, nameKey: row.name_key || null,
      victory: row.victory, nextLevelId: row.next_level_id || null,
      pointLimit: limit, targetRow, surviveRounds, encroachmentStartAction,
      missionKingPosition: missionX === null ? null : { x: missionX, y: missionY },
      aiDepth: numeric(row.ai_depth, id + '.ai_depth', { integer: true, min: 1 }),
      aiRandomness: numeric(row.ai_randomness, id + '.ai_randomness', { min: 0, max: 1 }),
      aiAggression,
      aiProfileId,
      aiThinkDelayMs: numeric(row.ai_think_delay_ms, id + '.ai_think_delay_ms', { integer: true })
    };
    levelPointLimits[id] = limit;
  }
  const campaign = Object.values(levelDefinitions).filter(level => level.kind === 'campaign');
  if (campaign.length !== 4) throw new Error('La campaña requiere exactamente cuatro niveles.');
  for (const level of campaign) {
    if (level.nextLevelId && levelDefinitions[level.nextLevelId]?.kind !== 'campaign') {
      throw new Error('Siguiente nivel inválido: ' + level.id);
    }
  }

  const enemyFormations = Object.fromEntries(campaign.map(level => [level.id, []]));
  const occupied = new Map();
  for (const row of rowsFor(enemies, 'enemies')) {
    const id = row.level_id, piece = PIECES[row.piece_type];
    if (!enemyFormations[id] || !piece || !getFaction(row.faction) ||
        !['north', 'south'].includes(row.facing) ||
        !['base', 'evolved'].includes(row.evolution_stage) || !row.unit_id) {
      throw new Error('Pieza rival inválida en ' + id + ': ' + row.unit_id);
    }
    const pos = position(row.x, row.y, id + ':' + row.unit_id);
    if (pos.y > 1) throw new Error('La formación rival inicial debe estar en filas 0 y 1: ' + id);
    const cells = occupied.get(id) ?? new Set();
    const cell = pos.x + ',' + pos.y;
    if (cells.has(cell) || enemyFormations[id].some(unit => unit.id === row.unit_id)) {
      throw new Error('Pieza rival duplicada en ' + id + ': ' + row.unit_id);
    }
    cells.add(cell);
    occupied.set(id, cells);
    enemyFormations[id].push({ id: row.unit_id, pieceType: row.piece_type, faction: row.faction,
      facing: row.facing, evolutionStage: row.evolution_stage, ...pos });
  }
  for (const level of campaign) {
    if (!enemyFormations[level.id].length || !enemyFormations[level.id].some(unit => unit.pieceType === 'king')) {
      throw new Error('Falta el rey rival en ' + level.id);
    }
  }

  const levelObstacles = Object.fromEntries(campaign.map(level => [level.id, []]));
  for (const row of rowsFor(obstacles, 'obstacles')) {
    const id = row.level_id;
    if (!levelObstacles[id] || !row.obstacle_id || !row.type ||
        !['true', 'false'].includes(row.blocking)) {
      throw new Error('Obstáculo inválido: ' + row.obstacle_id + ' en ' + id);
    }
    const pos = position(row.x, row.y, id + ':' + row.obstacle_id);
    if (levelObstacles[id].some(item => item.id === row.obstacle_id ||
      (item.x === pos.x && item.y === pos.y))) {
      throw new Error('Obstáculo duplicado: ' + id + ':' + row.obstacle_id);
    }
    if (row.blocking === 'true' && enemyFormations[id].some(unit => unit.x === pos.x && unit.y === pos.y)) {
      throw new Error('Obstáculo encima de formación rival: ' + id);
    }
    levelObstacles[id].push({
      id: row.obstacle_id, type: row.type, name: 'Obstáculo', i18nNameKey: 'ui.unit.obstacle',
      ...pos, blocking: row.blocking === 'true',
      asset: row.asset || null, className: 'tutorial-blocker',
      scale: row.scale === '' ? 1 : numeric(row.scale, row.obstacle_id + '.scale', { min: 0.01 }),
      yOffset: row.y_offset === '' ? 0 : numeric(row.y_offset, row.obstacle_id + '.y_offset', { min: -10, max: 10 })
    });
  }

  for (const level of campaign) {
    const mission = level.missionKingPosition;
    if (!mission) continue;
    if (enemyFormations[level.id].some(unit => unit.x === mission.x && unit.y === mission.y) ||
        levelObstacles[level.id].some(item => item.blocking && item.x === mission.x && item.y === mission.y)) {
      throw new Error('Rey de misión solapado en ' + level.id);
    }
  }

  const playerPresetBands = Object.fromEntries(campaign.map(level => [level.id, []]));
  for (const row of playerPresets === null ? [] : rowsFor(playerPresets, 'playerPresets')) {
    const roster = playerPresetBands[row.level_id];
    if (!roster || !row.unit_id || !(PIECES[row.piece_type] || row.piece_type === 'special') ||
        !(['player'].includes(row.faction) || getFaction(row.faction)) ||
        (row.piece_type === 'special' && row.faction !== 'player') ||
        !['north', 'south'].includes(row.facing) ||
        !['base', 'evolved'].includes(row.evolution_stage)) {
      throw new Error('Pieza de prueba inválida en ' + row.level_id + ': ' + row.unit_id);
    }
    if (roster.some(unit => unit.id === row.unit_id)) {
      throw new Error('Pieza de prueba duplicada en ' + row.level_id + ': ' + row.unit_id);
    }
    roster.push({
      id: row.unit_id, pieceType: row.piece_type, faction: row.faction,
      facing: row.facing, evolutionStage: row.evolution_stage
    });
  }
  if (playerPresets !== null) {
    for (const level of campaign) {
      if (!playerPresetBands[level.id].length) throw new Error('Falta banda de prueba en ' + level.id);
      const accessible = playerPresetBands[level.id].some(unit => {
        const type = unit.pieceType === 'special' ? 'bishop' : unit.pieceType;
        return pieceCosts[type][unit.evolutionStage] <= level.pointLimit;
      });
      if (!accessible) throw new Error('Ninguna pieza asequible en la banda de prueba de ' + level.id);
    }
  }

  return freezeDeep({ pieceCosts, levelPointLimits, levelDefinitions, enemyFormations, levelObstacles, playerPresetBands, aiProfiles: tacticalProfiles });
}

async function loadBalance() {
  const entries = await Promise.all(Object.entries(TABLE_URLS).map(async ([name, url]) => {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error('No se pudo cargar balance/' + name + ': ' + response.status);
    return [name, await response.text()];
  }));
  return parseBalanceTables(Object.fromEntries(entries));
}

export const BALANCE = await loadBalance();

export function levelBalance(levelId) {
  const level = BALANCE.levelDefinitions[levelId];
  if (!level) throw new Error('No hay balance para el nivel ' + levelId);
  return level;
}

export function aiProfileForLevel(levelId) {
  const level = levelBalance(levelId);
  const profile = BALANCE.aiProfiles[level.aiProfileId];
  if (!profile) throw new Error('Perfil de IA no encontrado: ' + level.aiProfileId);
  return profile;
}

export function enemyBandForLevel(levelId) {
  const formation = BALANCE.enemyFormations[levelId];
  if (!formation) throw new Error('No hay formación rival para ' + levelId);
  return formation.map(({ pieceType, ...unit }) => ({
    ...unit, team: 'enemy', pieceType,
    name: PIECES[pieceType].name, fallbackGlyph: PIECES[pieceType].fallbackGlyph,
    moveProfile: PIECES[pieceType].moveProfile,
    evolutionProfile: PIECES[pieceType].evolutionProfile ?? null
  }));
}

export function obstaclesForLevel(levelId) {
  const obstacles = BALANCE.levelObstacles[levelId];
  if (!obstacles) throw new Error('No hay obstáculos para ' + levelId);
  return obstacles.map(element => ({ ...element }));
}

export function pointCostForUnit(unit) {
  const stage = unit?.evolutionStage === 'evolved' ? 'evolved' : 'base';
  const cost = BALANCE.pieceCosts?.[unit?.pieceType]?.[stage];
  if (!Number.isFinite(cost) || cost < 0) {
    throw new Error('Falta un coste válido para ' + (unit?.pieceType ?? 'pieza desconocida') + ' (' + stage + ').');
  }
  return cost;
}

export function bandPointValue(units = []) {
  return units.reduce((total, unit) => total + pointCostForUnit(unit), 0);
}

export function levelPointLimit(levelId, enemyUnits = []) {
  const configured = BALANCE.levelPointLimits?.[levelId];
  const enemyValue = bandPointValue(enemyUnits);
  if (configured == null) return enemyValue;
  // A smaller deployment budget is intentional in survival missions.
  const survivalDisadvantage = BALANCE.levelDefinitions[levelId]?.victory === 'survive'
    && configured < enemyValue;
  if (enemyUnits.length && configured !== enemyValue && !survivalDisadvantage) {
    console.warn('[balance] ' + levelId + ': límite ' + configured + ', banda rival ' + enemyValue + '.');
  }
  return configured;
}

/**
 * A disposable, pre-evolved carried band used only by the campaign level picker.
 * 'player' means the currently selected faction; 'special' means its original special piece.
 * None of these test presets are persisted in campaign progress.
 */
export function playerPresetBandForLevel(levelId, playerFactionId = 'green') {
  const faction = getFaction(playerFactionId);
  const preset = BALANCE.playerPresetBands[levelId];
  if (!faction || !preset?.length) throw new Error('Banda de prueba no disponible: ' + levelId);
  return preset.map(unit => ({
    id: unit.id,
    team: 'player',
    pieceType: unit.pieceType === 'special' ? faction.specialPieceType : unit.pieceType,
    faction: unit.faction === 'player' ? playerFactionId : unit.faction,
    facing: unit.facing,
    evolutionStage: unit.evolutionStage
  }));
}

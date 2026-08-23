import { FACINGS, PIECES } from '../bands.js?v=20260821-evolution-3';
import { STANDARD_BOARD } from './shared.js';

function unit(id, team, faction, pieceType, x, y, facing) {
  const piece = PIECES[pieceType];
  return {
    id,
    team,
    faction,
    facing,
    name: piece.name,
    pieceType,
    fallbackGlyph: piece.fallbackGlyph,
    moveProfile: piece.moveProfile,
    evolutionProfile: piece.evolutionProfile ?? null,
    evolutionStage: piece.evolutionProfile ? 'base' : null,
    x,
    y
  };
}

function baseVictoryLab({ id, name, description, rules, units, ai = null }) {
  return Object.freeze({
    id,
    name,
    description,
    nextLevelId: null,
    board: STANDARD_BOARD,
    teams: { player: 'green', enemy: 'red' },
    music: null,
    ai,
    rules: {
      captureChoice: true,
      ...rules
    },
    units,
    boardElements: [],
    specialTiles: [],
    tutorial: { enabledByDefault: false, steps: [] }
  });
}

export function createCaptureKingVictoryLab() {
  return baseVictoryLab({
    id: 'victory-capture-king-lab',
    name: 'Victoria · Capturar rey',
    description: 'Una captura inmediata permite comprobar que eliminar al rey rival termina el encuentro.',
    rules: { victory: 'capture-king' },
    units: [
      unit('player-queen', 'player', 'green', 'queen', 3, 4, FACINGS.NORTH),
      unit('player-king', 'player', 'green', 'king', 0, 7, FACINGS.NORTH),
      unit('enemy-king', 'enemy', 'red', 'king', 3, 3, FACINGS.SOUTH)
    ]
  });
}

export function createEscortKingVictoryLab() {
  return baseVictoryLab({
    id: 'victory-escort-king-lab',
    name: 'Victoria · Cruzar con rey',
    description: 'El rey empieza a una casilla de la fila objetivo para comprobar la victoria al cruzar.',
    rules: {
      victory: 'escort-king',
      targetRow: 0
    },
    units: [
      unit('player-king', 'player', 'green', 'king', 3, 1, FACINGS.NORTH),
      unit('enemy-king', 'enemy', 'red', 'king', 7, 7, FACINGS.SOUTH)
    ]
  });
}

export function createSurvivalVictoryLab() {
  return baseVictoryLab({
    id: 'victory-survive-lab',
    name: 'Victoria · Sobrevivir',
    description: 'Sólo hay que completar una ronda para comprobar que el contador de supervivencia concede la victoria.',
    rules: {
      victory: 'survive',
      surviveRounds: 1
    },
    ai: {
      team: 'enemy',
      depth: 1,
      randomness: 0,
      thinkDelayMs: 150,
      weights: { objective: 1 }
    },
    units: [
      unit('player-king', 'player', 'green', 'king', 0, 7, FACINGS.NORTH),
      unit('enemy-king', 'enemy', 'red', 'king', 7, 0, FACINGS.SOUTH)
    ]
  });
}

export const captureKingVictoryLab = createCaptureKingVictoryLab();
export const escortKingVictoryLab = createEscortKingVictoryLab();
export const survivalVictoryLab = createSurvivalVictoryLab();

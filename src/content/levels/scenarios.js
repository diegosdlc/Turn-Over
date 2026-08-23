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

function baseScenario({ id, name, rules, units, ai = {} }) {
  return Object.freeze({
    id,
    name,
    nextLevelId: null,
    board: STANDARD_BOARD,
    teams: { player: 'green', enemy: 'red' },
    music: {
      track: './assets/music/magiksolo-pirate-tavern-full-version-167990.mp3',
      volume: 0.45,
      loop: true
    },
    ai: {
      team: 'enemy',
      depth: 2,
      randomness: 0.04,
      thinkDelayMs: 450,
      weights: { objective: 1.25 },
      ...ai
    },
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

export function createCaptureKingScenario() {
  return baseScenario({
    id: 'scenario-capture-king',
    name: 'Escenario: Capturar al rey',
    rules: { victory: 'capture-king' },
    units: [
      unit('player-king', 'player', 'green', 'king', 3, 7, FACINGS.NORTH),
      unit('player-queen', 'player', 'green', 'queen', 4, 7, FACINGS.NORTH),
      unit('player-pawn', 'player', 'green', 'pawn', 3, 6, FACINGS.NORTH),
      unit('player-bishop', 'player', 'green', 'bishop', 2, 7, FACINGS.NORTH),
      unit('enemy-king', 'enemy', 'red', 'king', 4, 0, FACINGS.SOUTH),
      unit('enemy-queen', 'enemy', 'red', 'queen', 3, 0, FACINGS.SOUTH),
      unit('enemy-pawn', 'enemy', 'red', 'pawn', 4, 1, FACINGS.SOUTH),
      unit('enemy-rook', 'enemy', 'red', 'rook', 5, 0, FACINGS.SOUTH)
    ]
  });
}

export function createEscortKingScenario() {
  return baseScenario({
    id: 'scenario-escort-king',
    name: 'Escenario: Cruzar con el rey',
    rules: {
      victory: 'escort-king',
      targetRow: 0
    },
    ai: {
      depth: 3,
      randomness: 0.02,
      weights: { objective: 1.6 }
    },
    units: [
      unit('player-king', 'player', 'green', 'king', 3, 7, FACINGS.NORTH),
      unit('player-queen', 'player', 'green', 'queen', 4, 7, FACINGS.NORTH),
      unit('player-pawn', 'player', 'green', 'pawn', 3, 6, FACINGS.NORTH),
      unit('player-bishop', 'player', 'green', 'bishop', 2, 7, FACINGS.NORTH),
      unit('enemy-king', 'enemy', 'red', 'king', 4, 0, FACINGS.SOUTH),
      unit('enemy-queen', 'enemy', 'red', 'queen', 3, 0, FACINGS.SOUTH),
      unit('enemy-pawn', 'enemy', 'red', 'pawn', 4, 1, FACINGS.SOUTH),
      unit('enemy-rook', 'enemy', 'red', 'rook', 5, 0, FACINGS.SOUTH)
    ]
  });
}

export function createSurvivalScenario() {
  return baseScenario({
    id: 'scenario-survive',
    name: 'Escenario: Sobrevivir',
    rules: {
      victory: 'survive',
      surviveRounds: 8
    },
    ai: {
      depth: 2,
      randomness: 0.03,
      weights: { material: 1.15, objective: 1.35 }
    },
    units: [
      unit('player-king', 'player', 'green', 'king', 3, 7, FACINGS.NORTH),
      unit('player-queen', 'player', 'green', 'queen', 4, 7, FACINGS.NORTH),
      unit('player-pawn', 'player', 'green', 'pawn', 3, 6, FACINGS.NORTH),
      unit('player-bishop', 'player', 'green', 'bishop', 2, 7, FACINGS.NORTH),
      unit('enemy-king', 'enemy', 'red', 'king', 4, 0, FACINGS.SOUTH),
      unit('enemy-queen', 'enemy', 'red', 'queen', 3, 0, FACINGS.SOUTH),
      unit('enemy-pawn', 'enemy', 'red', 'pawn', 4, 1, FACINGS.SOUTH),
      unit('enemy-rook', 'enemy', 'red', 'rook', 5, 0, FACINGS.SOUTH),
      unit('enemy-bishop', 'enemy', 'red', 'bishop', 2, 0, FACINGS.SOUTH),
      unit('enemy-knight', 'enemy', 'yellow', 'knight', 6, 0, FACINGS.SOUTH)
    ]
  });
}

export const scenarioCaptureKing = createCaptureKingScenario();
export const scenarioEscortKing = createEscortKingScenario();
export const scenarioSurvive = createSurvivalScenario();

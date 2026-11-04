import { FACINGS, PIECES } from '../bands.js?v=20260821-evolution-3';
import { levelPointLimit } from '../balance.js?v=20260821-budget-1';
import { createLabBehavior } from './labs/behavior.js';
import { STANDARD_BOARD } from './shared.js';

const LAB_ID = 'deployment-budget-lab';

const PIECE_FACTIONS = Object.freeze({
  king: 'green',
  queen: 'green',
  pawn: 'green',
  bishop: 'green',
  knight: 'yellow',
  rook: 'red'
});

const PIECE_TYPES = Object.freeze(['king', 'queen', 'pawn', 'bishop', 'knight', 'rook']);

function playerUnit(pieceType, evolutionStage) {
  const piece = PIECES[pieceType];
  const evolved = evolutionStage === 'evolved';
  return {
    id: `${LAB_ID}-${pieceType}-${evolutionStage}`,
    team: 'player',
    faction: PIECE_FACTIONS[pieceType],
    facing: FACINGS.NORTH,
    name: `${piece.name}${evolved ? '+' : ''}`,
    pieceType,
    fallbackGlyph: piece.fallbackGlyph,
    moveProfile: piece.moveProfile,
    evolutionProfile: piece.evolutionProfile,
    evolutionStage,
    x: 0,
    y: 7
  };
}

function enemyAnchor() {
  const piece = PIECES.king;
  return {
    id: `${LAB_ID}-enemy-anchor`,
    team: 'enemy',
    faction: 'red',
    facing: FACINGS.SOUTH,
    name: 'Ancla rival', i18nNameKey: 'lab.enemy.anchor',
    pieceType: 'king',
    fallbackGlyph: piece.fallbackGlyph,
    moveProfile: piece.moveProfile,
    evolutionProfile: piece.evolutionProfile,
    evolutionStage: 'base',
    x: 7,
    y: 0
  };
}

function enemyRookTestPawn() {
  const piece = PIECES.pawn;
  return {
    id: `${LAB_ID}-enemy-rook-test-pawn`,
    team: 'enemy',
    faction: 'red',
    facing: FACINGS.SOUTH,
    name: 'Peón de prueba para Torre+', i18nNameKey: 'lab.enemy.rook_pawn',
    pieceType: 'pawn',
    fallbackGlyph: piece.fallbackGlyph,
    moveProfile: piece.moveProfile,
    evolutionProfile: piece.evolutionProfile,
    evolutionStage: 'base',
    x: 3,
    y: 5
  };
}

export function createDeploymentBudgetLab() {
  const playerUnits = PIECE_TYPES.flatMap(pieceType => [
    playerUnit(pieceType, 'base'),
    playerUnit(pieceType, 'evolved')
  ]);

  return Object.freeze({
    id: LAB_ID,
    name: 'Laboratorio de presupuesto de despliegue', nameKey: 'level.lab_deployment',
    nextLevelId: null,
    board: STANDARD_BOARD,
    teams: Object.freeze({
      player: 'green',
      enemy: 'red'
    }),
    deployment: Object.freeze({
      team: 'player',
      rows: [6, 7],
      pointLimit: levelPointLimit(LAB_ID)
    }),
    music: null,
    ai: null,
    rules: Object.freeze({
      victory: 'elimination',
      captureChoice: true
    }),
    lab: Object.freeze({
      enabled: true,
      category: 'deployment',
      description: 'Compara costes y capacidades de despliegue de todas las piezas base y evolucionadas con 50 puntos, incluido el escudo de Torre+.', descriptionKey: 'lab.deployment.description_full'
    }),
    behavior: createLabBehavior(),
    units: [
      ...playerUnits,
      enemyRookTestPawn(),
      enemyAnchor()
    ],
    boardElements: [],
    specialTiles: [],
    tutorial: Object.freeze({
      enabledByDefault: false,
      steps: []
    })
  });
}

export const deploymentBudgetLab = createDeploymentBudgetLab();

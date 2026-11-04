import { PIECES } from '../bands.js?v=20260821-evolution-3';
import { createLabBehavior } from './labs/behavior.js';
import { STANDARD_BOARD } from './shared.js';

const TEST_ART = Object.freeze({
  bishop: Object.freeze({
    north: './assets/pieces/facing-lab/bishop-north.svg',
    south: './assets/pieces/facing-lab/bishop-south.svg'
  }),
  rook: Object.freeze({
    north: './assets/pieces/facing-lab/rook-north.svg',
    south: './assets/pieces/facing-lab/rook-south.svg'
  }),
  knight: Object.freeze({
    north: './assets/pieces/facing-lab/knight-north.svg',
    south: './assets/pieces/facing-lab/knight-south.svg'
  })
});

function unit({ id, faction, pieceType, facing, x, y }) {
  const piece = PIECES[pieceType];
  return {
    id,
    team: 'player',
    faction,
    name: `${piece.name} ${faction}`, i18nNameKey: 'ui.unit.' + pieceType, i18nNameParams: {},
    pieceType,
    fallbackGlyph: piece.fallbackGlyph,
    moveProfile: piece.moveProfile,
    facing,
    pieceAssets: TEST_ART[pieceType],
    x,
    y
  };
}

function enemyAnchor() {
  const piece = PIECES.king;
  return {
    id: 'facing-lab-enemy-king',
    team: 'enemy',
    faction: 'green',
    name: 'Rey rival', i18nNameKey: 'lab.enemy.king',
    pieceType: 'king',
    fallbackGlyph: piece.fallbackGlyph,
    moveProfile: piece.moveProfile,
    facing: 'south',
    x: 7,
    y: 0
  };
}

export function createFacingLab() {
  return Object.freeze({
    id: 'facing-lab',
    name: 'Laboratorio de orientación', nameKey: 'level.lab_facing',
    nextLevelId: null,
    board: STANDARD_BOARD,
    teams: Object.freeze({
      player: 'green',
      enemy: 'green'
    }),
    music: null,
    ai: null,
    rules: Object.freeze({
      victory: 'elimination',
      captureChoice: true
    }),
    lab: Object.freeze({
      enabled: true,
      category: 'pieces',
      description: 'Prueba frontal/espalda y cambios de encaramiento.', descriptionKey: 'lab.facing.description'
    }),
    behavior: createLabBehavior({
      flipFacingOnMove: true,
      keepPlayerTurn: true
    }),
    units: [
      unit({ id: 'lab-green-bishop-north', faction: 'green', pieceType: 'bishop', facing: 'north', x: 1, y: 6 }),
      unit({ id: 'lab-green-bishop-south', faction: 'green', pieceType: 'bishop', facing: 'south', x: 1, y: 4 }),
      unit({ id: 'lab-red-rook-north', faction: 'red', pieceType: 'rook', facing: 'north', x: 3, y: 6 }),
      unit({ id: 'lab-red-rook-south', faction: 'red', pieceType: 'rook', facing: 'south', x: 3, y: 4 }),
      unit({ id: 'lab-yellow-knight-north', faction: 'yellow', pieceType: 'knight', facing: 'north', x: 5, y: 6 }),
      unit({ id: 'lab-yellow-knight-south', faction: 'yellow', pieceType: 'knight', facing: 'south', x: 5, y: 4 }),
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

export const facingLab = createFacingLab();

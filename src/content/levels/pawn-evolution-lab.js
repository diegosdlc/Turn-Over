import { PIECES } from '../bands.js?v=20260821-evolution-3';
import { createLabBehavior } from './labs/behavior.js';
import { STANDARD_BOARD } from './shared.js';

function pawn({ id, team = 'player', faction = 'green', name, evolutionStage = 'base', x, y }) {
  const piece = PIECES.pawn;
  return {
    id,
    team,
    faction,
    name,
    pieceType: 'pawn',
    fallbackGlyph: piece.fallbackGlyph,
    moveProfile: piece.moveProfile,
    evolutionProfile: piece.evolutionProfile,
    evolutionStage,
    facing: team === 'player' ? 'north' : 'south',
    x,
    y
  };
}

function enemyAnchor() {
  const piece = PIECES.king;
  return {
    id: 'pawn-evolution-lab-enemy-king',
    team: 'enemy',
    faction: 'red',
    name: 'Ancla rival', i18nNameKey: 'lab.enemy.anchor',
    pieceType: 'king',
    fallbackGlyph: piece.fallbackGlyph,
    moveProfile: piece.moveProfile,
    evolutionProfile: null,
    evolutionStage: null,
    facing: 'south',
    x: 7,
    y: 4
  };
}

const EVOLUTION_TILE = Object.freeze({
  id: 'pawn-evolution-edge',
  name: 'Borde de pruebas del Peón+', i18nNameKey: 'lab.pawn.tile',
  x: 0,
  y: 0,
  className: 'pawn-evolution-tile'
});

export function createPawnEvolutionLab() {
  return Object.freeze({
    id: 'pawn-evolution-lab',
    name: 'Laboratorio de evolución del peón', nameKey: 'level.lab_pawn',
    nextLevelId: null,
    board: STANDARD_BOARD,
    teams: Object.freeze({
      player: 'green',
      enemy: 'red'
    }),
    music: null,
    ai: null,
    rules: Object.freeze({
      victory: 'elimination',
      captureChoice: true
    }),
    lab: Object.freeze({
      enabled: true,
      category: 'evolution',
      description: 'Evoluciona un peón en el borde y prueba sus movimientos y capturas.', descriptionKey: 'lab.pawn.description_full'
    }),
    behavior: createLabBehavior({ keepPlayerTurn: true }),
    units: [
      pawn({ id: 'pawn-ready-to-evolve', name: 'Peón preparado para evolucionar', i18nNameKey: 'lab.pawn.ready', x: 0, y: 1 }),
      pawn({ id: 'pawn-evolved-north-west', name: 'Peón evolucionado: captura noroeste', i18nNameKey: 'lab.pawn.nw', evolutionStage: 'evolved', x: 2, y: 2 }),
      pawn({ id: 'target-north-west', team: 'enemy', faction: 'red', name: 'Objetivo noroeste', i18nNameKey: 'lab.target.nw', x: 1, y: 1 }),
      pawn({ id: 'pawn-evolved-north-east', name: 'Peón evolucionado: captura noreste', i18nNameKey: 'lab.pawn.ne', evolutionStage: 'evolved', x: 5, y: 2 }),
      pawn({ id: 'target-north-east', team: 'enemy', faction: 'red', name: 'Objetivo noreste', i18nNameKey: 'lab.target.ne', x: 6, y: 1 }),
      pawn({ id: 'pawn-evolved-south-west', name: 'Peón evolucionado: captura suroeste', i18nNameKey: 'lab.pawn.sw', evolutionStage: 'evolved', x: 2, y: 5 }),
      pawn({ id: 'target-south-west', team: 'enemy', faction: 'red', name: 'Objetivo suroeste', i18nNameKey: 'lab.target.sw', x: 1, y: 6 }),
      pawn({ id: 'pawn-evolved-south-east', name: 'Peón evolucionado: captura sureste', i18nNameKey: 'lab.pawn.se', evolutionStage: 'evolved', x: 5, y: 5 }),
      pawn({ id: 'target-south-east', team: 'enemy', faction: 'red', name: 'Objetivo sureste', i18nNameKey: 'lab.target.se', x: 6, y: 6 }),
      enemyAnchor()
    ],
    boardElements: [],
    specialTiles: [EVOLUTION_TILE],
    tutorial: Object.freeze({
      enabledByDefault: false,
      steps: []
    })
  });
}

export const pawnEvolutionLab = createPawnEvolutionLab();

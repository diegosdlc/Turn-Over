import { createInitialBand, FACINGS, PIECES } from '../bands.js?v=20260821-evolution-3';
import { levelPointLimit, levelBalance, enemyBandForLevel, obstaclesForLevel } from '../balance.js?v=20260821-budget-1';
import { STANDARD_BOARD } from './shared.js';

const PLAYER_POSITIONS = Object.freeze({
  king: { x: 2, y: 7 },
  queen: { x: 3, y: 7 },
  pawn: { x: 3, y: 6 },
  bishop: { x: 0, y: 7 },
  knight: { x: 0, y: 7 },
  rook: { x: 0, y: 7 }
});

function cleanCarriedBand(playerBand, playerFactionId) {
  if (!Array.isArray(playerBand) || !playerBand.length) {
    return createInitialBand({
      team: 'player',
      factionId: playerFactionId,
      positions: PLAYER_POSITIONS,
      facing: FACINGS.NORTH
    });
  }

  return playerBand.map((unit, index) => {
    const piece = PIECES[unit.pieceType];
    return {
      id: unit.id ?? `player-carried-${unit.pieceType}-${index + 1}`,
      team: 'player',
      faction: unit.faction ?? playerFactionId,
      facing: unit.facing ?? FACINGS.NORTH,
      name: unit.name ?? piece.name,
      pieceType: unit.pieceType,
      fallbackGlyph: unit.fallbackGlyph ?? piece.fallbackGlyph,
      moveProfile: piece.moveProfile,
      evolutionProfile: piece.evolutionProfile ?? null,
      evolutionStage: unit.evolutionStage ?? 'base',
      x: unit.x ?? 0,
      y: unit.y ?? 7
    };
  });
}

export function createTutorialEncounter({
  id,
  playerFactionId = 'green',
  playerBand = null,
  tutorialSteps = []
}) {
  const balance = levelBalance(id);
  if (balance.kind !== 'campaign') throw new Error('Nivel de campaña inválido: ' + id);
  const playerUnits = cleanCarriedBand(playerBand, playerFactionId);
  const enemyUnits = enemyBandForLevel(id);
  const missionKing = balance.missionKingPosition ? {
    id: id + '-mission-king',
    team: 'player',
    faction: playerFactionId,
    facing: FACINGS.NORTH,
    name: PIECES.king.name,
    pieceType: 'king',
    fallbackGlyph: PIECES.king.fallbackGlyph,
    moveProfile: PIECES.king.moveProfile,
    evolutionProfile: null,
    evolutionStage: null,
    missionKing: true,
    ...balance.missionKingPosition
  } : null;

  return Object.freeze({
    id,
    name: balance.name,
    nameKey: balance.nameKey,
    nextLevelId: balance.nextLevelId,
    board: STANDARD_BOARD,
    teams: {
      player: playerFactionId,
      enemy: enemyUnits[0].faction
    },
    deployment: {
      team: 'player',
      mode: 'alternating',
      rounds: 3,
      initialEnemyPieceTypes: ['king'],
      rows: [6, 7],
      enemyRows: [0, 1],
      pointLimit: levelPointLimit(id, enemyUnits)
    },
    music: {
      track: './assets/music/magiksolo-pirate-tavern-full-version-167990.mp3',
      volume: 0.45,
      loop: true
    },
    ai: {
      team: 'enemy',
      depth: balance.aiDepth,
      randomness: balance.aiRandomness,
      thinkDelayMs: balance.aiThinkDelayMs
    },
    rules: {
      victory: balance.victory,
      captureChoice: true,
      ...(balance.targetRow === null ? {} : { targetRow: balance.targetRow }),
      ...(balance.surviveRounds === null ? {} : { surviveRounds: balance.surviveRounds })
    },
    units: [...playerUnits, ...(missionKing ? [missionKing] : []), ...enemyUnits],
    boardElements: obstaclesForLevel(id),
    specialTiles: [],
    tutorial: {
      enabledByDefault: false,
      steps: tutorialSteps
    }
  });
}

const TUTORIAL_STEPS = Object.freeze([
  {
    id: 'select-piece',
    text: 'Toca una de tus piezas para ver sus movimientos posibles.', textKey: 'tutorial.select_piece',
    anchor: { type: 'unit', id: 'player-king' },
    advanceOn: 'unit-selected'
  },
  {
    id: 'move-piece',
    text: 'Las casillas verdes son movimientos disponibles. Toca una para mover.', textKey: 'tutorial.move_piece',
    anchor: { type: 'cell', x: 2, y: 6 },
    advanceOn: 'move-completed'
  },
  {
    id: 'capture-choice',
    text: 'Al atacar una pieza puedes capturarla o destruirla desde los botones que emergen de ella.', textKey: 'tutorial.capture_choice',
    anchor: { type: 'board' },
    advanceOn: 'capture-resolved'
  }
]);

export function createTutorial01({ playerFactionId = 'green' } = {}) {
  return createTutorialEncounter({
    id: 'tutorial-01',
    playerFactionId,
    tutorialSteps: TUTORIAL_STEPS
  });
}

export const tutorial01 = createTutorial01();

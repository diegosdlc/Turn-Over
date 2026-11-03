import { createInitialBand, FACINGS } from '../bands.js?v=20260821-evolution-3';
import { evolveSurvivingBand } from '../../core/evolution.js?v=20260821-evolution-3';
import { createTutorialEncounter } from './tutorial-01.js?v=20261026-rounds-1';

const PLAYER_POSITIONS = Object.freeze({
  king: { x: 2, y: 7 },
  queen: { x: 3, y: 7 },
  pawn: { x: 3, y: 6 },
  bishop: { x: 0, y: 7 },
  knight: { x: 0, y: 7 },
  rook: { x: 0, y: 7 }
});

function defaultEvolvedBand(playerFactionId) {
  return evolveSurvivingBand(createInitialBand({
    team: 'player',
    factionId: playerFactionId,
    positions: PLAYER_POSITIONS,
    facing: FACINGS.NORTH
  }));
}

export function createTutorial02({ playerFactionId = 'green', playerBand = null } = {}) {
  return createTutorialEncounter({
    id: 'tutorial-02',
    name: 'Nivel 2 · Evoluciones',
    nextLevelId: null,
    playerFactionId,
    playerBand: playerBand?.length ? playerBand : defaultEvolvedBand(playerFactionId)
  });
}

export const tutorial02 = createTutorial02();

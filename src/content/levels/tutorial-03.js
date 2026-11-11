import { createTutorialEncounter } from './tutorial-01.js?v=20261111-campaign-picker-1';
import { defaultEvolvedBand } from './tutorial-02.js?v=20261111-campaign-picker-1';

export function createTutorial03({ playerFactionId = 'green', playerBand = null } = {}) {
  return createTutorialEncounter({
    id: 'tutorial-03',
    playerFactionId,
    playerBand: playerBand?.length ? playerBand : defaultEvolvedBand(playerFactionId)
  });
}

export const tutorial03 = createTutorial03();

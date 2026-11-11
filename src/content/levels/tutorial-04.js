import { createTutorialEncounter } from './tutorial-01.js?v=20261111-campaign-picker-1';
import { defaultEvolvedBand } from './tutorial-02.js?v=20261111-campaign-picker-1';

export function createTutorial04({ playerFactionId = 'green', playerBand = null } = {}) {
  return createTutorialEncounter({
    id: 'tutorial-04',
    playerFactionId,
    playerBand: playerBand?.length ? playerBand : defaultEvolvedBand(playerFactionId)
  });
}

export const tutorial04 = createTutorial04();

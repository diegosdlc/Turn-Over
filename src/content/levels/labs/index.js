import { t } from '../../../i18n/index.js';
import { BALANCE } from '../../balance.js?v=20261111-campaign-picker-1';

// The former mechanics-lab selector is temporarily a campaign playtest picker.
// Entries are the real campaign level factories, not duplicated test scenarios.
export const CAMPAIGN_TEST_LEVEL_IDS = Object.freeze(
  Object.values(BALANCE.levelDefinitions)
    .filter(level => level.kind === 'campaign')
    .map(level => level.id)
);

export function listMechanicLabs() {
  return CAMPAIGN_TEST_LEVEL_IDS.map(id => {
    const level = BALANCE.levelDefinitions[id];
    return {
      id,
      name: level.nameKey ? t(level.nameKey) : level.name,
      description: t('notebook.settings.playtest_description')
    };
  });
}

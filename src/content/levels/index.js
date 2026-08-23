import { getMechanicLabFactory, listMechanicLabs } from './labs/index.js?v=20260821-budget-lab-1';
import { createTutorial01, tutorial01 } from './tutorial-01.js?v=20260821-budget-1';
import { createTutorial02, tutorial02 } from './tutorial-02.js?v=20260821-budget-1';
import {
  createCaptureKingScenario,
  createEscortKingScenario,
  createSurvivalScenario,
  scenarioCaptureKing,
  scenarioEscortKing,
  scenarioSurvive
} from './scenarios.js?v=20260822-victory-1';

const SCENARIOS = Object.freeze([
  scenarioCaptureKing,
  scenarioEscortKing,
  scenarioSurvive
]);

const LEVEL_FACTORIES = new Map([
  [tutorial01.id, createTutorial01],
  [tutorial02.id, createTutorial02],
  [scenarioCaptureKing.id, createCaptureKingScenario],
  [scenarioEscortKing.id, createEscortKingScenario],
  [scenarioSurvive.id, createSurvivalScenario]
]);

export function getLevel(levelId, options = {}) {
  const createLevel = LEVEL_FACTORIES.get(levelId) ?? getMechanicLabFactory(levelId);
  return createLevel ? createLevel(options) : null;
}

export function listLevels() {
  return [
    ...LEVEL_FACTORIES.keys(),
    ...listMechanicLabs().map(lab => lab.id)
  ].map(levelId => getLevel(levelId));
}

export { listMechanicLabs };

export function listScenarioLevels() {
  return SCENARIOS.map(level => ({ id: level.id, name: level.name }));
}

export function getNextLevel(level, options = {}) {
  return level?.nextLevelId ? getLevel(level.nextLevelId, {
    playerFactionId: level.teams.player,
    ...options
  }) : null;
}

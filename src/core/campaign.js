import { evolveSurvivingBand } from './evolution.js?v=20260821-evolution-3';

function carryUnit(unit) {
  const carried = {
    ...unit,
    captured: false,
    destroyed: false,
    capturedBy: null,
    evolutionState: undefined
  };
  delete carried.inReserve;
  return carried;
}

export function buildNextPlayerBand(units, levelId) {
  const participatingSurvivors = units.filter(unit => !unit.inReserve && !unit.captured && !unit.destroyed && unit.team === 'player' && !unit.missionKing);
  const reserve = units.filter(unit => unit.inReserve && !unit.captured && !unit.destroyed && unit.team === 'player' && !unit.missionKing);
  const recruits = units.filter(unit => unit.captured && !unit.destroyed && unit.capturedBy === 'player' && !unit.missionKing);

  const evolvedSurvivors = evolveSurvivingBand(participatingSurvivors.map(carryUnit));
  const carriedReserve = reserve.map(carryUnit);
  const newRecruits = recruits.map(unit => ({
    ...carryUnit(unit),
    id: `player-recruit-${levelId}-${unit.id}`,
    team: 'player',
    recruitedBy: 'player'
  }));

  return [...evolvedSurvivors, ...carriedReserve, ...newRecruits];
}

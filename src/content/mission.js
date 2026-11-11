// Mission copy is driven by the level rules, not by a hard-coded level index.
export function missionTextFor(level, translate) {
  const victory = level?.rules?.victory;
  const hasMissionKing = Boolean(level?.hasMissionKing ?? level?.units?.some(unit => unit.missionKing));
  if (victory === 'elimination') return translate('mission.elimination');
  if (victory === 'capture-king') return translate('mission.capture_king');
  if (victory === 'escort-king') {
    return translate(hasMissionKing ? 'mission.escort_king' : 'mission.escort_legacy', { row: (level.rules.targetRow ?? 0) + 1 });
  }
  if (victory === 'survive') {
    return translate('mission.survive_band', { rounds: level.rules.surviveRounds ?? 1 });
  }
  return translate('notebook.mission.fallback');
}

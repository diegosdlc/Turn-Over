# Pre-match deployment

This document defines the reusable pre-match deployment contract for **Turn Over**.

## Purpose

A level may require one band to choose its starting formation before turn 1. During this phase the player chooses which pieces from the carried roster will participate, subject to the level's point budget, and places that lineup manually into a level-defined deployment zone.

Pieces not chosen remain in **reserve**. Reserve pieces still belong to the campaign band but are inactive for the current encounter: they do not occupy cells, generate legal actions, count for victory or enter AI evaluation.

Deployment is a lifecycle phase, not a sequence of normal moves. Movement rules, AI turns and tutorial progression do not begin until deployment is explicitly confirmed.

## Level configuration

A level opts into deployment with a `deployment` block:

```js
deployment: {
  team: 'player',
  rows: [6, 7],
  pointLimit: 18
}
```

- `team` identifies which controlling band deploys.
- `rows` contains the legal board `y` coordinates for placement.
- `pointLimit` is the maximum point value that may participate in the encounter.

Production level limits are resolved through `src/content/balance.js` from `balance/levels.csv`. A level not listed there falls back to the calculated value of its enemy band. Explicit configured limits are compared with the enemy value and produce a console warning when they diverge.

The four campaign levels deploy the player on rows `6` and `7`, nearest the player; budgets are configured in `balance/levels.csv`. Their enemy formations and blocking cells are also CSV-driven.

## Point costs and lineup selection

Every roster piece has a point cost determined by:

1. `pieceType`;
2. `evolutionStage` (`base` or `evolved`).

All costs are read from `balance/pieces.csv` and `balance/levels.csv`. An evolved piece must cost more than its base version.

When a budgeted deployment starts, every player roster piece begins in reserve with `x = null` and `y = null`. Selecting a reserve card previews its legal deployment cells. The piece joins the active lineup only when it is successfully placed on the board, at which point its cost is added to the spent budget.

A reserve piece cannot be placed when its cost would exceed the remaining budget. A placed piece can be **Retirar** from the lineup; this returns it to reserve, clears its coordinates and immediately refunds its points.

The player is not required to spend the entire budget, but at least one piece must be deployed before the encounter can start.

## Lifecycle

`GameState.reset()` sets:

- `phase = 'deployment'` when the level defines `deployment`;
- `phase = 'play'` otherwise.

For a budgeted deployment, deployment-team units begin with `inReserve = true` and cleared coordinates. For legacy/non-budgeted deployment configuration, all deployment units remain participants and only their coordinates are cleared.

The non-deploying team remains at the coordinates defined by the level.

Normal turn resolution is suspended while `phase === 'deployment'`.

## Placement validation

`GameState` is authoritative for deployment validity.

A deployment cell is legal only when:

1. `x` and `y` are inside the current board size;
2. `y` belongs to the configured deployment rows or to rows granted by that unit's evolution capabilities;
3. no other active unit occupies the cell;
4. no blocking `boardElement` occupies the cell;
5. adding a reserve unit would not exceed `pointLimit`.

The UI may highlight valid/invalid placement zones, but it must not implement a separate interpretation of these rules.

Placed deployment pieces may be selected again and moved to another valid deployment cell before play starts.

## Completion and start action

Deployment is complete when:

- at least one deployment-team piece participates;
- every participating piece has coordinates on a valid deployment cell;
- participating pieces occupy unique cells;
- no participating piece overlaps a blocking board element;
- the lineup's point value is within the level limit.

Reserve pieces are intentionally excluded from completion checks.

Only then is **Iniciar partida** available. If the player has selected an additional reserve piece for placement, the start action stays hidden until that candidate is placed or deselected.

Calling the start action transitions the state to `phase = 'play'`, rebuilds team evolution state from participating active units, clears selection and starts normal turn resolution.

## Notebook and board UI

During deployment:

- **Banda** shows the complete carried roster, not only participating pieces;
- every card shows its point cost and evolved pieces display a `+` badge;
- reserve pieces are visually de-emphasized;
- pieces that do not fit in the remaining budget are disabled;
- placed pieces expose **Retirar** so points can be refunded;
- the status line shows spent/maximum points and remaining points;
- the selected piece can come either from the notebook panel or from a piece already placed on the board;
- deployment rows/cells receive board highlighting;
- the start button appears when the current lineup is complete.

After **Iniciar partida**, the normal notebook sections return.

## Session persistence

`GameSessionStore` serializes units, including `inReserve`, together with lifecycle `phase`, active turn and evolution state.

This allows **Continuar partida** to resume a partially built lineup with its exact point spend and placements. The introduction of reserve participation changes the session contract, so the session schema is version `6`. Older in-progress snapshots are intentionally ignored; campaign progression is stored separately and is not lost.

Unit `facing` and `evolutionStage` remain part of each serialized unit and therefore survive deployment/session restoration automatically.

## Reset behavior

Resetting the level rebuilds state from the active level definition. For a budgeted deployment this means:

- returning to `phase = 'deployment'`;
- returning the deployment roster to reserve;
- clearing player deployment coordinates;
- restoring the non-deploying team's declared coordinates;
- restoring each unit's initial faction/facing/evolution state from the level definition;
- resetting spent points to zero.

Do not reset deployment by manually reconstructing the tutorial formation in controller/UI code.

## Interaction with other systems

### Facing

Deployment changes participation and coordinates only. It must not rotate a unit or alter its origin faction. Initial facing still comes from the level/band definition.

### Evolution and campaign carry

Evolved pieces use the evolved cost configured in `balance/pieces.csv` and `balance/levels.csv`.

At a victorious level transition, only participating player survivors are eligible for the normal between-encounter evolution step. Pieces left in reserve carry forward unchanged. A reserve piece that was already evolved remains evolved; a base reserve piece does not evolve for an encounter it did not play.

### Caballo+

An evolved knight extends its own legal deployment depth to four rows from its controlling edge. This is unit-specific: selecting Caballo+ highlights the additional rows, while base pieces continue using the rows declared by the level. Its evolved point cost still applies.

### Rey+ / Reina+

The royal-swap charge is created from the active lineup when play begins. Keeping either member in reserve means the joint swap is unavailable in that encounter.

### Obstacles

Blocking `boardElements` invalidate deployment cells. This uses the same blocking content contract that movement rules use during play.

### AI and victory

Reserve pieces are excluded from `state.active()`. Consequently they do not contribute to legal actions, AI material evaluation or winner detection. If every participating player piece is eliminated, the player loses even if pieces remain in reserve.

### Tutorial

Tutorial steps do not render/advance during deployment. Tutorial progression starts after **Iniciar partida**.

## Notebook access during deployment

Deployment uses the **Banda** section of the notebook, but it does not lock notebook navigation. **Misión**, **Reglas** and **Ajustes** remain visible and interactive throughout setup. Returning to **Banda** restores the current lineup, reserve and placement state intact.

Notebook section content scrolls vertically when it exceeds the available paper area, so long settings and mechanics-lab lists remain reachable during deployment and normal play.

## Relevant files

- `balance/pieces.csv` and `balance/levels.csv` — editable point costs and per-level limits; runtime source of truth.
- `src/content/balance.js` — parser and point-value helpers.
- `src/content/levels/tutorial-01.js` — current deployment configuration and enemy-value validation.
- `src/core/GameState.js` — reserve, point budget, placement and completion logic.
- `src/core/campaign.js` — reserve carry-forward without free evolution.
- `src/main.js` — deployment roster/cost UI, removal and lifecycle orchestration.
- `src/ai/AIController.js` — reserve-aware simulated active state.
- `src/deployment.css` — notebook deployment cards and board highlights.
- `src/systems/GameSessionStore.js` — serialized unit/session state.

## Extending deployment

When adding deployment to another level:

1. Add a `deployment` block with the correct team and legal rows.
2. Add the level limit to `balance/levels.csv` or intentionally rely on the enemy-value fallback.
3. Ensure every piece type that can enter the roster has base/evolved costs in `balance/pieces.csv`.
4. Ensure there are enough non-blocking cells for plausible legal lineups.
5. Keep initial unit facing explicit in the level/band factory.
6. Test that blocking board elements cannot be selected as deployment cells.
7. Test partial-session restore with a mix of reserve and placed pieces.
8. Test reset returns to zero spent points and a full reserve.
9. Confirm AI/tutorial logic remains inactive before **Iniciar partida**.

If future deployment rules need shapes other than whole rows, extend the level configuration and `GameState` validation contract rather than hard-coding a specific level in the UI.

The enemy lineup and exact placement preferences are configured in `balance/enemy-formations.csv`; blocking cells are in `balance/obstacles.csv`. The CSV positions for non-king enemies are preferred in alternating deployment, with the deterministic placement heuristic as fallback.

## Rey de misión predesplegado

Para los objetivos de escolta y supervivencia de la campaña hay un Rey de misión independiente, creado desde la posición del nivel en `balance/levels.csv`. Su `missionKing: true` lo identifica en estado, UI y guardados. Se mantiene activo y fijo durante las tres rondas de despliegue: no consume presupuesto, no entra en las cuotas, no puede seleccionarse para recolocarlo ni retirarse. Al comenzar el combate es una unidad normal controlada por el jugador. Se excluye de la evolución y del roster persistido tras la victoria. La misión solo se considera cumplida si sobrevive o alcanza el objetivo **ese rey**, no otro rey de la banda.

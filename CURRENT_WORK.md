# Turn Over — Current Work

Last updated: 2026-10-24

## Project naming

The official game name is **Turn Over**. Historical working names **Bandas del Tablero** and **Chess Project** are no longer product names. Existing browser-storage keys remain unchanged as legacy technical identifiers until an explicit migration is implemented.

## Current main baseline

`main` is the source of truth. Current gameplay already includes the tabletop level UI, faction selection, deployment, tutorial obstacles, reusable mechanics labs, facing-aware pieces, campaign progression and the first complete set of piece evolutions.

## Level UI

- The level uses the tabletop composition with board, notebook and compact game controls.
- The notebook exposes **Banda**, **Misión**, **Reglas** and **Ajustes**, with multi-page sections.
- During deployment, **Banda** hosts the lineup/deployment panel while the other notebook sections remain available.
- Fine music volume lives in notebook settings; the compact mute control bridges to `AudioManager`.
- The pause dialog blocks board interaction, but engine-level AI timer/state pausing remains pending.
- The menu-to-level shared-notebook transition animation remains deferred until the level composition is stable.

## Pre-match deployment and point budget

The deployment system supports lineup selection by point budget.

- Levels opt in through a declarative `deployment` block. The tutorial uses `team: 'player'`, rows `[6, 7]` and a point limit resolved from balance data.
- The complete carried player roster starts off-board and in reserve for budgeted levels.
- Placing a piece selects it for the encounter and spends its base/evolved cost.
- Unselected pieces remain in campaign reserve, cost zero for the encounter and are inactive for movement, AI and victory detection.
- Placed pieces can be repositioned or **Retirar** to refund their cost.
- `GameState` validates affordability, board bounds, normal/evolution-expanded deployment rows, occupied cells and blocking `boardElements`.
- **Iniciar partida** appears when at least one participating piece is validly placed and the lineup is within budget. Spending the full budget is optional.
- Session schema `6` persists reserve/lineup state, coordinates, facing, evolution state and lifecycle phase.
- Reset returns the deployment roster to reserve and spent points to zero.
- `docs/BALANCE.md` is the runtime-editable source of truth for base/evolved costs and per-level limits.
- The current tutorial enemy band is worth 18 points, so `tutorial-01` and `tutorial-02` currently use an 18-point limit.

See `docs/DEPLOYMENT.md` and `docs/BALANCE.md`.

## Piece evolution and carried roster

- Peón+, Caballo+, Alfil+, Torre+ and the Rey+/Reina+ pair are implemented.
- A base pawn can evolve immediately on reaching the opposite edge.
- Between victorious encounters, only pieces that **participated and survived** evolve.
- Pieces left in deployment reserve carry forward unchanged; they do not gain a free evolution for an encounter they did not play.
- New recruits join without evolving and become eligible after participating in and surviving a later encounter.
- Rey and Reina require joint participation/survival for the between-level royal evolution.
- Evolved pieces use the higher deployment cost configured in `docs/BALANCE.md`.
- `tutorial-01` unlocks `tutorial-02`, which uses the complete carried roster for the next deployment choice.

See `docs/EVOLUTION.md`.

## Piece facing

- Units have explicit `facing`: `north` or `south`.
- `team`, origin `faction` and `facing` remain independent.
- The tutorial starts player pieces facing north and enemy pieces facing south.
- `GameState.setFacing()` and `GameState.turnAround()` are authoritative orientation operations.
- `AssetRegistry.pieceAsset()` supports optional artwork by faction, piece type and facing, with CSS token fallback.

See `docs/FACTIONS_AND_BANDS.md`.

## Mechanics labs

- Registered labs automatically become addressable by level id and appear in **Ajustes → Laboratorios de mecánicas**.
- Lab-only conveniences use generic level behavior hooks rather than hard-coded lab ids in core systems.
- `facing-lab` validates orientation/art selection.
- `pawn-evolution-lab` validates pawn evolution and evolved-pawn movement/capture cases.
- `deployment-budget-lab` exposes base and evolved versions of all six piece types simultaneously with a 50-point budget, using the production deployment/affordability rules. It is available directly through `?level=deployment-budget-lab` and from the lab list in settings.

See `docs/MECHANICS_LABS.md`.

## Tutorial obstacles

- The tutorial declares three blocking `boardElements`.
- Blocking squares cannot be occupied or captured onto; sliding movement stops at them and knights may jump over them without landing on them.
- Human and AI use the same legal-action generator.
- Frozen-piece pass-through remains separate from solid board obstacles.

See `assets/board-elements/README.md`.

## Session and turn lifecycle

A session snapshot is saved during deployment, after play starts and after each completed move. Schema `6` stores the selected faction, serialized units (including facing, evolution and reserve participation), active turn, finished state, team evolution uses, lifecycle phase and completed survival rounds (`roundsElapsed`). Existing schema-6 snapshots without the counter still load, with a zero-round fallback. Completed encounters clear the in-progress session; campaign progression remains separate in `ProgressionStore`.

The no-legal-moves lifecycle is implemented: a side with no legal move loses its turn; if neither side can move, the encounter ends with **Tablas** and offers **Reiniciar encuentro**.

## Factions and starting bands

Playable factions are **Verde** (alfil), **Roja** (torre) and **Amarilla** (caballo). A new starting band contains rey, reina, peón and the selected faction's special piece. The tutorial opponent is always Verde.

Production factions currently fall back to CSS chess-token graphics when final bitmap artwork is not configured.

## Remaining work / next focus

- implement engine-level pause semantics for AI timers/state;
- replace placeholder notebook content with final level-specific content;
- implement the menu-to-level notebook transition animation;
- replace placeholder obstacle/facing/evolution artwork with final production assets;
- iterate the numbers in `docs/BALANCE.md` as gameplay testing produces better cost/limit data.

## Local development

Open the project through an HTTP static server rather than `file:///`.

Before implementation on Windows:

```bash
git status
git switch main
git pull --ff-only origin main
```

Then read `PROJECT_CONTEXT.md`, this file, `README.md`, the relevant contract in `docs/`, and the relevant source files. Commit and push durable changes before changing device/environment.

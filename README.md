# Turn Over

Turn Over is a browser-based tactical board game built around chess-derived movement, faction-specific bands, capture/destroy choices, campaign recruitment, piece facing and persistent evolution.

The repository is intentionally framework-light: gameplay is implemented with native JavaScript modules, HTML and CSS so mechanics can be iterated quickly and deployed as a static site.

## Source of truth

GitHub `main` is the canonical project state. Before implementation work, sync `main` and read:

- `PROJECT_CONTEXT.md` for durable architecture/product decisions;
- `CURRENT_WORK.md` for the current implementation baseline;
- the relevant contract under `docs/`;
- the source files for the subsystem being changed.

Do not treat an old local checkout or chat transcript as authoritative over the repository.

## Running locally

Serve the repository through HTTP rather than opening `index.html` directly with `file:///`. Runtime balancing tables are loaded from the `balance/` CSV directory, so a static HTTP server is required.

For example:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/`.

## High-level structure

- `src/main.js` — app/encounter controller and UI orchestration.
- `src/core/GameState.js` — encounter state, deployment lifecycle and reusable state operations.
- `src/core/rules.js` — legal movement/action generation.
- `src/core/evolution.js` — generic evolution capabilities and team-evolution state.
- `src/core/campaign.js` — between-level carried-roster evolution/recruitment.
- `src/ai/AIController.js` — minimax-style opponent using the shared rules/state contract.
- `src/content/factions.js` — playable factions and art/palette metadata.
- `src/content/bands.js` — chess-derived piece definitions and starting-band creation.
- `src/content/balance.js` — runtime parser/accessor for editable point-balance data.
- `src/content/levels/` — production encounters and independent development scenarios.
- `src/systems/ProgressionStore.js` — persistent campaign progression/carried band.
- `src/systems/GameSessionStore.js` — resumable in-progress encounter snapshot.
- `balance/` — four production balancing CSV tables, plus a fifth editable playtest roster CSV.

## Current gameplay model

A new game begins by choosing Verde, Roja or Amarilla. Each starts with Rey, Reina, Peón and the faction's special piece (Alfil, Torre or Caballo respectively).

Before budgeted encounters the player's complete carried roster starts in reserve. The player chooses which pieces participate, places them in legal deployment rows and spends the encounter's point budget. Base and evolved versions have separate costs configured in the `balance/` CSV files. Pieces left in reserve remain in the campaign but are inactive for that encounter.

Captured pieces are frozen prisoners on the board until resolved; capture/destroy remains an explicit choice. Blocking board elements are separate from frozen prisoners. The AI and human player use the same legal-action generator.

After a victorious encounter, participating survivors evolve according to their profiles and captured enemy survivors may join the carried roster. Reserve pieces carry forward unchanged rather than receiving evolution for encounters they skipped.

## Piece evolution

The current complete evolution set is:

- Peón+ — can move both vertical directions and capture on all four diagonals; a base pawn also evolves immediately on reaching the opposite edge.
- Caballo+ — may deploy inside the first four friendly rows.
- Alfil+ — may rebound once from a non-corner board edge.
- Torre+ — rejects the first incoming attack of each encounter.
- Rey+ / Reina+ — if both are evolved and active in the lineup, they may exchange positions once per encounter.

See [`docs/EVOLUTION.md`](docs/EVOLUTION.md).

## Deployment and balance

Budgeted deployment is declarative per level. `GameState` owns reserve participation, affordability, placement legality, refunds and the transition into play. Spending the entire allowance is optional, but at least one piece must participate.

Costs, budgets, enemy formations, victory objectives and obstacle locations live in the four CSVs under [`balance/`](balance/). The browser loads them at runtime, so tweaking encounters does not require code edits. Test-only carried rosters live in a fifth CSV, `balance/player-presets.csv`. See [`docs/BALANCE.md`](docs/BALANCE.md) for validation rules.

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Temporary campaign playtests

**Ajustes → Pruebas de campaña** uses the former mechanics-lab dropdown to launch the four **real** production encounters in isolated test mode. Open the selector or visit `?level=tutorial-02&lab=1` (optionally `&faction=red` or `&faction=yellow`). Normal `?level=tutorial-02` continues to use the carried campaign roster.

In playtest mode the starting roster is read from `balance/player-presets.csv` instead of campaign progression. It models evolved survivors and recruits separately for each level; deployment and point limits still apply. Testing does not overwrite the normal in-progress session or campaign progression. Legacy mechanics labs are retired; `scenario-*` development scenarios remain available directly through their URLs.

Escort missions mark unblocked squares on the target row with gold destination flags.

See [`docs/MECHANICS_LABS.md`](docs/MECHANICS_LABS.md) and [`docs/BALANCE.md`](docs/BALANCE.md).

## Progression and local session

`ProgressionStore` tracks completed/unlocked levels, recruits and the complete carried player roster. The encounter lineup is selected separately during deployment; reserve pieces remain part of that carried roster.

Session schema `7` saves in-progress units (including facing, evolution and reserve state), turn, lifecycle phase and team evolution uses. **Continuar partida** can resume an interrupted lineup/deployment. Completed encounters clear the in-progress session while campaign progression remains.

## Useful development URLs

- `?level=tutorial-01&tutorial=1` — force tutorial tooltips.
- `?level=<level-id>` — open a normal campaign encounter or a development `scenario-*` directly.
- `?level=tutorial-02&lab=1` — isolated campaign level 2 playtest using the CSV roster.
- `?level=tutorial-02&faction=<green|red|yellow>` — direct evolved-band development shortcut when there is no saved carried roster.
- `?level=tutorial-03` / `?level=tutorial-04` — directly test the capture/survival campaign encounters.

## Project documentation

- [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) — durable architecture/product decisions and workflow.
- [`CURRENT_WORK.md`](CURRENT_WORK.md) — current merged baseline and remaining work.
- [`docs/BALANCE.md`](docs/BALANCE.md) — guide to the four runtime-editable balancing CSVs.
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — deployment, lineup/reserve and budget contract.
- [`docs/EVOLUTION.md`](docs/EVOLUTION.md) — evolution and carried-roster contract.
- [`docs/FACTIONS_AND_BANDS.md`](docs/FACTIONS_AND_BANDS.md) — faction/band/facing/artwork contract.
- [`docs/MECHANICS_LABS.md`](docs/MECHANICS_LABS.md) — mechanics-lab workflow.

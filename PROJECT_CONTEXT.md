# Turn Over — Shared Project Context

This document is the durable development context for **Turn Over** across local and cloud environments.

## Naming and source of truth

**Turn Over** is the official product/game name. Historical working names such as **Bandas del Tablero** and **Chess Project** are not product names.

**GitHub is the single source of truth** for code, assets and project documentation.

Repository: `diegosdlc/Turn-Over`  
Default branch: `main`

Before changing code, read `PROJECT_CONTEXT.md`, `CURRENT_WORK.md`, `README.md`, the relevant contract in `docs/`, and the current implementation. If conversation history conflicts with GitHub, resolve the discrepancy from the repository and Git history.

## Product direction

Turn Over is a browser strategy game derived from chess vocabulary but governed by custom rules. The architecture should support:

- multiple data-driven levels;
- custom board, faction, piece and board-element assets;
- faction-specific front/back piece artwork;
- deployment zones and lineup budgets;
- obstacles and special cells;
- music and tutorial UI;
- persistent campaign rosters and evolution;
- reusable AI over shared legal moves;
- reusable mechanics-lab levels for isolated testing;
- future piece/rule additions without rewriting the AI.

Keep authoritative rules/state separate from rendering and UI whenever practical.

## Current architecture

- `src/main.js` — application controller, lifecycle orchestration, deployment UI and turn resolution.
- `src/core/` — game state, geometry, movement rules, campaign transition and evolution mechanics.
- `src/ai/` — reusable AI consuming the shared legal-action generator.
- `src/render/` — board, piece and terrain rendering.
- `src/systems/` — assets, audio, sessions, progression and tutorial systems.
- `src/content/factions.js` — faction identity, special pieces, palettes and optional artwork definitions.
- `src/content/bands.js` — piece catalogue, starting-band factory and `FACINGS`.
- `src/content/balance.js` — runtime CSV parser/helpers for piece costs, level budgets, enemy formations and obstacles.
- `src/content/levels/` — production levels, shared boards and mechanics-lab scenarios.
- `src/content/levels/labs/` — mechanics-lab registry and test-only behavior helpers.
- `src/level-ui.js` / `src/level-ui.css` — notebook navigation and in-level composition.
- `src/deployment.css` — deployment/lineup presentation.
- `assets/` — boards, menu art, pieces, music and board elements.

Detailed contracts:

- `docs/FACTIONS_AND_BANDS.md` — factions, bands, facing, artwork and persistence.
- `docs/DEPLOYMENT.md` — deployment, lineup/reserve and point-budget lifecycle.
- `balance/*.csv` — runtime-editable piece costs, budgets/objectives, enemy formations and obstacle positions; `docs/BALANCE.md` documents the CSV contract.
- `docs/EVOLUTION.md` — evolution and carried-roster rules.
- `docs/MECHANICS_LABS.md` — reusable test-level workflow.
- `docs/MECHANICS_LABS.md` — current campaign playtest picker and CSV roster contract.

## Established game/design decisions

1. This is **not standard chess**; project rules take precedence.
2. Player and enemy pawns move in opposite directions and only use explicitly implemented pawn rules.
3. Board artwork/projection and logical coordinates must remain aligned.
4. Capture interaction uses contextual controls near the target piece.
5. Real repository assets must remain loadable independently from rule logic.
6. Level setup, assets, deployment, behavior hooks and difficulty should be data-driven.
7. Human interaction and AI must consume the same authoritative legal-action generator.
8. AI difficulty should be configurable per level without duplicating the AI.
9. New pieces/rules should primarily extend the rules/move-generation layer.
10. The game opens on a start screen and keeps in-progress session state separate from campaign progression.
11. The UI language is paper-cut collage with pencil/handmade treatment.
12. Playable factions are **Verde**, **Roja** and **Amarilla**; their special pieces are alfil, torre and caballo.
13. A new starting band contains rey, reina, peón and the faction special piece. The tutorial opponent is always Verde.
14. `team`, origin `faction` and `facing` are independent unit properties.
15. Facing is explicit state (`north` / `south`) and changes only through explicit mechanics.
16. Piece artwork may resolve as `faction -> pieceType -> facing`; CSS tokens remain the fallback.
17. Levels may define pre-match deployment. Movement/AI/tutorial logic starts only after explicit deployment confirmation.
18. Blocking `boardElements` are authoritative for both movement and deployment validity.
19. Mechanics labs must use production engine operations and generic hooks, never hard-coded lab-id branches in core systems.
20. Evolution is generic per-piece state shared by player rules, AI and persistence.
21. Base pawns may evolve immediately at the opposite edge; other between-level evolution requires participation and survival in a victorious encounter.
22. Campaign transitions preserve the complete player roster: participating survivors may evolve, reserve pieces carry forward unchanged, new prisoners join without evolving, and losses are removed.
23. **Budgeted deployment chooses the encounter lineup from the carried roster.** Placed pieces consume points; reserve pieces are inactive and consume zero. The lineup may not exceed the level limit.
24. Base/evolved piece costs, four campaign level budgets/objectives, rival formations and obstacles are balance data, not hard-coded rule constants. The four CSV tables in `balance/` are the runtime source of truth.
25. The intended level limit is equivalent to the enemy band's point value; the balance layer warns when an explicit level limit diverges from the calculated enemy value.
26. Session schema 7 persists survival `roundsElapsed` and alternating deployment state. Existing schema-6 saves load with missing counters defaulting to zero; in-progress deployment stays classic.

## No-legal-moves rule

At the start of a turn, if the active side has no legal move it automatically loses/passes that turn. If the other side also has no legal move, the encounter ends in **Tablas**. Reset must recreate the active level from its definition so deployment, facing, obstacles and future rules reset consistently.

## Development principles

### One rules engine

Rendering, player interaction and AI should call the same movement/rules layer.

### Data-driven levels and balance

Prefer content/configuration for level setup, assets, deployment zones, behavior hooks and difficulty. Keep balance numbers in the `balance/` CSV tables; do not scatter level-specific costs through rules/UI code.

### State is authoritative

Gameplay properties such as team, faction, facing, evolution, reserve participation, capture/destruction and lifecycle phase belong to game state. Rendering reflects that state rather than inventing its own interpretation.

### Campaign roster vs encounter lineup

`ProgressionStore.playerBand` is the carried campaign roster. Budgeted deployment selects a temporary encounter lineup from it. Reserve pieces remain campaign-owned but are not active encounter pieces and do not evolve from an encounter they skipped.

### Reset from level definition

Do not reconstruct today's tutorial manually in UI/controller code. Reset from the current level definition.

### Mechanics labs stay isolated

Test-only conveniences live in lab content/behavior hooks, not production branches tied to lab ids.

## Cross-device workflow

GitHub coordinates Windows/local and Android/cloud work.

At the start of local work:

```bash
git status
git switch main
git pull --ff-only origin main
```

Use focused branches for substantive changes, keep commits coherent, push before changing environments, and never overwrite newer remote work merely because a local checkout is older.

## Session handoff protocol

At the start of a coding session:

1. read `PROJECT_CONTEXT.md`;
2. read `CURRENT_WORK.md`;
3. read `README.md`;
4. inspect the current GitHub/local branch and latest commits;
5. inspect the relevant implementation and contract docs.

At the end of a project change:

1. update code/assets;
2. run available validation;
3. update `CURRENT_WORK.md` for status/next steps;
4. update `PROJECT_CONTEXT.md` for durable decisions;
5. update the affected system contract(s);
6. commit and push;
7. report branch/commit/PR and validation.

## Four-level production campaign

The campaign consists of `tutorial-01` (elimination/destruction), `tutorial-02` (escort-king), `tutorial-03` (capture-king) and `tutorial-04` (survive), in that order. Independent `scenario-*` development fixtures remain available, but retired mechanics labs are no longer registered. The game loads four CSVs in `balance/` at runtime: costs, level budgets/objectives, rival formations and obstacles. Keep CSV IDs stable to preserve progression and session compatibility. 

## Mission king rules

Only escort (`tutorial-02`) instantiates an extra `missionKing: true`, placed from `mission_king_x/y` in `balance/levels.csv`. It is player-controlled, predeployed, locked, free and never carried/evolved. Survival (`tutorial-04`) has no extra mission king and any active player unit can survive its configured rounds. Losing the ordinary king does not cause defeat. Notebook mission copy is derived from level victory rules and localized through `locales/texts.csv`.

## Arena encroachment
After completed combat action #10 (configurable per campaign level in `balance/levels.csv`) each subsequent action causes one new permanent wall, unless standard victory has already occurred. Candidate walls must preserve legal actions for both sides, geometric connectivity between teams and an escort route. If none is valid the player loses and the current level restarts. Dynamic obstacles and RNG seed live in `GameState` and session saves; AI uses current obstacles and projects immediate closure at root. See `docs/BALANCE.md`.

## Collapse warning and destruction

The arena warning begins at action `encroachment_start_action - 1`, and each subsequent completed action resolves the previous warning and selects another. Pieces or captured prisoners still on the warned tile are destroyed with no recruitment; victory is checked again after the closure. `pendingClosure` is persisted in session state and restored for deterministic continuation. Walls are smaller and visually animated; the warning is animated independently, and both respect reduced-motion preferences. Rules copy is maintained in `locales/texts.csv`.

## Asymmetric capture mission

In `capture-king`, player wins if enemy king is captured/destroyed; enemy wins only by eliminating all active player pieces. The player's king is ordinary material in this mission and its loss does not deactivate the remaining band. The AI protects its own king, and does not score a player-king assassination as terminal success.


## Temporary campaign playtest selector (PR #22 extension, 2026-11-11)

- The former mechanics labs are retired from the registry. The notebook settings dropdown lists the four real campaign levels.
- `?level=tutorial-XX&lab=1` starts an isolated test run, using `balance/player-presets.csv` for the carried player band; normal campaign mode and `?level=tutorial-XX` still use real progression/session state.
- `player` faction and `special` piece placeholders resolve dynamically to the selected playable faction, while recruit factions remain as configured.
- The selected test roster remains in reserve for the standard budgeted three-wave deployment. Test results must not clear, overwrite or advance normal save/progression data.
- Escort goal markers are generated from the exact `targetRow` victory rule and skip blocked cells; they are non-interactive visual feedback, not new game rules.
- The previous mechanics-lab factories/behavior are no longer required for the application. Development `scenario-*` fixtures and engine-level mechanic tests remain independent.

## Survival rounds HUD and intentional disadvantage

Survival (`tutorial-04`) has an asymmetric 20-point player budget against 30 enemy. Survive eight completed enemy turns (including skips) with at least one active band unit. No extra protected king. `src/core/survival.js` drives a fixed localized countdown; saved `roundsElapsed` restores progress. Legacy saves are migrated by discarding the obsolete free king. Elimination of all enemies remains an early victory alternative.

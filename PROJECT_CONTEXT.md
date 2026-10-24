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
- `src/content/balance.js` — runtime parser/helpers for editable piece costs and level point limits.
- `src/content/levels/` — production levels, shared boards and mechanics-lab scenarios.
- `src/content/levels/labs/` — mechanics-lab registry and test-only behavior helpers.
- `src/level-ui.js` / `src/level-ui.css` — notebook navigation and in-level composition.
- `src/deployment.css` — deployment/lineup presentation.
- `assets/` — boards, menu art, pieces, music and board elements.

Detailed contracts:

- `docs/FACTIONS_AND_BANDS.md` — factions, bands, facing, artwork and persistence.
- `docs/DEPLOYMENT.md` — deployment, lineup/reserve and point-budget lifecycle.
- `docs/BALANCE.md` — runtime-editable base/evolved costs and per-level point limits.
- `docs/EVOLUTION.md` — evolution and carried-roster rules.
- `docs/MECHANICS_LABS.md` — reusable test-level workflow.
- `docs/FACING_LAB.md` — facing-lab test procedure.

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
24. Base/evolved piece costs and per-level point limits are balance data, not hard-coded rule constants. `docs/BALANCE.md` is the editable runtime source of truth.
25. The intended level limit is equivalent to the enemy band's point value; the balance layer warns when an explicit level limit diverges from the calculated enemy value.
26. Session snapshots persist objective progress such as survival `roundsElapsed`. Existing schema-6 saves without this field load with zero rounds.

## No-legal-moves rule

At the start of a turn, if the active side has no legal move it automatically loses/passes that turn. If the other side also has no legal move, the encounter ends in **Tablas**. Reset must recreate the active level from its definition so deployment, facing, obstacles and future rules reset consistently.

## Development principles

### One rules engine

Rendering, player interaction and AI should call the same movement/rules layer.

### Data-driven levels and balance

Prefer content/configuration for level setup, assets, deployment zones, behavior hooks and difficulty. Keep balance numbers in `docs/BALANCE.md`; do not scatter level-specific costs through rules/UI code.

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

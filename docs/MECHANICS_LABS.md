# Mechanics labs

Mechanics labs are small development levels for exercising one gameplay system repeatedly without changing production progression or normal level rules.

## Architecture

The reusable pieces are:

- `src/content/levels/labs/index.js` — single registry used by level loading and the Level UI settings menu;
- `src/content/levels/labs/behavior.js` — helpers for lab-only lifecycle behavior;
- `src/content/levels/shared.js` — shared board definitions such as `STANDARD_BOARD`;
- `src/content/levels/<name>-lab.js` — the actual scenario definition;
- `docs/<NAME>_LAB.md` — scenario-specific purpose and test procedure.

A registered lab is automatically addressable through `?level=<lab-id>` and automatically appears in the notebook's **Ajustes → Laboratorios de mecánicas** list.

## Adding a lab

1. Create the scenario file under `src/content/levels/` and export a factory plus one instantiated level object.
2. Reuse `STANDARD_BOARD` unless the mechanic specifically needs another board/projection.
3. Put repeated test-only behavior behind generic lifecycle hooks created by `createLabBehavior()` or another reusable behavior helper.
4. Add one entry to `MECHANIC_LABS` in `src/content/levels/labs/index.js` with `id`, `name`, `description` and `createLevel`.
5. Add temporary assets only when they materially help observe the state being tested.
6. Document the expected interaction and observable result.

No change to `src/level-ui.js` or the normal level registry should be necessary.

## Design rules

Labs should exercise the same engine operations used by production levels. Avoid implementing a fake copy of a mechanic purely for the test screen.

Lab conveniences such as fixed turns, automatic state changes or special visual markers must be isolated in level behavior/configuration and must not be inferred from a hard-coded lab id in the engine.

Core systems may expose generic lifecycle hooks when useful, but they must not contain branches like `if (level.id === 'some-lab')` or a growing collection of mechanic-specific testing flags.

A lab should be disposable: removing its registry entry and scenario should not change production gameplay.

## Current labs

- `facing-lab` — validates `north` / `south` piece facing, artwork selection and in-match orientation changes.
- `pawn-evolution-lab` — validates edge activation, Peón+ movement and four prepared diagonal-capture cases.
- `deployment-budget-lab` — validates lineup selection by points with a 50-point budget. The roster exposes base and evolved versions of king, queen, pawn, bishop, knight and rook simultaneously, so costs and evolved deployment capabilities can be compared directly. Its budget is configured in `balance/levels.csv`.

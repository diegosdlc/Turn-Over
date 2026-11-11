# Turn Over — Current Work

Last updated: 2026-11-10

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
- Session schema `7` persists alternating deployment rounds and commitments; schema-6 saves remain loadable.
- Reset returns the deployment roster to reserve and spent points to zero.
- `balance/` CSV files are the runtime source of truth for costs, level limits, rival formations and obstacle positions.
- Four campaign levels are linked in order: destruction (18), escort (22), capture of king (26) and survival (20 player vs 30 enemy points). The survival disadvantage is intentional.

See `docs/DEPLOYMENT.md`, `balance/` and the four files in `balance/`.

## Piece evolution and carried roster

- Peón+, Caballo+, Alfil+, Torre+ and the Rey+/Reina+ pair are implemented.
- A base pawn can evolve immediately on reaching the opposite edge.
- Between victorious encounters, only pieces that **participated and survived** evolve.
- Pieces left in deployment reserve carry forward unchanged; they do not gain a free evolution for an encounter they did not play.
- New recruits join without evolving and become eligible after participating in and surviving a later encounter.
- Rey and Reina require joint participation/survival for the between-level royal evolution.
- Evolved pieces use the higher deployment cost configured in `balance/`.
- `tutorial-01` unlocks `tutorial-02`, which uses the complete carried roster for the next deployment choice.

See `docs/EVOLUTION.md`.

## Piece facing

- Units have explicit `facing`: `north` or `south`.
- `team`, origin `faction` and `facing` remain independent.
- The tutorial starts player pieces facing north and enemy pieces facing south.
- `GameState.setFacing()` and `GameState.turnAround()` are authoritative orientation operations.
- All pieces select `north` (up on screen) or `south` (down on screen) from the projected vertical component of completed displacement, including logical east/west moves on the isometric board. Approximately lateral moves retain their facing. Pawns now turn when their actual direction changes, not simply because they reached an edge. Applied to player, AI, captures/destruction, shield-rejected moves and royal swaps. The persisted facing drives artwork; movement/AI rules are unchanged.
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

A session snapshot is saved during deployment, after play starts and after each completed move. Schema `7` stores the selected faction, serialized units (including facing, evolution and reserve participation), active turn, finished state, team evolution uses, lifecycle phase and completed survival rounds (`roundsElapsed`). Schema-6 snapshots still load (missing round counters default to zero), and in-progress legacy deployment continues in classic mode. Completed encounters clear the in-progress session; campaign progression remains separate in `ProgressionStore`.

The no-legal-moves lifecycle is implemented: a side with no legal move loses its turn; if neither side can move, the encounter ends with **Tablas** and offers **Reiniciar encuentro**.

## Factions and starting bands

Playable factions are **Verde** (alfil), **Roja** (torre) and **Amarilla** (caballo). A new starting band contains rey, reina, peón and the selected faction's special piece. Campaign opponents are **Roja → Amarilla → Roja → Amarilla**, from `tutorial-01` through `tutorial-04`.

The green faction pawn uses turquoise glass WebP sprites: north shows its back at a three-quarter angle, south shows its front. The asset is selected from the piece's origin faction and its explicit facing, independently of controlling team. Other pieces retain the CSS chess-token fallback.

## Remaining work / next focus

- implement engine-level pause semantics for AI timers/state;
- replace placeholder notebook content with final level-specific content;
- implement the menu-to-level notebook transition animation;
- replace placeholder obstacle/facing/evolution artwork with final production assets;
- iterate the four balance CSV tables as gameplay tests establish suitable costs, budgets and level layouts.

## Local development

Open the project through an HTTP static server rather than `file:///`.

Before implementation on Windows:

```bash
git status
git switch main
git pull --ff-only origin main
```

Then read `PROJECT_CONTEXT.md`, this file, `README.md`, the relevant contract in `docs/`, and the relevant source files. Commit and push durable changes before changing device/environment.

## Current campaign balancing

The production campaign has four CSV-driven encounters: `tutorial-01` destruction, `tutorial-02` escort, `tutorial-03` capture and `tutorial-04` survival. All use three-wave alternating deployment. The rival king begins at the configured square; further enemy units prefer their configured positions when each deployment wave is placed. Debug scenarios and labs remain separately available. Automated CSV validation covers budgets, victory conditions, enemy lineups, obstacles and invalid CSV inputs.

## PR #20 extension — special king and mission page

Escort adds an independently identified player-controlled mission king, fixed at deployment start, marked on board and in notebooks, cost-free and excluded from carried rosters and deployment quotas. Its loss ends the escort mission. Survival has no special king: any active unit may survive the timer. Level-specific mission descriptions now appear in the mission notebook, with ES/EN localization.

## Deployment integration verification (PR #20)

Reviewed GitHub Actions Pages deployment for PR #20: the latest Pages run reported success and included `preview/pr-20`; earlier failed statuses were unit tests, not Pages deployment. Added static asset and syntax checks so missing module imports or invalid JavaScript in browser-only entrypoints fail CI. Ensured the mission king is visibly marked in the in-game band notebook and updated stylesheet query versions to invalidate old browser caches.

## Progressive arena closure
Four campaign levels close one extra tile per completed combat action from action 10, using the `encroachment_start_action` balance CSV column. The scheduler excludes occupied cells and preserves moves for both teams, shared geometry and the escort goal path. No candidate results in player defeat and automatic level reset. Blocked cells, action count and RNG seed persist with the session. AI search includes a one-ply closure projection and space heuristic. Scenarios and labs keep this off unless explicitly configured. `tests/encroachment.test.js` covers corridor, prisoners, counts, persistence and AI simulation.

## Preview: warning and tile collapse

A pending closure is previewed one combat action in advance. The warning and smaller wall have CSS entry animations; the current warning is stored in `pendingClosure` and restored on reload. If an active piece or frozen prisoner moves onto the warned tile before the wall arrives, it is destroyed when the tile collapses and terminal objectives are evaluated again. The rules notebook and balance guide describe the hazard in Spanish and English.

## Capture-king objective correction

Capture is deliberately asymmetric: only the defender's (enemy) king is a terminal target. The defending AI must eliminate the full player band to win. Removing the player's king does not disable remaining pieces or end the battle. Mission text is updated in Spanish/English and the AI objective evaluation now rewards defending its own king, without granting a royal-target bonus for killing the player's king.

## Piece action animations (PR preview, 2026-11-11)

The board presentation now plays visual-only CSS feedback without changing combat rules or serialized state:

- A placed piece fades into view with a short glow/starburst; AI deployment waves receive the same cue.
- A selected piece raises and gently floats until it is deselected or moved.
- A completed movement floats across the projected board coordinates to its target, for both player and AI (including capture, destroy and deployment reposition).
- Captured prisoners remain visibly bound with a chain graphic, and a short chain burst announces capture.
- A crossed-swords burst announces destruction.
- All effects are ignored when the user prefers reduced motion. They are not persisted or replayed when loading saved sessions. The AI waits for movement visuals before taking its next action.

Animation geometry and timing live under `src/render/animationGeometry.js`, presentation under `src/render/BoardRenderer.js` and `src/styles.css`, and triggers under `src/main.js`. Run `npm test` and verify visually on mobile and desktop, including resumed battles and alternating enemy deployment.


## 2026-11-11 — Campaign playtest picker (PR #22)

The old mechanics-lab menu has been repurposed as **Pruebas de campaña**: the four production level IDs now appear in the same settings dropdown. Selecting a level opens `?level=<id>&lab=1` with the current player faction, using a separate editable roster in `balance/player-presets.csv`. Normal `?level=<id>` behavior remains unchanged. Test-mode victory, restart and next-level navigation are isolated from normal session saves, campaign unlocks and carried-band progression; the three-wave deployment and budget apply as in production.

Escorts mark all non-blocking cells in the victory target row, with a visual goal flag. The marker updates with arena closure and respects reduced-motion settings.

The former facing, pawn, budget and victory labs have been unregistered/retired. References above describe the previous baseline; consult `docs/MECHANICS_LABS.md` for the current temporary workflow. Verify through unit tests and visual browser checks for the destination markers, faction-specific CSV presets and preserved normal saves.

## Survival objective and visible HUD (2026-11-11)

The fourth campaign level has an intentionally smaller player deployment budget (20 points against 30 enemy). It no longer adds the free protected king; any active player unit surviving eight completed enemy turns (or enemy skips) earns victory. Losing the regular king does not end the encounter. A fixed localized countdown is displayed during combat and restored from saved sessions. Old survival saves drop the obsolete mission king automatically. See `docs/BALANCE.md`.

## AI profiles from CSV (2026-11-11)

The five runtime tactical profiles `balanced`, `defensive`, `interceptor`, `hunter`, `aggressive` live in `balance/ai-profiles.csv`. Each campaign level selects its behavior via `balance/levels.csv` column `ai_profile`. The level still overrides search depth, randomness, delay and (for survival) aggression. Profile fields weight material, mobility, objectives, chase pressure, capture threats, king safety, survival eliminations and willingness to sacrifice. The shared minimax, legal moves and terminal goals remain unchanged. CSV parser validates references, duplicates and numeric ranges.

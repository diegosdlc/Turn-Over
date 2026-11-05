# Factions, starting bands and piece identity

This document defines the faction/band/facing contract for **Turn Over**.

## Playable factions

| Internal id | Display name | Special piece |
| --- | --- | --- |
| `green` | Verde | Alfil (`bishop`) |
| `red` | Roja | Torre (`rook`) |
| `yellow` | Amarilla | Caballo (`knight`) |

Faction definitions live in `src/content/factions.js`. `PLAYER_FACTION_IDS` is the allowlist used by new-game and session validation.

## Starting-band contract

A new starting band contains exactly four pieces:

1. Rey (`king`)
2. Reina (`queen`)
3. Peón (`pawn`)
4. The selected faction's special piece

`createInitialBand()` in `src/content/bands.js` is the authoritative factory. It combines the shared piece catalogue with faction, team, initial positions and explicit facing.

Generated units carry a stable id, controlling `team`, origin `faction`, `facing`, `pieceType`, movement/evolution profile and current evolution stage.

## Team, faction and facing are independent

- `team` — who currently controls the piece;
- `faction` — origin/art family;
- `facing` — board-relative orientation (`north` / `south`).

A recruited enemy piece may become player-controlled while keeping its origin faction artwork. Facing can change independently from either team or faction.

`GameState.setFacing()` assigns an explicit orientation and `GameState.turnAround()` swaps north/south. Movement does not automatically rotate pieces.

The tutorial starts player pieces facing north and enemy pieces facing south.

## Piece artwork

Optional artwork belongs to origin faction and can vary by piece type and facing:

```js
pieceAssets: {
  king: {
    north: './assets/pieces/green/king-north.webp',
    south: './assets/pieces/green/king-south.webp'
  }
}
```

`AssetRegistry.pieceAsset()` resolves `faction -> pieceType -> facing` and keeps compatibility with the older single-string artwork shape. Production factions currently fall back to CSS chess-token graphics when final bitmap art is not configured.

When both sides are green, player green uses the light fallback palette and AI green uses the dark fallback palette.

## Movement and AI

Movement remains independent from faction and facing unless a specific mechanic explicitly reads those properties. Human interaction and AI consume the same legal-action generator.

Current base movement profiles include king, queen, diagonal bishop, knight, orthogonal rook and team-relative pawn movement/capture. Turn Over does not automatically inherit check, checkmate, castling, promotion or the pawn's initial two-square move from standard chess.

## Evolution

Each catalogue piece declares an evolution profile. Evolution stage is unit state and persists with the carried campaign roster.

- A base pawn can evolve immediately at the opposite edge.
- Between levels, only pieces that participated in and survived a victorious encounter are eligible for survival-based evolution.
- Pieces kept in deployment reserve carry forward at their existing stage.
- New recruits join without evolving.
- Rey/Reina between-level evolution requires both members to participate and survive.

See `docs/EVOLUTION.md`.

## Deployment budget and reserve

Budgeted deployment chooses the active encounter lineup from the complete carried player roster.

- Every roster piece begins the deployment in reserve.
- Placing it on the board marks it as participating and spends its base/evolved point cost.
- Removing it returns the piece to reserve and refunds the cost.
- Reserve pieces stay in the campaign roster but are inactive for movement, AI and victory detection in that encounter.
- An evolved reserve piece keeps its evolved stage but consumes no points until selected for a future encounter.

Point costs and per-level limits live in `balance/pieces.csv` and `balance/levels.csv`; see `docs/DEPLOYMENT.md` for the full interaction contract.

## Campaign transition

After a player victory:

1. participating survivors are collected;
2. reserve pieces are collected separately;
3. losses are removed;
4. eligible participating survivors evolve;
5. reserve pieces carry forward unchanged;
6. surviving enemy prisoners recruited by the player join without evolving;
7. the complete result becomes `ProgressionStore.playerBand` for the next deployment.

This preserves ownership of reserve pieces without granting evolution for skipped encounters.

## Session persistence

In-progress session schema is version `6`. A saved session contains:

- level id;
- selected player faction;
- serialized units, including coordinates, facing, evolution state and `inReserve`;
- active turn;
- finished state;
- lifecycle phase (`deployment` / `play`);
- per-team evolution-use state.

`GameSessionStore` validates the faction before exposing **Continuar partida**. Older incompatible session schemas are ignored. Campaign progression is separate, so the carried roster persists independently from an invalidated in-progress encounter snapshot.

## Relevant files

- `src/content/factions.js`
- `src/content/bands.js`
- `src/content/balance.js`
- `src/content/levels/tutorial-01.js`
- `src/core/GameState.js`
- `src/core/campaign.js`
- `src/core/evolution.js`
- `src/systems/AssetRegistry.js`
- `src/systems/GameSessionStore.js`
- `balance/pieces.csv` and `balance/levels.csv`
- `docs/DEPLOYMENT.md`
- `docs/EVOLUTION.md`

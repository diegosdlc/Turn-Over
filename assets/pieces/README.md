# Piece assets

The **green** faction uses turquoise-glass sprites selected by piece type and explicit facing. This selection is independent of whether the unit belongs to the player or the enemy.

| In-game piece | North (rear view) | South (front view) | Original source images |
| --- | --- | --- | --- |
| Pawn | `green/pawn-north.webp` | `green/pawn-south.webp` | Existing pawn assets |
| King (Archimago) | `green/king-north.svg` | `green/king-south.svg` | `9699.png` / `9698.png` |
| Queen (Archimaga) | `green/queen-north.svg` | `green/queen-south.svg` | `9701.png` / `9700.png` |
| Bishop (Monje) | `green/bishop-north.svg` | `green/bishop-south.svg` | `9702.png` / `9703.png` |

The six new sprites have transparent backgrounds and are downscaled to 768×768. Each self-contained SVG stores optimized WebP artwork as an embedded data image, so it works as a standalone browser image without additional requests or runtime canvas processing. Four original PNGs had an opaque black background; the packaged sprites have that background removed.

On both the game board and roster cards, south-facing king and queen sprites are displayed with a horizontal flip. North-facing sprites and bishop artwork remain unchanged.

The paths are registered in `src/content/factions.js` under `green.pieceAssets`. `AssetRegistry.pieceAsset()` handles the direction lookup and retains the CSS chess-token fallback for other factions and unillustrated pieces.

Future faction-specific artwork can live in directories like `assets/pieces/red/rook.webp` or `assets/pieces/yellow/knight.webp`. Prefer transparent WebP/PNG when adding new files.

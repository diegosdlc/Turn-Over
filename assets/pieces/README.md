# Piece assets

The green faction pawn now has facing-specific translucent turquoise glass sprites:\n\n- `assets/pieces/green/pawn-north.webp` — three-quarter rear view (north).\n- `assets/pieces/green/pawn-south.webp` — three-quarter front view (south).\n\nBoth are 96×96 transparent WebP assets, optimized for the current small board tokens. Other pieces still use the CSS chess-token fallback.

If a future level needs faction-specific artwork, store it in subfolders, for example:

- `assets/pieces/green/bishop.webp`
- `assets/pieces/red/rook.webp`
- `assets/pieces/yellow/knight.webp`

Then register each file in `src/content/factions.js` under the faction's `pieceAssets` map.

Transparent WebP or PNG works best. The renderer falls back to the current chess glyph automatically when no artwork is registered or an image fails to load.

# Piece assets

The green faction pawn uses facing-specific turquoise glass sprites:

- `assets/pieces/green/pawn-north.webp` — rear three-quarter view for north.
- `assets/pieces/green/pawn-south.webp` — front three-quarter view for south.

Both are transparent WebP assets for the tabletop board and deployment roster. Remaining production pieces keep their CSS chess-token fallback.

If a future level needs faction-specific artwork, store it in subfolders, for example:

- `assets/pieces/green/bishop.webp`
- `assets/pieces/red/rook.webp`
- `assets/pieces/yellow/knight.webp`

Then register each file in `src/content/factions.js` under the faction's `pieceAssets` map.

Transparent WebP or PNG works best. The renderer falls back to the current chess glyph automatically when no artwork is registered or an image fails to load.

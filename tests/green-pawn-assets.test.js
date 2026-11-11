import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { FACTIONS } from '../src/content/factions.js';
import { AssetRegistry } from '../src/systems/AssetRegistry.js';

const assets = new AssetRegistry(FACTIONS);
const greenSprites = {
  pawn: { north: 'pawn-north.webp', south: 'pawn-south.webp' },
  king: { north: 'king-north.svg', south: 'king-south.svg' },
  queen: { north: 'queen-north.svg', south: 'queen-south.svg' },
  bishop: { north: 'bishop-north.svg', south: 'bishop-south.svg' }
};
const sourceFiles = {
  king: { north: '9699.png', south: '9698.png' },
  queen: { north: '9701.png', south: '9700.png' },
  bishop: { north: '9702.png', south: '9703.png' }
};

test('all green sprites use facing-specific artwork independently of controlling team', () => {
  for (const [pieceType, facings] of Object.entries(greenSprites)) {
    for (const [facing, filename] of Object.entries(facings)) {
      for (const team of ['player', 'enemy']) {
        assert.equal(
          assets.pieceAsset({ faction: 'green', team, pieceType, facing }),
          './assets/pieces/green/' + filename,
          pieceType + ' facing ' + facing + ' as ' + team
        );
      }
    }
  }
});

test('new green sprites are self-contained transparent image assets with source orientation documented', () => {
  for (const [pieceType, facings] of Object.entries(sourceFiles)) {
    for (const [facing, source] of Object.entries(facings)) {
      const filename = greenSprites[pieceType][facing];
      const svg = readFileSync(new URL('../assets/pieces/green/' + filename, import.meta.url), 'utf8');
      assert.ok(svg.includes('Source: ' + source), filename + ' source mapping');
      const match = svg.match(/href="data:image\/webp;base64,([A-Za-z0-9+/=]+)"/);
      assert.ok(match, filename + ' must contain an embedded WebP');
      const bytes = Buffer.from(match[1], 'base64');
      assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
      assert.ok(bytes.length > 1000);
    }
  }
});

test('other factions and unillustrated green piece types retain their fallback', () => {
  for (const faction of ['red', 'yellow']) {
    for (const pieceType of ['pawn', 'king', 'queen', 'bishop']) {
      assert.equal(assets.pieceAsset({ faction, pieceType, facing: 'north' }), null);
    }
  }
  for (const pieceType of ['rook', 'knight']) {
    assert.equal(assets.pieceAsset({ faction: 'green', pieceType, facing: 'north' }), null);
  }
});

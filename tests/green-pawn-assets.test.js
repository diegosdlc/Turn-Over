import test from 'node:test';
import assert from 'node:assert/strict';

import { FACTIONS } from '../src/content/factions.js';
import { AssetRegistry } from '../src/systems/AssetRegistry.js';

test('green pawn uses the north-facing rear sprite independently of team', () => {
  const assets = new AssetRegistry(FACTIONS);
  for (const team of ['player', 'enemy']) {
    assert.equal(
      assets.pieceAsset({ faction: 'green', team, pieceType: 'pawn', facing: 'north' }),
      './assets/pieces/green/pawn-north.webp'
    );
  }
});

test('green pawn uses the south-facing front sprite', () => {
  const assets = new AssetRegistry(FACTIONS);
  assert.equal(
    assets.pieceAsset({ faction: 'green', team: 'enemy', pieceType: 'pawn', facing: 'south' }),
    './assets/pieces/green/pawn-south.webp'
  );
});

test('other factions and green piece types retain their fallback', () => {
  const assets = new AssetRegistry(FACTIONS);
  for (const faction of ['red', 'yellow']) {
    assert.equal(assets.pieceAsset({ faction, pieceType: 'pawn', facing: 'north' }), null);
  }
  assert.equal(assets.pieceAsset({ faction: 'green', pieceType: 'bishop', facing: 'north' }), null);
});

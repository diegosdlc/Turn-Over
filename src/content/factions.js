export const FACTIONS = Object.freeze({
  green: {
    id: 'green',
    name: 'Verde',
    specialPieceType: 'bishop',
    palettes: {
      player: {
        primary: '#9acb9e',
        secondary: '#4d8559',
        text: '#fffdf4'
      },
      enemy: {
        primary: '#55755d',
        secondary: '#203c2a',
        text: '#fffdf4'
      }
    },
    pieceAssets: {
      pawn: {
        north: './assets/pieces/green/pawn-north.webp',
        south: './assets/pieces/green/pawn-south.webp'
      },
      king: {
        north: './assets/pieces/green/king-north.svg',
        south: './assets/pieces/green/king-south.svg'
      },
      queen: {
        north: './assets/pieces/green/queen-north.svg',
        south: './assets/pieces/green/queen-south.svg'
      },
      bishop: {
        north: './assets/pieces/green/bishop-north.svg',
        south: './assets/pieces/green/bishop-south.svg'
      }
    }
  },
  red: {
    id: 'red',
    name: 'Roja',
    specialPieceType: 'rook',
    palette: {
      primary: '#d47268',
      secondary: '#792b2b',
      text: '#fffdf4'
    },
    pieceAssets: {}
  },
  yellow: {
    id: 'yellow',
    name: 'Amarilla',
    specialPieceType: 'knight',
    palette: {
      primary: '#e1bd50',
      secondary: '#87611b',
      text: '#fffdf4'
    },
    pieceAssets: {}
  }
});

export const PLAYER_FACTION_IDS = Object.freeze(['green', 'red', 'yellow']);

export function getFaction(factionId) {
  return FACTIONS[factionId] ?? null;
}

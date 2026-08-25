import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  NOTEBOOK_EDGE_OVERHANG,
  NOTEBOOK_HEIGHT,
  NOTEBOOK_WIDTH,
  calculateCompactLayout,
  shouldUseCompactLayout,
} from '../src/viewport-layout.js';

const viewports = [
  { width: 320, height: 568, bottomReserve: 0 },
  { width: 390, height: 844, bottomReserve: 0 },
  { width: 768, height: 1024, bottomReserve: 12 },
  { width: 844, height: 390, bottomReserve: 56 },
  { width: 1280, height: 800, bottomReserve: 56 },
];

test('compact notebook is always pinned beyond the lower-left viewport edges', () => {
  for (const viewport of viewports) {
    const layout = calculateCompactLayout(viewport);
    const notebookBottom = layout.notebookY + NOTEBOOK_HEIGHT * layout.notebookScale;

    assert.equal(layout.notebookX, -NOTEBOOK_EDGE_OVERHANG);
    assert.equal(notebookBottom, viewport.height + NOTEBOOK_EDGE_OVERHANG);
    assert.ok(layout.notebookScale > 0);
  }
});

test('landscape notebook never covers the board player edge', () => {
  for (const viewport of viewports.filter(({ width, height, bottomReserve }) => width >= height - bottomReserve)) {
    const layout = calculateCompactLayout(viewport);
    const notebookRight = layout.notebookX + NOTEBOOK_WIDTH * layout.notebookScale;
    const boardLeft = layout.boardX;
    const boardRight = boardLeft + BOARD_WIDTH * layout.boardScale;

    assert.equal(layout.landscape, true);
    assert.ok(boardLeft > notebookRight, JSON.stringify({ viewport, layout }));
    assert.ok(boardRight <= viewport.width);
  }
});

test('portrait board is centered in the space above the anchored notebook', () => {
  for (const viewport of viewports.filter(({ width, height, bottomReserve }) => width < height - bottomReserve)) {
    const layout = calculateCompactLayout(viewport);
    const notebookHeight = NOTEBOOK_HEIGHT * layout.notebookScale;
    const notebookTabsTop = layout.notebookY - notebookHeight * 0.18;
    const boardBottom = layout.boardY + BOARD_HEIGHT * layout.boardScale;
    assert.equal(layout.landscape, false);
    assert.ok(layout.boardY >= 4);
    assert.ok(boardBottom <= notebookTabsTop);
  }
});

test('touch tablets and compact browser windows use the same layout path', () => {
  assert.equal(shouldUseCompactLayout({ width: 1366, height: 1024, hasTouch: true }), true);
  assert.equal(shouldUseCompactLayout({ width: 390, height: 844, hasTouch: false }), true);
  assert.equal(shouldUseCompactLayout({ width: 1440, height: 900, hasTouch: false }), false);
});

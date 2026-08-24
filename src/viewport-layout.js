export const BOARD_WIDTH = 1180;
export const BOARD_HEIGHT = BOARD_WIDTH * 580 / 940;
export const NOTEBOOK_WIDTH = 540;
export const NOTEBOOK_HEIGHT = NOTEBOOK_WIDTH * 676 / 883;
export const NOTEBOOK_EDGE_OVERHANG = 12;

export function shouldUseCompactLayout({ width, height, hasTouch }) {
  const shortestSide = Math.min(width, height);
  const longestSide = Math.max(width, height);

  return shortestSide <= 1200 && (hasTouch || longestSide <= 1280);
}

export function calculateCompactLayout({ width, height, bottomReserve = 0 }) {
  const safeHeight = Math.max(280, height - bottomReserve);
  const landscape = width >= safeHeight;

  const notebookScale = landscape
    ? Math.min(
      width * 0.34 / NOTEBOOK_WIDTH,
      safeHeight * 0.78 / NOTEBOOK_HEIGHT,
    )
    : Math.min(
      width * 1.06 / NOTEBOOK_WIDTH,
      safeHeight * 0.46 / NOTEBOOK_HEIGHT,
    );

  const notebookHeight = NOTEBOOK_HEIGHT * notebookScale;
  const notebookX = -NOTEBOOK_EDGE_OVERHANG;
  const notebookY = safeHeight - notebookHeight + NOTEBOOK_EDGE_OVERHANG;

  let boardScale;
  let boardX;
  let boardY;

  if (landscape) {
    boardScale = Math.min(
      width * 0.76 / BOARD_WIDTH,
      safeHeight * 0.94 / BOARD_HEIGHT,
    );

    const boardWidth = BOARD_WIDTH * boardScale;
    const boardHeight = BOARD_HEIGHT * boardScale;
    boardX = width - boardWidth - 4;
    boardY = Math.max(4, (safeHeight - boardHeight) / 2);
  } else {
    const notebookTabsTop = notebookY - notebookHeight * 0.18;
    const availableAboveNotebook = Math.max(120, notebookTabsTop - 12);
    boardScale = Math.min(
      width * 1.25 / BOARD_WIDTH,
      availableAboveNotebook * 0.96 / BOARD_HEIGHT,
    );

    const boardWidth = BOARD_WIDTH * boardScale;
    const boardHeight = BOARD_HEIGHT * boardScale;
    boardX = (width - boardWidth) / 2;
    boardY = Math.max(4, (notebookTabsTop - boardHeight) / 2);
  }

  return {
    safeHeight,
    landscape,
    boardScale,
    boardX,
    boardY,
    notebookScale,
    notebookX,
    notebookY,
  };
}

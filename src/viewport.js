const root = document.documentElement;
const ua = navigator.userAgent;
const isAndroid = /Android/i.test(ua);
const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const hasTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;

const BOARD_WIDTH = 1180;
const BOARD_HEIGHT = BOARD_WIDTH * 580 / 940;
const NOTEBOOK_WIDTH = 540;
const NOTEBOOK_HEIGHT = NOTEBOOK_WIDTH * 676 / 883;

let frame = 0;

function px(name, value) {
  root.style.setProperty(name, `${Math.round(value * 100) / 100}px`);
}

function number(name, value) {
  root.style.setProperty(name, String(Math.round(value * 10000) / 10000));
}

function applyVisualViewport() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    const viewport = window.visualViewport;
    const width = Math.min(
      viewport?.width ?? Number.POSITIVE_INFINITY,
      window.innerWidth || Number.POSITIVE_INFINITY,
      document.documentElement.clientWidth || Number.POSITIVE_INFINITY,
    );
    const height = Math.min(
      viewport?.height ?? Number.POSITIVE_INFINITY,
      window.innerHeight || Number.POSITIVE_INFINITY,
      document.documentElement.clientHeight || Number.POSITIVE_INFINITY,
    );

    const bottomReserve = isAndroid ? 56 : isIOS ? 12 : 0;
    const safeHeight = Math.max(280, height - bottomReserve);
    const touchLayout = hasTouch && Math.min(width, height) <= 1200;
    const landscape = width >= safeHeight;

    root.classList.toggle('touch-ui', touchLayout);
    root.classList.toggle('touch-landscape', touchLayout && landscape);
    root.classList.toggle('touch-portrait', touchLayout && !landscape);

    px('--app-vw', width);
    px('--app-vh', height);
    px('--app-safe-h', safeHeight);
    px('--app-bottom-reserve', bottomReserve);

    if (!touchLayout) return;

    let boardScale;
    let notebookScale;
    let boardX;
    let boardY;
    let notebookX;
    let notebookY;

    if (landscape) {
      boardScale = Math.min(
        width * 0.76 / BOARD_WIDTH,
        safeHeight * 0.94 / BOARD_HEIGHT,
      );
      notebookScale = Math.min(
        width * 0.34 / NOTEBOOK_WIDTH,
        safeHeight * 0.74 / NOTEBOOK_HEIGHT,
      );

      const boardW = BOARD_WIDTH * boardScale;
      const boardH = BOARD_HEIGHT * boardScale;
      const notebookH = NOTEBOOK_HEIGHT * notebookScale;

      boardX = width - boardW - 4;
      boardY = Math.max(4, (safeHeight - boardH) * 0.42);
      notebookX = -NOTEBOOK_WIDTH * notebookScale * 0.025;
      notebookY = safeHeight - notebookH + 6;
    } else {
      boardScale = Math.min(
        width * 1.25 / BOARD_WIDTH,
        safeHeight * 0.52 / BOARD_HEIGHT,
      );
      notebookScale = Math.min(
        width * 1.05 / NOTEBOOK_WIDTH,
        safeHeight * 0.48 / NOTEBOOK_HEIGHT,
      );

      const boardW = BOARD_WIDTH * boardScale;
      const boardH = BOARD_HEIGHT * boardScale;
      const notebookW = NOTEBOOK_WIDTH * notebookScale;
      const notebookH = NOTEBOOK_HEIGHT * notebookScale;

      boardX = (width - boardW) / 2;
      boardY = Math.max(4, safeHeight * 0.015);
      notebookX = (width - notebookW) / 2;

      const desiredBottomAlignedY = safeHeight - notebookH + 12;
      const boardBottom = boardY + boardH;
      const maxGapY = boardBottom + 72;
      notebookY = Math.min(desiredBottomAlignedY, maxGapY);
      notebookY = Math.max(boardBottom - 10, notebookY);
    }

    number('--touch-board-scale', boardScale);
    number('--touch-notebook-scale', notebookScale);
    px('--touch-board-x', boardX);
    px('--touch-board-y', boardY);
    px('--touch-notebook-x', notebookX);
    px('--touch-notebook-y', notebookY);
  });
}

applyVisualViewport();
window.addEventListener('resize', applyVisualViewport, { passive: true });
window.addEventListener('orientationchange', applyVisualViewport, { passive: true });
window.visualViewport?.addEventListener('resize', applyVisualViewport, { passive: true });
window.visualViewport?.addEventListener('scroll', applyVisualViewport, { passive: true });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) applyVisualViewport();
});

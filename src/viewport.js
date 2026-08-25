import {
  calculateCompactLayout,
  shouldUseCompactLayout,
} from './viewport-layout.js?v=20260825-landscape-1';

const root = document.documentElement;
const ua = navigator.userAgent;
const isAndroid = /Android/i.test(ua);
const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const hasTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;

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
    const viewportX = viewport?.offsetLeft ?? 0;
    const viewportY = viewport?.offsetTop ?? 0;
    const viewportRight = Math.max(0, (window.innerWidth || width) - viewportX - width);

    const bottomReserve = isAndroid ? 56 : isIOS ? 12 : 0;
    const layout = calculateCompactLayout({ width, height, bottomReserve });
    const touchLayout = shouldUseCompactLayout({
      width,
      height: layout.safeHeight,
      hasTouch,
    });

    root.classList.toggle('touch-ui', touchLayout);
    root.classList.toggle('touch-landscape', touchLayout && layout.landscape);
    root.classList.toggle('touch-portrait', touchLayout && !layout.landscape);

    px('--app-vw', width);
    px('--app-vh', height);
    px('--app-vv-x', viewportX);
    px('--app-vv-y', viewportY);
    px('--app-vv-right', viewportRight);
    px('--app-safe-h', layout.safeHeight);
    px('--app-bottom-reserve', bottomReserve);

    if (!touchLayout) return;

    number('--touch-board-scale', layout.boardScale);
    number('--touch-notebook-scale', layout.notebookScale);
    px('--touch-board-x', layout.boardX);
    px('--touch-board-y', layout.boardY);
    px('--touch-notebook-x', layout.notebookX);
    px('--touch-notebook-y', layout.notebookY);
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

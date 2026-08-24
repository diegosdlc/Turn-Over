const root = document.documentElement;
const isAndroid = /Android/i.test(navigator.userAgent);
let frame = 0;

function applyVisualViewport() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    const viewport = window.visualViewport;
    const width = viewport?.width ?? window.innerWidth;
    const height = viewport?.height ?? window.innerHeight;

    // Some Android tablet/browser combinations still let fixed content reach
    // underneath the system navigation bar even when visualViewport is used.
    // Keep a conservative touch-only reserve so interactive artwork never
    // depends on that ambiguous bottom strip being usable.
    const bottomReserve = isAndroid ? 44 : 0;
    const safeHeight = Math.max(0, height - bottomReserve);

    root.style.setProperty('--app-vw', `${width}px`);
    root.style.setProperty('--app-vh', `${height}px`);
    root.style.setProperty('--app-safe-h', `${safeHeight}px`);
    root.style.setProperty('--app-bottom-reserve', `${bottomReserve}px`);
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

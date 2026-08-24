const root = document.documentElement;
let frame = 0;

function applyVisualViewport() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    const viewport = window.visualViewport;
    const width = viewport?.width ?? window.innerWidth;
    const height = viewport?.height ?? window.innerHeight;

    root.style.setProperty('--app-vw', `${width}px`);
    root.style.setProperty('--app-vh', `${height}px`);
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

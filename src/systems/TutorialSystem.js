import { t } from '../i18n/index.js';

const overlapArea = (a, b) =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
  Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

/**
 * Place a readable, viewport-sized card next to the notebook/board rather than
 * inside the scaled board artwork. Prefer not to cover legal move targets.
 */
export function positionTutorialCard({ surface, kind, width, height, viewport, avoid = [] }) {
  const margin = 12;
  const gap = 14;
  const leftEdge = viewport.left + margin;
  const rightEdge = viewport.left + viewport.width - margin - width;
  const topEdge = viewport.top + margin;
  const bottomEdge = viewport.top + viewport.height - margin - height;
  const centerX = surface.left + (surface.width - width) / 2;
  const centerY = surface.top + (surface.height - height) / 2;
  const spots = kind === 'notebook' ? [
    [centerX, surface.top - height - gap],
    [surface.right + gap, centerY],
    [surface.left - width - gap, centerY],
    [surface.left + 10, surface.top + 10],
    [centerX, surface.bottom + gap],
    [surface.right - width - 10, surface.top + 10]
  ] : [
    [surface.right - width - 12, surface.bottom + gap],
    [surface.right - width - 12, surface.top - height - gap],
    [surface.right - width - 12, surface.top + 12],
    [surface.left + 12, surface.top + 12],
    [surface.right - width - 12, surface.bottom - height - 12],
    [surface.left + 12, surface.bottom - height - 12],
    [surface.right + gap, centerY],
    [surface.left - width - gap, centerY]
  ];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  let best = null;
  for (const [index, [rawX, rawY]] of spots.entries()) {
    const x = clamp(rawX, leftEdge, Math.max(leftEdge, rightEdge));
    const y = clamp(rawY, topEdge, Math.max(topEdge, bottomEdge));
    const box = { left: x, right: x + width, top: y, bottom: y + height };
    const overlapping = avoid.reduce((score, item) => score + overlapArea(box, item), 0);
    const clipped = Math.abs(x - rawX) + Math.abs(y - rawY);
    const score = index * 12 + clipped * 1.5 + overlapping / Math.max(1, width * height) * 1400;
    if (!best || score < best.score) best = { left: Math.round(x), top: Math.round(y), score };
  }
  return { left: best?.left ?? Math.round(leftEdge), top: best?.top ?? Math.round(topEdge) };
}

// Find a rectangular region of the visual viewport that cannot overlap the
// notebook (including its protruding tabs). On narrow screens the card can
// scroll within the available region instead of spilling across the notebook.
export function notebookFreeRegion(viewport, notebook) {
  const margin = 12;
  const gap = 16;
  const left = viewport.left + margin;
  const right = viewport.left + viewport.width - margin;
  const top = viewport.top + margin;
  const bottom = viewport.top + viewport.height - margin;
  const regions = [
    { left, top, right, bottom: Math.min(bottom, notebook.top - gap) },
    { left: Math.max(left, notebook.right + gap), top, right, bottom },
    { left, top: Math.max(top, notebook.bottom + gap), right, bottom },
    { left, top, right: Math.min(right, notebook.left - gap), bottom }
  ].map(region => ({
    ...region,
    width: Math.min(480, Math.floor(region.right - region.left)),
    height: Math.floor(region.bottom - region.top)
  })).filter(region => region.width > 0 && region.height > 0);
  const score = region => Math.min(region.height, 420) * region.width *
    (region.width >= 280 && region.height >= 120 ? 2 : 1);
  regions.sort((a, b) => score(b) - score(a));
  return regions[0] ?? null;
}

export class TutorialSystem {
  constructor({ storagePrefix }) {
    this.storagePrefix = storagePrefix;
    this.tutorial = null;
    this.levelId = null;
    this.index = 0;
    this.phase = 'play';
    this.activeTip = null;
    this.closedStep = null;
    this.seenTips = new Set();
    this.enabled = false;
    this.tooltip = null;
    this.lastLayout = null;
  }

  configure(levelId, tutorial, { forceEnabled = false, preferenceEnabled = true } = {}) {
    this.clearTooltip();
    this.levelId = levelId;
    this.tutorial = tutorial ?? null;
    this.index = 0;
    this.phase = 'play';
    this.activeTip = null;
    this.closedStep = null;
    this.seenTips.clear();
    const hasGuidance = Boolean(this.tutorial?.steps?.length || this.tutorial?.tips?.length);
    this.enabled = hasGuidance && (forceEnabled || (preferenceEnabled && this.tutorial.enabledByDefault && !this.isCompleted()));
  }

  setPhase(phase) {
    this.phase = phase;
    // A resumed session may already be in combat: skip unfinished setup steps.
    if (phase === 'play') {
      while (this.tutorial?.steps?.[this.index]?.phase === 'deployment') this.index += 1;
    }
  }

  currentStep() {
    if (!this.enabled) return null;
    if (this.activeTip) return this.activeTip;
    const step = this.tutorial?.steps?.[this.index] ?? null;
    // Missing phase means play, never both phases.
    return step && step !== this.closedStep && (step.phase ?? 'play') === this.phase ? step : null;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled && (this.tutorial?.steps?.length || this.tutorial?.tips?.length));
    if (!this.enabled) this.clearTooltip();
    else this.closedStep = null;
  }

  closeCurrent() {
    const step = this.currentStep();
    if (!step) return false;
    // Action-driven lessons stay hidden until the real action advances them.
    // Acknowledgement-only lessons and contextual tips count as read.
    if (this.activeTip || step.advanceOn === 'acknowledged') this.acknowledge();
    else this.closedStep = step;
    this.clearTooltip();
    return true;
  }

  notify(eventName) {
    if (!this.enabled) return false;
    if (!this.activeTip) {
      const tip = this.tutorial?.tips?.find(item =>
        item.trigger === eventName && (item.phase ?? 'play') === this.phase &&
        !this.seenTips.has(item.id)
      );
      if (tip) {
        this.activeTip = tip;
        return true;
      }
    }
    const step = this.tutorial?.steps?.[this.index];
    if (!step || (step.phase ?? 'play') !== this.phase ||
        (step.advanceOn !== eventName && !step.alsoAdvanceOn?.includes(eventName))) return false;
    this.index += 1;
    this.closedStep = null;
    if (this.index >= this.tutorial.steps.length && !this.tutorial?.tips?.length) this.complete();
    return true;
  }

  acknowledge() {
    if (!this.enabled) return false;
    if (this.activeTip) {
      this.seenTips.add(this.activeTip.id);
      this.activeTip = null;
      if (this.index >= (this.tutorial?.steps?.length ?? 0) &&
          this.seenTips.size >= (this.tutorial?.tips?.length ?? 0)) this.complete();
      return true;
    }
    return this.notify('acknowledged');
  }

  clearTooltip() {
    this.tooltip?.remove();
    this.tooltip = null;
    this.lastLayout = null;
  }

  reposition() {
    if (!this.tooltip || !this.lastLayout) return;
    const { board, anchorResolver, options, step } = this.lastLayout;
    const rect = anchorResolver(step.anchor);
    if (!rect) return;
    const kind = step.anchor?.type === 'notebook' ? 'notebook' : 'board';
    const tooltip = this.tooltip;
    // Measure actual rendered size; it is not scaled together with the artwork.
    const width = tooltip.offsetWidth;
    const height = tooltip.offsetHeight;
    const notebookRect = options.notebook?.getBoundingClientRect();
    const avoid = [...board.querySelectorAll(
      '.iso-cell.move-target, .iso-cell.capture-target, .iso-cell.rescue-target, .iso-cell.royal-swap-target, .iso-cell.deployment-target, .unit.selected, .encroachment-warning'
    )].map(item => item.getBoundingClientRect());
    if (kind === 'notebook') {
      avoid.push(board.getBoundingClientRect());
      const roster = document.querySelector('#deployment-pieces');
      if (roster) avoid.push(roster.getBoundingClientRect());
    } else if (notebookRect) {
      avoid.push(notebookRect);
    }
    const visual = window.visualViewport;
    const viewport = {
      left: visual?.offsetLeft ?? 0,
      top: visual?.offsetTop ?? 0,
      width: visual?.width ?? window.innerWidth,
      height: visual?.height ?? window.innerHeight
    };
    if (step.keepNotebookClear) {
      const notebook = notebookRect ?? rect;
      const tabs = options.notebook?.querySelector('.notebook-tabs')?.getBoundingClientRect();
      const protectedRect = tabs ? {
        left: Math.min(notebook.left, tabs.left),
        top: Math.min(notebook.top, tabs.top),
        right: Math.max(notebook.right, tabs.right),
        bottom: Math.max(notebook.bottom, tabs.bottom)
      } : notebook;
      const region = notebookFreeRegion(viewport, protectedRect);
      if (!region) {
        tooltip.style.visibility = 'hidden';
        return;
      }
      tooltip.style.boxSizing = 'border-box';
      tooltip.style.width = region.width + 'px';
      tooltip.style.maxHeight = Math.min(region.height, 420) + 'px';
      tooltip.style.pointerEvents = 'auto'; // Allow scrolling long text without touching the notebook.
      tooltip.style.left = Math.round(region.left + (region.right - region.left - region.width) / 2) + 'px';
      tooltip.style.top = Math.ceil(region.top) + 'px';
      tooltip.style.visibility = 'visible';
      return;
    }
    const surface = kind === 'notebook' && notebookRect ? notebookRect : rect;
    const pos = positionTutorialCard({ surface, kind, width, height, viewport, avoid });
    tooltip.style.left = pos.left + 'px';
    tooltip.style.top = pos.top + 'px';
    tooltip.style.visibility = 'visible';
  }

  render(board, anchorResolver, options = {}) {
    this.clearTooltip();
    const step = this.currentStep();
    if (!step || !anchorResolver(step.anchor)) return;
    const tooltip = document.createElement('aside');
    tooltip.className = 'tutorial-tooltip';
    tooltip.setAttribute('role', 'status');
    tooltip.style.visibility = 'hidden';

    const context = document.createElement('strong');
    context.className = 'tutorial-context';
    context.textContent = t(step.anchor?.type === 'notebook' ? 'ui.tutorial.notebook' : 'ui.tutorial.board');
    const content = document.createElement('p');
    content.textContent = step.textKey ? t(step.textKey) : step.text;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'tutorial-close';
    close.textContent = '×';
    close.setAttribute('aria-label', t('ui.tutorial.close'));
    close.addEventListener('click', event => {
      event.stopPropagation();
      this.closeCurrent();
    });
    tooltip.append(close, context, content);

    if (this.activeTip || step.advanceOn === 'acknowledged') {
      const gotIt = document.createElement('button');
      gotIt.type = 'button';
      gotIt.className = 'tutorial-continue';
      gotIt.textContent = t('ui.tutorial.got_it');
      gotIt.addEventListener('click', event => {
        event.stopPropagation();
        this.acknowledge();
        this.render(board, anchorResolver, options);
      });
      tooltip.append(gotIt);
    }
    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'tutorial-dismiss';
    dismiss.textContent = t('ui.tutorial.skip');
    dismiss.addEventListener('click', event => {
      event.stopPropagation();
      if (!window.confirm(t('ui.tutorial.skip_confirm'))) return;
      if (options.onSkipTutorials) options.onSkipTutorials();
      else this.setEnabled(false);
    });
    tooltip.append(dismiss);
    document.body.append(tooltip);
    this.tooltip = tooltip;
    this.lastLayout = { board, anchorResolver, options, step };
    this.reposition();
  }

  complete() {
    this.enabled = false;
    this.activeTip = null;
    this.clearTooltip();
    try {
      localStorage.setItem(`${this.storagePrefix}${this.levelId}`, '1');
    } catch {}
  }

  isCompleted() {
    if (!this.levelId) return false;
    try {
      return localStorage.getItem(`${this.storagePrefix}${this.levelId}`) === '1';
    } catch {
      return false;
    }
  }
}

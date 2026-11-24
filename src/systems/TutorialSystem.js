import { t } from '../i18n/index.js';

export class TutorialSystem {
  constructor({ storagePrefix }) {
    this.storagePrefix = storagePrefix;
    this.tutorial = null;
    this.levelId = null;
    this.index = 0;
    this.phase = 'play';
    this.activeTip = null;
    this.seenTips = new Set();
    this.enabled = false;
  }

  configure(levelId, tutorial, { forceEnabled = false } = {}) {
    this.levelId = levelId;
    this.tutorial = tutorial ?? null;
    this.index = 0;
    this.phase = 'play';
    this.activeTip = null;
    this.seenTips.clear();
    const hasGuidance = Boolean(this.tutorial?.steps?.length || this.tutorial?.tips?.length);
    this.enabled = hasGuidance && (forceEnabled || (this.tutorial.enabledByDefault && !this.isCompleted()));
  }

  setPhase(phase) {
    this.phase = phase;
    // Saved campaigns may resume directly in play. Do not strand the tutorial
    // behind deployment steps that can no longer be completed.
    if (phase === 'play') {
      while (this.tutorial?.steps?.[this.index]?.phase === 'deployment') this.index += 1;
    }
  }

  currentStep() {
    if (!this.enabled) return null;
    if (this.activeTip) return this.activeTip;
    const step = this.tutorial?.steps?.[this.index] ?? null;
    return step && (!step.phase || step.phase === this.phase) ? step : null;
  }

  notify(eventName) {
    if (!this.enabled) return false;
    // Contextual tips are independent of the linear lesson: the first warning
    // about a closing tile should never depend on completing a capture lesson.
    if (!this.activeTip) {
      const tip = this.tutorial?.tips?.find(item =>
        item.trigger === eventName && (!item.phase || item.phase === this.phase) &&
        !this.seenTips.has(item.id)
      );
      if (tip) {
        this.activeTip = tip;
        return true;
      }
    }
    const step = this.tutorial?.steps?.[this.index];
    if (!step || (step.phase && step.phase !== this.phase) || step.advanceOn !== eventName) return false;
    this.index += 1;
    // Keep listening for contextual tips even after the last scripted lesson.
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

  render(board, anchorResolver) {
    const step = this.currentStep();
    if (!step) return;
    const anchor = anchorResolver(step.anchor);
    if (!anchor) return;

    const tooltip = document.createElement('aside');
    tooltip.className = 'tutorial-tooltip';
    tooltip.setAttribute('role', 'status');

    const text = document.createElement('p');
    text.textContent = step.textKey ? t(step.textKey) : step.text;
    tooltip.append(text);

    if (this.activeTip || step.advanceOn === 'acknowledged') {
      const gotIt = document.createElement('button');
      gotIt.type = 'button';
      gotIt.className = 'tutorial-continue';
      gotIt.textContent = t('ui.tutorial.got_it');
      gotIt.addEventListener('click', event => {
        event.stopPropagation();
        this.acknowledge();
        tooltip.remove();
        this.render(board, anchorResolver);
      });
      tooltip.append(gotIt);
    }

    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'tutorial-dismiss';
    dismiss.textContent = t('ui.tutorial.skip');
    dismiss.addEventListener('click', event => {
      event.stopPropagation();
      this.complete();
      tooltip.remove();
    });

    tooltip.append(dismiss);
    tooltip.style.left = `${((anchor.left + anchor.width / 2) / anchor.projection.width) * 100}%`;
    tooltip.style.top = `${((anchor.top + anchor.height / 2) / anchor.projection.height) * 100}%`;
    board.append(tooltip);
  }

  complete() {
    this.enabled = false;
    this.activeTip = null;
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

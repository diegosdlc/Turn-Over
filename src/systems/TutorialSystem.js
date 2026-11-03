import { t } from '../i18n/index.js';
export class TutorialSystem {
  constructor({ storagePrefix }) {
    this.storagePrefix = storagePrefix;
    this.tutorial = null;
    this.levelId = null;
    this.index = 0;
    this.enabled = false;
  }

  configure(levelId, tutorial, { forceEnabled = false } = {}) {
    this.levelId = levelId;
    this.tutorial = tutorial ?? null;
    this.index = 0;
    const completed = this.isCompleted();
    this.enabled = Boolean(this.tutorial?.steps?.length && (forceEnabled || (this.tutorial.enabledByDefault && !completed)));
  }

  currentStep() {
    return this.enabled ? this.tutorial?.steps?.[this.index] ?? null : null;
  }

  notify(eventName) {
    const step = this.currentStep();
    if (!step || step.advanceOn !== eventName) return false;
    this.index += 1;
    if (this.index >= this.tutorial.steps.length) this.complete();
    return true;
  }

  render(board, anchorResolver) {
    if (!this.enabled) return;
    const step = this.currentStep();
    if (!step) return;

    const anchor = anchorResolver(step.anchor);
    if (!anchor) return;

    const tooltip = document.createElement('aside');
    tooltip.className = 'tutorial-tooltip';
    tooltip.setAttribute('role', 'status');

    const text = document.createElement('p');
    text.textContent = step.textKey ? t(step.textKey) : step.text;

    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'tutorial-dismiss';
    dismiss.textContent = t('ui.tutorial.skip');
    dismiss.addEventListener('click', event => {
      event.stopPropagation();
      this.complete();
      tooltip.remove();
    });

    tooltip.append(text, dismiss);
    tooltip.style.left = `${((anchor.left + anchor.width / 2) / anchor.projection.width) * 100}%`;
    tooltip.style.top = `${((anchor.top + anchor.height / 2) / anchor.projection.height) * 100}%`;
    board.append(tooltip);
  }

  complete() {
    this.enabled = false;
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

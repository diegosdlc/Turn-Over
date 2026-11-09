import { t, getLanguage, getGender, setLanguage, setGender, onLocaleChange, playerText, pieceName } from './i18n/index.js';
import { listMechanicLabs } from './content/levels/index.js?v=20260821-evolution-3';
import { missionTextFor } from './content/mission.js?v=20261109-mission-1';

function mechanicsLabOptions() {
  return listMechanicLabs()
    .map(lab => `<option value="${lab.id}" title="${lab.description}">${lab.name}</option>`)
    .join('');
}

function notebookSections() {
  const level = window.turnOverNotebookLevel;
  const missionBody = level
    ? '<p>' + missionTextFor(level, t) + '</p>'
    : t('notebook.mission.body');
  return {
    band: [
      { title: t('notebook.band.title'), html: '<div id="notebook-dynamic-rosters"></div>' },
      { title: t('notebook.factions.title'), html: t('notebook.factions.body') }
    ],
    mission: [
      { title: t('notebook.mission.title'), html: missionBody }
    ],
    rules: [
      { title: t('notebook.rules.title'), html: t('notebook.rules.body') },
      { title: t('notebook.turn.title'), html: t('notebook.turn.body') },
      { title: t('notebook.evolution.title'), html: t('notebook.evolution.body') }
    ],
    settings: [
      { title: t('notebook.settings.title'), html: `
        <div class="notebook-settings-row"><label for="notebook-volume">${t('ui.music')}</label><input id="notebook-volume" type="range" min="0" max="100" step="1" value="45" aria-label="${t('ui.music.volume')}"></div>
        <div class="notebook-settings-row"><label for="notebook-language">${t('ui.settings.language')}</label><select id="notebook-language"><option value="es">${t('ui.language.es')}</option><option value="en">${t('ui.language.en')}</option></select></div>
        <div class="notebook-settings-row"><label for="notebook-gender">${t('ui.settings.gender')}</label><select id="notebook-gender"><option value="masculine">${t('ui.gender.masculine')}</option><option value="feminine">${t('ui.gender.feminine')}</option><option value="neutral">${t('ui.gender.neutral')}</option></select></div>
        <p>${playerText('player.greeting')}</p><p>${t('notebook.settings.audio_help')}</p><h3>${t('notebook.settings.labs')}</h3>
        <div class="notebook-lab-list"><label class="notebook-lab-label" for="notebook-mechanics-lab">${t('notebook.settings.scenario')}</label>
        <select id="notebook-mechanics-lab" class="notebook-lab-select"><option value="">${t('notebook.settings.select_lab')}</option>${mechanicsLabOptions()}</select></div>` }
    ]
  };
}

class NotebookUI {
  constructor(root) {
    this.root = root;
    this.pageContent = root?.querySelector('#notebook-page-content');
    this.pageElement = root?.querySelector('.notebook-page');
    this.fixedActions = root?.querySelector('#notebook-fixed-actions');
    this.indicator = root?.querySelector('#notebook-page-indicator');
    this.previous = root?.querySelector('#notebook-page-prev');
    this.next = root?.querySelector('#notebook-page-next');
    this.tabs = [...(root?.querySelectorAll('.notebook-tab') ?? [])];
    this.section = 'band';
    this.page = 0;
  }

  start() {
    if (!this.root || !this.pageContent) return;
    this.tabs.forEach(tab => tab.addEventListener('click', () => this.open(tab.dataset.section)));
    this.previous?.addEventListener('click', () => this.turn(-1));
    this.next?.addEventListener('click', () => this.turn(1));
    onLocaleChange(() => this.render());
    this.render();
  }

  open(section) {
    if (!notebookSections()[section]) return;
    this.section = section;
    this.page = 0;
    this.render();
  }

  turn(offset) {
    const pages = notebookSections()[this.section] ?? [];
    const nextPage = this.page + offset;
    if (nextPage < 0 || nextPage >= pages.length) return;
    this.page = nextPage;
    this.render();
  }

  render() {
    const pages = notebookSections()[this.section] ?? [];
    const current = pages[this.page] ?? pages[0];
    if (!current) return;

    this.root.dataset.notebookSection = this.section;
    this.tabs.forEach(tab => tab.setAttribute('aria-selected', String(tab.dataset.section === this.section)));
    this.pageContent.innerHTML = `<h2>${current.title}</h2>${current.html}`;
    this.pageContent.scrollTop = 0;
    if (this.indicator) this.indicator.textContent = `${this.page + 1} / ${pages.length}`;
    if (this.previous) this.previous.disabled = this.page === 0;
    if (this.next) this.next.disabled = this.page >= pages.length - 1;
    this.renderFixedActions();
    this.bindSettingsControls();
    this.renderRosters();
  }

  renderRosters() {
    const destination = this.root.querySelector('#notebook-dynamic-rosters');
    if (!destination) return;
    destination.replaceChildren();
    const state = window.turnOverNotebookState;
    if (!state?.units) return;
    for (const [team, title] of [['player', 'ui.deployment.your_band'], ['enemy', 'ui.deployment.enemy_band']]) {
      const section = document.createElement('section');
      section.className = 'notebook-roster-section';
      const heading = document.createElement('h3');
      heading.textContent = t(title);
      section.append(heading);
      const units = state.units.filter(unit => unit.team === team);
      const grid = document.createElement('div');
      grid.className = 'notebook-roster-grid';
      const cols = Math.min(4, Math.max(1, units.length));
      const rows = Math.max(1, Math.ceil(units.length / cols));
      grid.style.setProperty('--roster-cols', String(cols));
      grid.style.setProperty('--roster-tile-width', `${Math.max(20, Math.min(48, Math.floor(60 / rows)))}px`);
      for (const unit of units) {
        const card = document.createElement('div');
        card.className = 'notebook-roster-card';
        const tile = document.createElement('div');
        tile.className = `deployment-piece readonly notebook-roster-piece ${unit.inReserve ? 'in-reserve' : 'in-lineup'}${unit.destroyed ? ' is-destroyed' : ''}${unit.missionKing ? ' mission-king' : ''}`;
        const palette = state.assets?.piecePalette(unit);
        if (palette) {
          tile.style.setProperty('--unit-primary', palette.primary);
          tile.style.setProperty('--unit-secondary', palette.secondary);
          tile.style.setProperty('--unit-text', palette.text);
        }
        const fallback = document.createElement('span');
        fallback.className = 'deployment-piece-fallback';
        fallback.textContent = unit.fallbackGlyph;
        tile.append(fallback);
        const asset = state.assets?.pieceAsset(unit);
        if (asset) {
          const image = document.createElement('img');
          image.className = 'deployment-piece-image';
          image.src = state.assets.resolve(asset);
          image.alt = '';
          image.draggable = false;
          image.addEventListener('error', () => {
            image.remove();
            tile.classList.remove('has-image');
          }, { once: true });
          tile.append(image);
          tile.classList.add('has-image');
        }
        if (unit.evolutionStage === 'evolved') {
          const badge = document.createElement('span');
          badge.className = 'deployment-piece-evolved';
          badge.textContent = '+';
          tile.append(badge);
        }
        const name = document.createElement('span');
        name.className = 'deployment-piece-name';
        name.textContent = unit.missionKing ? t('ui.mission.king_tag') : pieceName(unit);
        tile.append(name);
        const meta = document.createElement('small');
        meta.className = 'deployment-piece-meta';
        meta.textContent = unit.missionKing && !unit.destroyed && !unit.captured
          ? t('ui.mission.king_status')
          : t(unit.destroyed ? 'ui.roster.destroyed' : unit.captured ? 'ui.roster.captured' :
            unit.inReserve ? 'ui.roster.reserve' : 'ui.deployment.status_board');
        card.append(tile, meta);
        grid.append(card);
      }
      section.append(grid);
      destination.append(section);
    }
  }

  renderFixedActions() {
    if (!this.fixedActions) return;
    const showMainMenu = this.section === 'settings';
    this.fixedActions.hidden = !showMainMenu;
    this.fixedActions.innerHTML = showMainMenu
      ? `<button id="notebook-main-menu" class="notebook-menu-button" type="button">${t('ui.notebook.home')}</button>`
      : '';
    this.pageElement?.classList.toggle('has-fixed-actions', showMainMenu);
  }

  bindSettingsControls() {
    const language = this.root.querySelector('#notebook-language');
    const gender = this.root.querySelector('#notebook-gender');
    if (language) { language.value = getLanguage(); language.addEventListener('change', () => setLanguage(language.value)); }
    if (gender) { gender.value = getGender(); gender.addEventListener('change', () => setGender(gender.value)); }
    const mechanicsLab = this.root.querySelector('#notebook-mechanics-lab');
    mechanicsLab?.addEventListener('change', () => {
      if (mechanicsLab.value) {
        const url = new URL(window.location.href);
        url.searchParams.set('level', mechanicsLab.value);
        url.searchParams.delete('tutorial');
        window.location.href = url.href;
      }
    });

    const mainMenu = this.root.querySelector('#notebook-main-menu');
    mainMenu?.addEventListener('click', () => window.dispatchEvent(new Event('game:return-home')));

    const volume = this.root.querySelector('#notebook-volume');
    const legacy = document.querySelector('#music-volume');
    if (!volume || !legacy) return;
    volume.value = legacy.value;
    volume.addEventListener('input', () => {
      legacy.value = volume.value;
      legacy.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
}

class LevelControls {
  constructor() {
    this.shell = document.querySelector('#game-shell');
    this.mute = document.querySelector('#mute-toggle');
    this.pause = document.querySelector('#pause-toggle');
    this.pauseDialog = document.querySelector('#pause-dialog');
    this.resume = document.querySelector('#resume-game');
    this.legacyVolume = document.querySelector('#music-volume');
    this.previousVolume = Number(this.legacyVolume?.value ?? 45) || 45;
  }

  start() {
    this.mute?.addEventListener('click', () => this.toggleMute());
    this.pause?.addEventListener('click', () => this.openPause());
    this.resume?.addEventListener('click', () => this.closePause());
    this.pauseDialog?.addEventListener('cancel', event => {
      event.preventDefault();
      this.closePause();
    });
    this.legacyVolume?.addEventListener('input', () => this.syncMute());
    onLocaleChange(() => this.syncMute());
    this.syncMute();
  }

  toggleMute() {
    if (!this.legacyVolume) return;
    const current = Number(this.legacyVolume.value);
    if (current > 0) {
      this.previousVolume = current;
      this.legacyVolume.value = '0';
    } else {
      this.legacyVolume.value = String(this.previousVolume || 45);
    }
    this.legacyVolume.dispatchEvent(new Event('input', { bubbles: true }));
    this.syncMute();
  }

  syncMute() {
    if (!this.mute || !this.legacyVolume) return;
    const muted = Number(this.legacyVolume.value) === 0;
    this.mute.textContent = muted ? '🔇' : '🔊';
    this.mute.setAttribute('aria-label', t(muted ? 'ui.sound.unmute' : 'ui.sound.mute'));
    this.mute.setAttribute('aria-pressed', String(muted));
    const notebookVolume = document.querySelector('#notebook-volume');
    if (notebookVolume) notebookVolume.value = this.legacyVolume.value;
  }

  openPause() {
    if (!this.pauseDialog || this.pauseDialog.open) return;
    this.shell?.classList.add('is-ui-paused');
    this.pauseDialog.showModal();
  }

  closePause() {
    this.shell?.classList.remove('is-ui-paused');
    if (this.pauseDialog?.open) this.pauseDialog.close();
  }
}

const notebook = new NotebookUI(document.querySelector('#notebook-ui'));
notebook.start();
window.addEventListener('game:rosters-updated', () => notebook.renderRosters());
new LevelControls().start();

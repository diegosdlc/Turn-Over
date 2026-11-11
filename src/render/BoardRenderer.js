import { t, pieceName } from '../i18n/index.js';
import { cellBox, insetBox, place } from '../core/geometry.js';
import { movementVector, VISUAL_DURATION_MS } from './animationGeometry.js';
import { escortGoalCells } from './escortGoals.js';
import { optionsFor } from '../core/rules.js?v=20260821-evolution-3';
import { evolutionCapabilitiesFor, isEvolved } from '../core/evolution.js?v=20260821-evolution-3';

const CHAINS_SVG = `<svg viewBox="0 0 100 70" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="13" y="19" width="49" height="32" rx="16" transform="rotate(-28 37 35)" stroke="currentColor" stroke-width="9"/>
  <rect x="40" y="19" width="49" height="32" rx="16" transform="rotate(28 64 35)" stroke="currentColor" stroke-width="9"/>
  <path d="M42 31l16 8" stroke="#fff6d9" stroke-width="3" stroke-linecap="round"/>
</svg>`;
const SWORDS_SVG = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <g transform="rotate(-43 50 50)">
    <path d="M50 8 58 23 55 65 45 65 42 23Z" fill="#f9efd4" stroke="#534638" stroke-width="3"/>
    <path d="M50 12V62" stroke="#ac9c7d" stroke-width="2"/>
    <path d="M32 66H68" stroke="#6b332d" stroke-width="8" stroke-linecap="round"/>
    <path d="M50 68V89" stroke="#534638" stroke-width="8" stroke-linecap="round"/>
  </g>
  <g transform="rotate(43 50 50)">
    <path d="M50 8 58 23 55 65 45 65 42 23Z" fill="#f9efd4" stroke="#534638" stroke-width="3"/>
    <path d="M50 12V62" stroke="#ac9c7d" stroke-width="2"/>
    <path d="M32 66H68" stroke="#6b332d" stroke-width="8" stroke-linecap="round"/>
    <path d="M50 68V89" stroke="#534638" stroke-width="8" stroke-linecap="round"/>
  </g>
</svg>`;

export class BoardRenderer {
  constructor({ board, level, state, assets, onCellClick, onCaptureAction }) {
    this.board = board;
    this.level = level;
    this.state = state;
    this.assets = assets;
    this.onCellClick = onCellClick;
    this.onCaptureAction = onCaptureAction;
    this.projection = level.board.projection;
    this.visualQueue = [];
    this.frameVisuals = [];
    this.animationUntil = 0;
    // Existing walls must not replay their arrival animations on load.
    this.seenWallIds = new Set((state.boardElements ?? []).filter(item =>
      item.type === 'encroachment').map(item => item.id));
    this.seenWarningKey = state.pendingClosure
      ? state.pendingClosure.x + ',' + state.pendingClosure.y + ':' + state.pendingClosure.forAction
      : null;
    this.configureBoardArtwork();
  }

  configureBoardArtwork() {
    const frame = this.level.board.artworkFrame ?? {};
    this.board.style.setProperty('--board-image', `url("${this.assets.resolve(this.level.board.artwork)}")`);
    this.board.style.setProperty('--board-bg-width', frame.width ?? '100%');
    this.board.style.setProperty('--board-bg-height', frame.height ?? '100%');
    this.board.style.setProperty('--board-bg-left', frame.left ?? '0%');
    this.board.style.setProperty('--board-bg-top', frame.top ?? '0%');
  }

  reducedMotion() {
    return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  }

  queueDeployment(unit) {
    if (!this.reducedMotion() && unit) this.visualQueue.push({ type: 'deployment', unitId: unit.id });
  }

  queueMovement(unit, from) {
    if (this.reducedMotion() || !unit || !from || unit.x == null || unit.y == null ||
        from.x == null || from.y == null || (unit.x === from.x && unit.y === from.y)) return;
    this.visualQueue.push({ type: 'movement', unitId: unit.id, from: { x: from.x, y: from.y } });
  }

  queueImpact(kind, x, y) {
    if (!this.reducedMotion() && (kind === 'capture' || kind === 'destroy')) {
      this.visualQueue.push({ type: 'impact', kind, x, y });
    }
  }

  remainingAnimationMs() {
    return this.reducedMotion() ? 0 : Math.max(0, this.animationUntil - Date.now());
  }

  clearVisualEffects() {
    this.visualQueue.length = 0;
    this.frameVisuals = [];
    this.animationUntil = 0;
  }

  render() {
    this.frameVisuals = this.visualQueue.splice(0);
    const durations = this.frameVisuals
      .filter(effect => effect.type !== 'impact')
      .map(effect => VISUAL_DURATION_MS[effect.type] ?? 0);
    if (durations.length) this.animationUntil = Date.now() + Math.max(...durations);
    this.board.innerHTML = '';
    const deploying = this.state.isDeploying?.() ?? false;
    const selectedOptions = deploying || this.state.pendingCapture ? [] : optionsFor(this.state, this.level, this.state.selected());
    const size = this.level.board.size ?? 8;

    this.renderSpecialTiles();
    this.renderEscortGoals();

    for (let diagonal = 0; diagonal <= (size - 1) * 2; diagonal += 1) {
      for (let y = 0; y < size; y += 1) {
        const x = diagonal - y;
        if (x < 0 || x >= size) continue;
        const unit = this.state.activeAt(x, y);
        const option = selectedOptions.find(item => item.x === x && item.y === y);
        this.renderCell(x, y, option, unit);
      }
    }

    this.renderBoardElements();
    this.renderClosureWarning();
    this.renderImpactEffects();
    this.frameVisuals = [];
    this.board.dataset.turn = this.state.currentTurn;
    this.board.dataset.phase = this.state.phase ?? 'play';
  }

  renderCell(x, y, option, unit) {
    const box = cellBox(this.projection, x, y);
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'iso-cell';
    cell.setAttribute('aria-label', t('ui.board.cell', { x: x + 1, y: y + 1 }));
    place(cell, box, this.projection);

    if (this.state.isDeploying?.()) {
      const selected = this.state.selected();
      if (this.state.isDeploymentCell(x, y, selected)) cell.classList.add('deployment-zone');
      if (selected && this.state.canDeployAt(selected, x, y)) cell.classList.add('deployment-target');
    }

    if (option) {
      cell.classList.add(option.kind === 'move-frozen' ? 'rescue-target' : `${option.kind}-target`);
    }
    if (this.state.pendingCapture?.x === x && this.state.pendingCapture?.y === y) {
      cell.classList.add('pending-capture-target');
    }

    cell.addEventListener('click', () => this.onCellClick(option, unit, x, y));
    this.board.append(cell);

    this.renderPrisoners(x, y, box);
    if (unit) this.renderUnit(unit, box, option, x, y);
  }

  renderPrisoners(x, y, box) {
    this.state.prisonersAt(x, y).forEach((piece, index) => {
      const prisoner = document.createElement('div');
      prisoner.className = 'prisoner';
      prisoner.textContent = piece.fallbackGlyph;
      const chains = document.createElement('span');
      chains.className = 'prisoner-chains';
      chains.setAttribute('aria-hidden', 'true');
      chains.innerHTML = CHAINS_SVG;
      prisoner.append(chains);
      this.applyFactionPalette(prisoner, piece);

      const prisonerBox = insetBox(box, 0.31, 0.25);
      prisonerBox.left += box.width * (0.18 + index * 0.05);
      prisonerBox.top += box.height * 0.28;
      prisonerBox.width *= 0.58;
      prisonerBox.height *= 0.72;
      place(prisoner, prisonerBox, this.projection);
      this.board.append(prisoner);
    });
  }

  renderUnit(unit, box, option, x, y) {
    const piece = document.createElement('button');
    piece.type = 'button';
    piece.className = `unit ${unit.id === this.state.selectedId ? 'selected' : ''} ${this.state.pendingCapture?.targetId === unit.id ? 'awaiting-capture' : ''}`;
    piece.classList.toggle('evolved', isEvolved(unit));
    piece.classList.toggle('mission-king', Boolean(unit.missionKing));
    const shieldReady = evolutionCapabilitiesFor(unit).rejectsFirstAttack && (unit.evolutionState?.shieldCharges ?? 0) > 0;
    piece.classList.toggle('shield-ready', shieldReady);
    piece.setAttribute('aria-label', `${pieceName(unit)}${unit.missionKing ? ' · ' + t('ui.mission.king_tag') : ''}${isEvolved(unit) ? t('ui.board.evolved') : ''}${shieldReady ? t('ui.board.shield') : ''}`);
    this.applyFactionPalette(piece, unit);

    const fallback = document.createElement('span');
    fallback.className = 'unit-fallback';
    fallback.textContent = unit.fallbackGlyph;
    piece.append(fallback);

    const asset = this.assets.pieceAsset(unit);
    if (asset) {
      const image = document.createElement('img');
      image.className = 'unit-image';
      image.src = this.assets.resolve(asset);
      image.alt = '';
      image.draggable = false;
      image.addEventListener('error', () => {
        image.remove();
        piece.classList.remove('has-image');
      }, { once: true });
      piece.append(image);
      piece.classList.add('has-image');
    }

    const pieceBox = this.unitBox(box);
    place(piece, pieceBox, this.projection);

    const deployment = this.frameVisuals.find(effect => effect.type === 'deployment' && effect.unitId === unit.id);
    const movement = this.frameVisuals.find(effect => effect.type === 'movement' && effect.unitId === unit.id);
    if (deployment) {
      piece.classList.add('unit-deploying');
      const spark = document.createElement('span');
      spark.className = 'unit-deployment-spark';
      spark.setAttribute('aria-hidden', 'true');
      piece.append(spark);
    } else if (movement) {
      const vector = movementVector(this.projection, movement.from, { x, y }, this.board.clientWidth, this.board.clientHeight);
      if (vector) {
        piece.classList.add('unit-moving');
        piece.style.setProperty('--travel-x', vector.x + 'px');
        piece.style.setProperty('--travel-y', vector.y + 'px');
        piece.style.setProperty('--travel-mid-x', vector.x / 2 + 'px');
        piece.style.setProperty('--travel-mid-y', vector.y / 2 + 'px');
      }
    }

    piece.addEventListener('click', event => {
      event.stopPropagation();
      this.onCellClick(option, unit, x, y);
    });
    this.board.append(piece);
    this.renderCaptureChoice(unit, pieceBox);
  }

  renderCaptureChoice(unit, pieceBox) {
    if (!this.state.pendingCapture || this.state.pendingCapture.targetId !== unit.id) return;

    const actions = document.createElement('div');
    actions.className = 'piece-capture-actions';
    actions.setAttribute('role', 'group');
    actions.setAttribute('aria-label', t('ui.board.action_on', { name: pieceName(unit) }));
    place(actions, pieceBox, this.projection);

    const captureButton = this.captureButton(t('ui.board.capture'), 'capture-piece-action', 'capture');
    const destroyButton = this.captureButton(t('ui.board.destroy'), 'destroy-piece-action', 'destroy');
    actions.append(captureButton, destroyButton);
    this.board.append(actions);
  }

  captureButton(label, className, action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `piece-action ${className}`;
    button.textContent = label;
    button.addEventListener('click', event => {
      event.stopPropagation();
      this.onCaptureAction(action);
    });
    return button;
  }

  renderEscortGoals() {
    for (const cell of escortGoalCells(this.level, this.state.boardElements)) {
      const marker = document.createElement('div');
      marker.className = 'escort-goal-tile';
      marker.setAttribute('role', 'img');
      marker.setAttribute('aria-label', t('ui.escort.goal'));
      marker.textContent = '⚑';
      place(marker, cellBox(this.projection, cell.x, cell.y), this.projection);
      this.board.append(marker);
    }
  }

  renderSpecialTiles() {
    for (const tile of this.level.specialTiles ?? []) {
      const box = cellBox(this.projection, tile.x, tile.y);
      const marker = document.createElement('div');
      marker.className = `special-tile ${tile.className ?? ''}`;
      marker.setAttribute('aria-label', tile.i18nNameKey ? t(tile.i18nNameKey) : (tile.name ?? t('ui.board.special')));
      place(marker, box, this.projection);

      if (tile.asset) {
        marker.style.backgroundImage = `url("${this.assets.resolve(tile.asset)}")`;
        marker.classList.add('has-asset');
      }
      this.board.append(marker);
    }
  }

  renderBoardElements() {
    for (const element of this.state.boardElements ?? this.level.boardElements ?? []) {
      const base = cellBox(this.projection, element.x, element.y);
      const box = insetBox(base, element.insetX ?? 0.16, element.insetY ?? 0.02);
      const scale = element.scale ?? 1;
      box.left += base.width * (element.xOffset ?? 0);
      box.top += base.height * (element.yOffset ?? -0.2);
      box.width *= scale;
      box.height *= scale;

      const node = document.createElement('div');
      node.className = `board-element ${element.blocking ? 'blocking' : ''} ${element.className ?? ''}`;
      if (element.type === 'encroachment') {
        if (!this.seenWallIds.has(element.id)) node.classList.add('encroachment-entering');
        this.seenWallIds.add(element.id);
      }
      node.setAttribute('aria-label', element.i18nNameKey ? t(element.i18nNameKey) : (element.name ?? t('ui.board.element')));
      place(node, box, this.projection);

      if (element.asset) {
        const image = document.createElement('img');
        image.src = this.assets.resolve(element.asset);
        image.alt = '';
        image.draggable = false;
        node.append(image);
      } else if (element.fallbackGlyph) {
        node.textContent = element.fallbackGlyph;
      }
      this.board.append(node);
    }
  }

  renderClosureWarning() {
    const warning = this.state.pendingClosure;
    if (!warning || this.state.finished || this.state.isDeploying()) {
      this.seenWarningKey = null;
      return;
    }
    const size = this.level.board.size ?? 8;
    if (warning.x < 0 || warning.y < 0 || warning.x >= size || warning.y >= size) return;
    const box = insetBox(cellBox(this.projection, warning.x, warning.y), 0.22, 0.19);
    const marker = document.createElement('div');
    marker.className = 'encroachment-warning';
    const markerKey = warning.x + ',' + warning.y + ':' + warning.forAction;
    if (markerKey !== this.seenWarningKey) marker.classList.add('encroachment-warning-entering');
    this.seenWarningKey = markerKey;
    marker.setAttribute('role', 'img');
    marker.setAttribute('aria-label', t('ui.encroachment.warning'));
    place(marker, box, this.projection);
    const pulse = document.createElement('span');
    pulse.className = 'encroachment-warning-pulse';
    pulse.textContent = '!';
    marker.append(pulse);
    this.board.append(marker);
  }

  renderImpactEffects() {
    for (const effect of this.frameVisuals) {
      if (effect.type !== 'impact') continue;
      const marker = document.createElement('div');
      marker.className = 'board-impact board-impact-' + effect.kind;
      marker.setAttribute('aria-hidden', 'true');
      marker.innerHTML = effect.kind === 'capture' ? CHAINS_SVG : SWORDS_SVG;
      place(marker, insetBox(cellBox(this.projection, effect.x, effect.y), 0.08, 0.03), this.projection);
      this.board.append(marker);
    }
  }

  applyFactionPalette(element, unit) {
    const palette = this.assets.piecePalette(unit);
    if (!palette) return;
    element.style.setProperty('--unit-primary', palette.primary);
    element.style.setProperty('--unit-secondary', palette.secondary);
    element.style.setProperty('--unit-text', palette.text);
  }

  unitBox(box) {
    const pieceBox = insetBox(box, 0.23, 0.03);
    pieceBox.top -= box.height * 0.23;
    pieceBox.height *= 1.18;
    return pieceBox;
  }

  resolveTutorialAnchor(anchor) {
    if (!anchor) return null;
    let box;

    if (anchor.type === 'cell') {
      box = cellBox(this.projection, anchor.x, anchor.y);
    } else if (anchor.type === 'unit') {
      const unit = this.state.units.find(item => item.id === anchor.id && this.state.active(item));
      if (!unit || unit.x == null || unit.y == null) return null;
      box = this.unitBox(cellBox(this.projection, unit.x, unit.y));
    } else if (anchor.type === 'board') {
      box = { left: this.projection.width * 0.4, top: this.projection.height * 0.35, width: this.projection.width * 0.2, height: this.projection.height * 0.2 };
    } else {
      return null;
    }

    return { ...box, projection: this.projection };
  }
}

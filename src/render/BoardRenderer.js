import { t, pieceName } from '../i18n/index.js';
import { cellBox, insetBox, place } from '../core/geometry.js';
import { optionsFor } from '../core/rules.js?v=20260821-evolution-3';
import { evolutionCapabilitiesFor, isEvolved } from '../core/evolution.js?v=20260821-evolution-3';

export class BoardRenderer {
  constructor({ board, level, state, assets, onCellClick, onCaptureAction }) {
    this.board = board;
    this.level = level;
    this.state = state;
    this.assets = assets;
    this.onCellClick = onCellClick;
    this.onCaptureAction = onCaptureAction;
    this.projection = level.board.projection;
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

  render() {
    this.board.innerHTML = '';
    const deploying = this.state.isDeploying?.() ?? false;
    const selectedOptions = deploying || this.state.pendingCapture ? [] : optionsFor(this.state, this.level, this.state.selected());
    const size = this.level.board.size ?? 8;

    this.renderSpecialTiles();

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
    const shieldReady = evolutionCapabilitiesFor(unit).rejectsFirstAttack && (unit.evolutionState?.shieldCharges ?? 0) > 0;
    piece.classList.toggle('shield-ready', shieldReady);
    piece.setAttribute('aria-label', `${pieceName(unit)}${isEvolved(unit) ? t('ui.board.evolved') : ''}${shieldReady ? t('ui.board.shield') : ''}`);
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
    for (const element of this.level.boardElements ?? []) {
      const base = cellBox(this.projection, element.x, element.y);
      const box = insetBox(base, element.insetX ?? 0.16, element.insetY ?? 0.02);
      const scale = element.scale ?? 1;
      box.left += base.width * (element.xOffset ?? 0);
      box.top += base.height * (element.yOffset ?? -0.2);
      box.width *= scale;
      box.height *= scale;

      const node = document.createElement('div');
      node.className = `board-element ${element.blocking ? 'blocking' : ''} ${element.className ?? ''}`;
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

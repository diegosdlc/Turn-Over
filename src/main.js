import { GAME_CONFIG } from './config/gameConfig.js';
import { FACTIONS, PLAYER_FACTION_IDS } from './content/factions.js';
import { getLevel, getNextLevel } from './content/levels/index.js?v=20260821-budget-1';
import { GameState } from './core/GameState.js?v=20260821-budget-1';
import { AssetRegistry } from './systems/AssetRegistry.js';
import { AudioManager } from './systems/AudioManager.js?v=20260814-1700';
import { GameSessionStore } from './systems/GameSessionStore.js?v=20260821-evolution-3';
import { ProgressionStore } from './systems/ProgressionStore.js?v=20260821-evolution-3';
import { TutorialSystem } from './systems/TutorialSystem.js';
import { BoardRenderer } from './render/BoardRenderer.js?v=20260821-evolution-3';
import { AIController } from './ai/AIController.js?v=20260821-budget-1';
import { legalActionsFor } from './core/rules.js?v=20260821-evolution-3';
import { buildNextPlayerBand } from './core/campaign.js?v=20260821-budget-1';
import { deployEnemyWave } from './ai/DeploymentAI.js';

class GameApp {
  constructor() {
    this.board = document.querySelector('#board');
    this.gameShell = document.querySelector('#game-shell');
    this.homeScreen = document.querySelector('#home-screen');
    this.resultDialog = document.querySelector('#result-dialog');
    this.resultContent = document.querySelector('#result-content');
    this.settingsDialog = document.querySelector('#settings-dialog');
    this.factionDialog = document.querySelector('#faction-dialog');
    this.notebook = document.querySelector('#notebook-ui');
    this.deploymentPanel = document.querySelector('#deployment-panel');
    this.deploymentPieces = document.querySelector('#deployment-pieces');
    this.deploymentStatus = document.querySelector('#deployment-status');
    this.enemyDeploymentPieces = document.querySelector('#enemy-deployment-pieces');
    this.deploymentRoundLabel = document.querySelector('#deployment-round-label');
    this.deploymentStart = document.querySelector('#deployment-start');
    this.assets = new AssetRegistry(FACTIONS);
    this.audio = new AudioManager();
    this.progression = new ProgressionStore(GAME_CONFIG.progressionStorageKey, GAME_CONFIG.defaultLevelId);
    this.session = new GameSessionStore(
      GAME_CONFIG.sessionStorageKey ?? 'bandas-del-tablero:session:v1',
      GAME_CONFIG.sessionSchemaVersion ?? 1,
      PLAYER_FACTION_IDS
    );
    this.tutorial = new TutorialSystem({ storagePrefix: GAME_CONFIG.tutorialStoragePrefix });
    this.level = null;
    this.state = null;
    this.renderer = null;
    this.ai = null;
    this.aiTimer = null;
    this.nextPlayerBand = null;
  }

  start() {
    const params = new URLSearchParams(location.search);
    const requestedLevelId = params.get(GAME_CONFIG.levelQueryParam);
    const requestedFactionId = params.get(GAME_CONFIG.factionQueryParam);
    const forceTutorial = params.get(GAME_CONFIG.tutorialQueryParam) === '1';
    this.bindMenu();
    window.addEventListener('game:return-home', () => this.showHome());
    if (requestedLevelId) {
      const requestedOptions = {
        playerFactionId: PLAYER_FACTION_IDS.includes(requestedFactionId) ? requestedFactionId : undefined,
        playerBand: this.progression.getPlayerBand()
      };
      this.startGame(getLevel(requestedLevelId, requestedOptions) ?? getLevel(GAME_CONFIG.defaultLevelId), { forceTutorial });
    }
    else this.showHome();

    document.addEventListener('keydown', event => {
      if (this.state && (event.key === 'r' || event.key === 'R') && !this.state.pendingCapture) this.resetLevel();
    });

    document.addEventListener('pointerdown', () => this.audio.unlock(), { passive: true });
  }

  bindMenu() {
    document.querySelector('#new-game').addEventListener('click', () => this.openFactionSelection());
    document.querySelector('#continue-game').addEventListener('click', () => this.continueGame());
    document.querySelector('#home-settings').addEventListener('click', () => this.openSettings());
    document.querySelector('#game-settings').addEventListener('click', () => this.openSettings());
    document.querySelector('#close-settings').addEventListener('click', () => this.settingsDialog.close());
    document.querySelector('#close-faction-selection').addEventListener('click', () => this.factionDialog.close());
    this.deploymentStart?.addEventListener('click', () => this.startDeployedGame());
    document.querySelectorAll('[data-player-faction]').forEach(button => {
      button.addEventListener('click', () => this.startNewGame(button.dataset.playerFaction));
    });
  }

  openFactionSelection() {
    if (!this.factionDialog.open) this.factionDialog.showModal();
  }

  startNewGame(playerFactionId) {
    if (!PLAYER_FACTION_IDS.includes(playerFactionId)) return;
    this.session.clear();
    if (this.factionDialog.open) this.factionDialog.close();
    this.startGame(getLevel(GAME_CONFIG.defaultLevelId, { playerFactionId }));
  }

  showHome() {
    this.cancelAiTurn();
    if (this.factionDialog.open) this.factionDialog.close();
    this.gameShell.hidden = true;
    this.homeScreen.hidden = false;
    document.querySelector('#continue-game').disabled = !this.session.load();
  }

  startGame(level, options = {}) {
    this.homeScreen.hidden = true;
    this.gameShell.hidden = false;
    this.loadLevel(level, options);
  }

  continueGame() {
    const saved = this.session.load();
    const level = saved && getLevel(saved.levelId, {
      playerFactionId: saved.playerFactionId,
      playerBand: this.progression.getPlayerBand()
    });
    if (!level) { this.session.clear(); this.showHome(); return; }
    this.startGame(level, { savedState: saved.state });
  }

  openSettings() {
    if (!this.settingsDialog.open) this.settingsDialog.showModal();
  }
  loadLevel(level, { forceTutorial = false, savedState = null } = {}) {
    if (!level) throw new Error('No hay ningún nivel disponible.');
    this.cancelAiTurn();
    this.nextPlayerBand = null;
    this.level = level;
    this.state = new GameState(level);
    if (savedState) this.restoreSavedState(savedState);
    this.ai = level.ai ? new AIController(level.ai) : null;
    this.renderer = new BoardRenderer({
      board: this.board,
      level,
      state: this.state,
      assets: this.assets,
      onCellClick: (option, unit, x, y) => this.cellClick(option, unit, x, y),
      onCaptureAction: action => this.resolveCapture(action)
    });
    this.audio.configure(level.music);
    this.tutorial.configure(level.id, level.tutorial, { forceEnabled: forceTutorial });
    if (this.resultDialog.open) this.resultDialog.close();
    this.resolvePhase();
    this.saveSession();
  }

  restoreSavedState(savedState) {
    if (!Array.isArray(savedState.units)) return;
    this.state.units = savedState.units;
    this.state.currentTurn = savedState.currentTurn === 'enemy' ? 'enemy' : 'player';
    this.state.finished = Boolean(savedState.finished);
    this.state.phase = savedState.phase === 'deployment' ? 'deployment' : 'play';
    this.state.deploymentRound = Math.min(3, Math.max(1, Number(savedState.deploymentRound) || 1));
    this.state.deploymentTurn = savedState.deploymentTurn === 'enemy' ? 'enemy' : 'player';
    this.state.deploymentCommittedIds = Array.isArray(savedState.deploymentCommittedIds) ? savedState.deploymentCommittedIds : [];
    this.state.roundsElapsed = Math.max(0, Number(savedState.roundsElapsed) || 0);
    if (savedState.teamEvolution) this.state.teamEvolution = savedState.teamEvolution;
    this.state.selectedId = null;
    this.state.pendingCapture = null;
  }

  saveSession() {
    if (this.level && this.state && !this.state.finished) this.session.save(this.level, this.state);
  }

  resetLevel() {
    this.cancelAiTurn();
    this.state.reset();
    this.saveSession();
    if (this.resultDialog.open) this.resultDialog.close();
    this.resolvePhase();
  }

  resolvePhase() {
    if (this.state.isDeploying()) {
      if (this.state.isAlternatingDeployment() && this.state.deploymentTurn === 'enemy') this.deployEnemy();
      this.render();
      return;
    }
    this.resolveTurn();
  }

  render() {
    window.turnOverNotebookState = { units: this.state.units };
    window.dispatchEvent(new Event('game:rosters-updated'));
    this.renderer.render();
    this.renderDeployment();
    if (!this.state.isDeploying()) {
      this.tutorial.render(this.board, anchor => this.renderer.resolveTutorialAnchor(anchor));
    }
  }

  renderDeployment() {
    const deploying = Boolean(this.state?.isDeploying());
    if (this.deploymentPanel) this.deploymentPanel.hidden = !deploying;
    this.notebook?.classList.toggle('is-deploying', deploying);
    if (!deploying || !this.deploymentPieces) return;

    const alternating = this.state.isAlternatingDeployment();
    const roster = this.state.deploymentRoster();
    const units = this.state.deploymentUnits();
    const playerTurn = !alternating || this.state.deploymentTurn === 'player';
    if (this.deploymentRoundLabel) this.deploymentRoundLabel.textContent = alternating
      ? `Ronda ${this.state.deploymentRound} de 3 · ${playerTurn ? 'Tu despliegue' : 'Despliega el rival'}`
      : 'Prepara tu banda';
    if (this.enemyDeploymentPieces) {
      this.enemyDeploymentPieces.replaceChildren();
      for (const enemy of this.state.deploymentRoster('enemy')) {
        const card = document.createElement('div');
        card.className = 'enemy-roster-piece';
        this.applyDeploymentPalette(card, enemy);
        const icon = document.createElement('span');
        icon.className = 'enemy-roster-glyph';
        icon.textContent = enemy.fallbackGlyph;
        const name = document.createElement('span');
        name.textContent = enemy.name + (enemy.evolutionStage === 'evolved' ? '+' : '');
        const state = document.createElement('small');
        state.textContent = enemy.inReserve ? 'Pendiente' : 'En tablero';
        card.append(icon, name, state);
        this.enemyDeploymentPieces.append(card);
      }
    }
    const pointLimit = this.state.deploymentPointLimit();
    const budgeted = pointLimit != null;
    this.deploymentPieces.replaceChildren();

    for (const unit of roster) {
      const card = document.createElement('div');
      card.className = 'deployment-piece-card';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = `deployment-piece ${unit.id === this.state.selectedId ? 'selected' : ''} ${unit.inReserve ? 'in-reserve' : 'in-lineup'}`;
      const cost = this.state.deploymentUnitCost(unit);
      const affordable = this.state.canAffordDeploymentUnit(unit);
      const locked = alternating && (this.state.isDeploymentCommitted(unit) || !playerTurn ||
        (unit.inReserve && this.state.deploymentRoundPlaced('player') >= this.state.deploymentRoundQuota('player')));
      button.disabled = Boolean(locked || (unit.inReserve && !affordable));
      button.setAttribute('aria-pressed', String(!unit.inReserve));
      button.setAttribute('aria-label', `${unit.inReserve ? 'Elegir' : 'Recolocar'} ${unit.name}, ${cost} puntos${unit.evolutionStage === 'evolved' ? ', evolucionada' : ''}`);
      this.applyDeploymentPalette(button, unit);

      const fallback = document.createElement('span');
      fallback.className = 'deployment-piece-fallback';
      fallback.textContent = unit.fallbackGlyph;
      button.append(fallback);

      const asset = this.assets.pieceAsset(unit);
      if (asset) {
        const image = document.createElement('img');
        image.className = 'deployment-piece-image';
        image.src = this.assets.resolve(asset);
        image.alt = '';
        image.draggable = false;
        image.addEventListener('error', () => image.remove(), { once: true });
        button.append(image);
        button.classList.add('has-image');
      }

      const costBadge = document.createElement('span');
      costBadge.className = 'deployment-piece-cost';
      costBadge.textContent = `${cost} pt${cost === 1 ? '' : 's'}`;
      button.append(costBadge);

      if (unit.evolutionStage === 'evolved') {
        const evolved = document.createElement('span');
        evolved.className = 'deployment-piece-evolved';
        evolved.textContent = '+';
        evolved.setAttribute('aria-hidden', 'true');
        button.append(evolved);
      }

      const name = document.createElement('span');
      name.className = 'deployment-piece-name';
      name.textContent = unit.name;
      button.append(name);

      button.addEventListener('click', () => {
        if (!playerTurn || (alternating && this.state.isDeploymentCommitted(unit))) return;
        if (this.state.selectedId === unit.id) this.state.clearSelection();
        else this.state.setSelected(unit.id);
        this.render();
      });
      card.append(button);

      if (budgeted && !unit.inReserve && (!alternating || (playerTurn && !this.state.isDeploymentCommitted(unit)))) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'deployment-piece-remove';
        remove.textContent = 'Retirar';
        remove.setAttribute('aria-label', `Retirar ${unit.name} de la alineación`);
        remove.addEventListener('click', () => {
          if (!this.state.reserveDeploymentUnit(unit)) return;
          this.saveSession();
          this.render();
        });
        card.append(remove);
      }

      this.deploymentPieces.append(card);
    }

    const selected = this.state.selected();
    const spent = this.state.deploymentPointsSpent();
    const placed = units.filter(unit => unit.x != null && unit.y != null).length;
    const complete = this.state.deploymentComplete() && !selected?.inReserve;
    const budgetText = budgeted ? `${spent}/${pointLimit} pts` : `${placed}/${units.length}`;

    if (this.deploymentStatus) {
      if (selected?.inReserve) {
        const cost = this.state.deploymentUnitCost(selected);
        const afterPlacement = budgeted ? ` · quedarán ${pointLimit - spent - cost} pts` : '';
        this.deploymentStatus.textContent = `Coloca ${selected.name} (${cost} pts) en una casilla resaltada${afterPlacement}. Banda: ${budgetText}.`;
      } else if (complete) {
        this.deploymentStatus.textContent = `Banda lista: ${units.length} pieza${units.length === 1 ? '' : 's'} · ${budgetText}. Ya puedes iniciar la partida.`;
      } else if (selected) {
        this.deploymentStatus.textContent = `Recoloca ${selected.name} en una casilla resaltada. Banda: ${budgetText}.`;
      } else if (budgeted) {
        this.deploymentStatus.textContent = `Elige qué piezas participan y colócalas. Banda: ${budgetText} · quedan ${pointLimit - spent} pts.`;
      } else {
        this.deploymentStatus.textContent = `Selecciona una pieza y colócala en una casilla resaltada. ${placed}/${units.length}`;
      }
    }
    if (alternating && this.deploymentStatus) {
      const used = this.state.deploymentRoundPlaced('player');
      const quota = this.state.deploymentRoundQuota('player');
      this.deploymentStatus.textContent = `Ronda ${this.state.deploymentRound}/3 · ${used}/${quota} piezas nuevas · ${budgetText}. Las piezas confirmadas no se pueden mover.`;
    }
    if (this.deploymentStart) {
      const available = alternating ? this.state.canFinishDeploymentRound() && !selected?.inReserve : complete;
      this.deploymentStart.hidden = !available;
      this.deploymentStart.textContent = alternating && this.state.deploymentRound < 3 ? 'Confirmar ronda' : 'Iniciar partida';
    }
  }

  applyDeploymentPalette(element, unit) {
    const palette = this.assets.piecePalette(unit);
    if (!palette) return;
    element.style.setProperty('--unit-primary', palette.primary);
    element.style.setProperty('--unit-secondary', palette.secondary);
    element.style.setProperty('--unit-text', palette.text);
  }

  cellClick(option, unit, x, y) {
    if (this.state.finished || this.state.pendingCapture) return;
    if (this.state.isDeploying()) {
      this.deploymentCellClick(unit, x, y);
      return;
    }
    if (this.ai?.isTurn(this.state)) return;
    if (option) {
      this.perform(this.state.selected(), option);
      return;
    }

    if (unit?.team === this.state.currentTurn) {
      this.state.setSelected(unit.id);
      this.tutorial.notify('unit-selected');
    } else {
      this.state.clearSelection();
    }
    this.render();
  }

  deploymentCellClick(unit, x, y) {
    if (this.state.isAlternatingDeployment() && this.state.deploymentTurn !== 'player') return;
    const deploymentTeam = this.state.deploymentTeam();
    if (unit?.team === deploymentTeam) {
      if (this.state.isAlternatingDeployment() && this.state.isDeploymentCommitted(unit)) return;
      this.state.setSelected(unit.id);
      this.render();
      return;
    }

    const selected = this.state.selected();
    if (!selected || !this.state.placeDeploymentUnit(selected, x, y)) return;
    this.state.clearSelection();
    this.saveSession();
    this.render();
  }

  deployEnemy() {
    if (!this.state?.isAlternatingDeployment() || this.state.deploymentTurn !== 'enemy') return;
    deployEnemyWave(this.state, this.level);
    this.state.finishEnemyDeploymentRound();
    this.saveSession();
  }

  startDeployedGame() {
    if (this.state?.isAlternatingDeployment() && this.state.deploymentRound < 3) {
      if (!this.state.canFinishDeploymentRound() || !this.state.advanceDeploymentRound()) return;
      this.deployEnemy();
      this.saveSession();
      this.render();
      return;
    }
    if (!this.state?.beginPlay()) return;
    this.saveSession();
    this.resolveTurn();
  }

  perform(unit, option) {
    if (!unit || this.state.finished || this.state.pendingCapture) return;
    if (option.kind === 'royal-swap') {
      const partner = this.state.units.find(piece => piece.id === option.targetId);
      if (partner && this.state.swapRoyalPair(unit, partner)) {
        this.tutorial.notify('move-completed');
        this.finishMove();
      }
      return;
    }
    if (option.kind === 'capture') {
      this.chooseCaptureAction(unit, option);
      return;
    }
    this.moveUnit(unit, option);
  }

  moveUnit(unit, option) {
    this.state.leaveOrigin(unit);
    this.state.completeMove(unit, option);
    this.tutorial.notify('move-completed');
    this.finishMove();
  }

  chooseCaptureAction(unit, option) {
    const target = this.state.activeAt(option.x, option.y);
    if (!target || target.team === unit.team) return;
    this.state.pendingCapture = { unitId: unit.id, targetId: target.id, x: option.x, y: option.y };
    this.render();
  }

  resolveCapture(action) {
    const pending = this.state.pendingCapture;
    if (!pending || this.state.finished) return;

    const unit = this.state.units.find(piece => piece.id === pending.unitId);
    const target = this.state.units.find(piece => piece.id === pending.targetId);
    this.state.pendingCapture = null;

    if (!unit || !target || !this.state.active(unit) || !this.state.active(target)) {
      this.render();
      return;
    }

    if (this.state.rejectAttack(unit, target)) {
      this.tutorial.notify('capture-rejected');
      this.finishMove();
      return;
    }

    this.state.leaveOrigin(unit);

    if (action === 'capture') {
      target.captured = true;
      target.capturedBy = unit.team;
      target.x = pending.x;
      target.y = pending.y;
    } else {
      target.destroyed = true;
      target.captured = false;
      target.capturedBy = null;
      target.x = null;
      target.y = null;
    }

    this.state.completeMove(unit, { ...pending, kind: action });
    this.tutorial.notify('capture-resolved');
    this.finishMove();
  }

  finishMove() {
    this.state.clearSelection();
    this.checkEnd();
    if (!this.state.finished) {
      this.state.changeTurn();
      this.saveSession();
      this.resolveTurn();
    }
  }

  resolveTurn() {
    this.cancelAiTurn();
    if (this.state.finished || this.state.isDeploying()) return;

    if (legalActionsFor(this.state, this.level).length) {
      this.render();
      this.scheduleAiTurn();
      return;
    }

    const skippedTeam = this.state.currentTurn;
    this.state.clearSelection();
    this.state.changeTurn();
    if (legalActionsFor(this.state, this.level).length) {
      this.render();
      this.showTurnPassed(skippedTeam);
      return;
    }

    this.finishDraw();
  }

  showTurnPassed(team) {
    this.resultContent.innerHTML = '';
    const card = document.createElement('section');
    card.className = 'modal-card end-card';
    const title = document.createElement('h2');
    title.textContent = 'Turno perdido';
    const explanation = document.createElement('p');
    explanation.textContent = `${this.factionName(team)} no tiene movimientos legales y pierde el turno.`;

    const actions = document.createElement('div');
    actions.className = 'result-actions';
    const continueTurn = document.createElement('button');
    continueTurn.type = 'button';
    continueTurn.className = 'primary-button';
    continueTurn.textContent = 'Continuar';
    continueTurn.addEventListener('click', () => {
      if (this.resultDialog.open) this.resultDialog.close();
      this.render();
      this.scheduleAiTurn();
    });
    actions.append(continueTurn);

    card.append(title, explanation, actions);
    this.resultContent.append(card);
    if (!this.resultDialog.open) this.resultDialog.showModal();
  }

  scheduleAiTurn() {
    this.cancelAiTurn();
    if (!this.ai?.isTurn(this.state)) return;

    this.aiTimer = window.setTimeout(() => {
      this.aiTimer = null;
      this.playAiTurn();
    }, this.ai.thinkDelayMs);
  }

  cancelAiTurn() {
    if (this.aiTimer != null) window.clearTimeout(this.aiTimer);
    this.aiTimer = null;
  }

  playAiTurn() {
    if (!this.ai?.isTurn(this.state)) return;
    const action = this.ai.chooseAction(this.state, this.level);
    if (!action) {
      this.resolveTurn();
      return;
    }

    const unit = this.state.units.find(piece => piece.id === action.unitId);
    if (!unit || !this.state.active(unit)) return;

    if (action.kind === 'royal-swap') {
      const partner = this.state.units.find(piece => piece.id === action.targetId);
      if (partner && this.state.swapRoyalPair(unit, partner)) this.finishMove();
      return;
    }

    if (action.kind === 'move') {
      this.moveUnit(unit, action);
      return;
    }

    const target = this.state.units.find(piece => piece.id === action.targetId);
    if (!target || !this.state.active(target)) return;
    if (this.state.rejectAttack(unit, target)) {
      this.finishMove();
      return;
    }
    this.state.leaveOrigin(unit);

    if (action.kind === 'capture') {
      target.captured = true;
      target.destroyed = false;
      target.capturedBy = unit.team;
      target.x = action.x;
      target.y = action.y;
    } else {
      target.destroyed = true;
      target.captured = false;
      target.capturedBy = null;
      target.x = null;
      target.y = null;
    }

    this.state.completeMove(unit, action);
    this.finishMove();
  }

  checkEnd() {
    const playerUnits = this.state.units.filter(unit => this.state.active(unit) && unit.team === 'player');
    const enemyUnits = this.state.units.filter(unit => this.state.active(unit) && unit.team === 'enemy');
    if (!playerUnits.length) this.finish('enemy');
    else if (!enemyUnits.length) this.finish('player');
  }

  finish(winner) {
    if (this.state.finished) return;
    this.state.finished = true;
    this.session.clear();

    const playerRecruits = this.state.unresolvedPrisoners().filter(unit => unit.capturedBy === 'player');
    const enemyRecruits = this.state.unresolvedPrisoners().filter(unit => unit.capturedBy === 'enemy');
    playerRecruits.forEach(unit => { unit.recruitedBy = 'player'; });
    enemyRecruits.forEach(unit => { unit.recruitedBy = 'enemy'; });
    this.nextPlayerBand = winner === 'player' ? buildNextPlayerBand(this.state.units, this.level.id) : null;

    if (winner === 'player') {
      this.progression.completeLevel(this.level.id, {
        nextLevelId: this.level.nextLevelId,
        recruitedUnitIds: playerRecruits.map(unit => unit.id),
        playerBand: this.nextPlayerBand
      });
    }

    this.render();
    this.showResult(winner, playerRecruits, enemyRecruits);
  }

  finishDraw() {
    if (this.state.finished) return;
    this.state.finished = true;
    this.session.clear();
    this.cancelAiTurn();
    this.render();

    this.resultContent.innerHTML = '';
    const card = document.createElement('section');
    card.className = 'modal-card end-card';
    const title = document.createElement('h2');
    title.textContent = 'Tablas';
    const explanation = document.createElement('p');
    explanation.textContent = 'Ninguna banda tiene movimientos legales.';

    const actions = document.createElement('div');
    actions.className = 'result-actions';
    const restart = document.createElement('button');
    restart.type = 'button';
    restart.className = 'primary-button';
    restart.textContent = 'Reiniciar encuentro';
    restart.addEventListener('click', () => this.resetLevel());
    actions.append(restart);

    card.append(title, explanation, actions);
    this.resultContent.append(card);
    if (!this.resultDialog.open) this.resultDialog.showModal();
  }

  showResult(winner, playerRecruits, enemyRecruits) {
    this.resultContent.innerHTML = '';
    const card = document.createElement('section');
    card.className = 'modal-card end-card';

    const title = document.createElement('h2');
    title.textContent = `Gana ${this.factionName(winner)}`;

    const explanation = document.createElement('p');
    explanation.textContent = 'Las piezas congeladas que siguen en el tablero pasan a la banda que las capturó.';

    const grid = document.createElement('div');
    grid.className = 'results-grid';
    grid.append(
      this.recruitColumn(`${this.factionName('player')} incorpora`, playerRecruits),
      this.recruitColumn(`${this.factionName('enemy')} incorpora`, enemyRecruits)
    );

    const actions = document.createElement('div');
    actions.className = 'result-actions';

    const replay = document.createElement('button');
    replay.type = 'button';
    replay.className = 'primary-button';
    replay.textContent = 'Jugar otra vez';
    replay.addEventListener('click', () => this.resetLevel());
    actions.append(replay);

    if (winner === 'player' && this.level.nextLevelId) {
      const next = document.createElement('button');
      next.type = 'button';
      next.className = 'primary-button';
      next.textContent = 'Siguiente nivel';
      next.addEventListener('click', () => {
        const nextLevel = getNextLevel(this.level, { playerBand: this.nextPlayerBand });
        if (!nextLevel) return;
        if (this.resultDialog.open) this.resultDialog.close();
        this.loadLevel(nextLevel);
      });
      actions.append(next);
    }

    card.append(title, explanation, grid, actions);
    this.resultContent.append(card);
    if (!this.resultDialog.open) this.resultDialog.showModal();
  }

  recruitColumn(titleText, pieces) {
    const column = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = titleText;
    column.append(title);

    if (!pieces.length) {
      const empty = document.createElement('p');
      empty.textContent = 'Ninguna.';
      column.append(empty);
      return column;
    }

    const list = document.createElement('ul');
    for (const piece of pieces) {
      const item = document.createElement('li');
      item.textContent = `${piece.fallbackGlyph} ${piece.name}`;
      list.append(item);
    }
    column.append(list);
    return column;
  }

  factionName(team) {
    const factionId = this.level.teams[team];
    if (factionId === 'green' && this.level.teams.player === this.level.teams.enemy) {
      return team === 'player' ? 'Verde clara' : 'Verde oscura';
    }
    return FACTIONS[factionId]?.name ?? team;
  }
}

new GameApp().start();

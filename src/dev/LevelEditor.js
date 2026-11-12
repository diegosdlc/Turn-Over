import { PIECES } from '../content/bands.js';
import { cellBox, place } from '../core/geometry.js';
import {
  BALANCE_FILES, AI_FIELDS, createEditorDraft, editorCsv, editedFiles,
  validateEditorDraft, previewLevel, levelRow, levelEnemies, levelObstacles,
  activeProfile, updateLevelField, updateProfileField, moveEnemy, addEnemy,
  removeEnemy, updateEnemyField, moveObstacle, addObstacle, removeObstacle
} from './level-editor-data.js';
import { createGitHubEditorClient, EDITOR_REPOSITORY } from './github-editor-api.js';

const PIECE_TYPES = Object.keys(PIECES);
const PROFILE_NAMES = {
  balanced: 'Equilibrada', defensive: 'Defensiva', interceptor: 'Interceptora',
  hunter: 'Cazadora', aggressive: 'Agresiva'
};

function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function option(value, text, selected) {
  return '<option value="' + esc(value) + '"' +
    (value === selected ? ' selected' : '') + '>' + esc(text) + '</option>';
}

function inputNumber(key, label, value, min, max, step) {
  return '<label class="level-editor-field"><span>' + esc(label) + '</span>' +
    '<input type="number" data-level-field="' + esc(key) + '" value="' + esc(value) +
    '" min="' + esc(min) + '" max="' + esc(max) + '" step="' + esc(step) + '"></label>';
}

function fieldSelect(id, label, selected, options) {
  return '<label class="level-editor-field"><span>' + esc(label) + '</span>' +
    '<select id="' + esc(id) + '">' + options.map(entry =>
      option(entry[0], entry[1], selected)).join('') + '</select></label>';
}

function fileFor(name) {
  return new URL('../../' + BALANCE_FILES[name], import.meta.url);
}

async function localCsv() {
  const values = await Promise.all(Object.keys(BALANCE_FILES).map(async name => {
    const response = await fetch(fileFor(name), { cache: 'no-store' });
    if (!response.ok) throw new Error('No se pudo leer ' + BALANCE_FILES[name]);
    return [name, await response.text()];
  }));
  return Object.fromEntries(values);
}

export class LevelEditor {
  constructor({ board, shell, onPreview, onClose }) {
    this.board = board;
    this.shell = shell;
    this.onPreview = onPreview;
    this.onClose = onClose;
    this.active = false;
    this.busy = false;
    this.mode = 'enemy';
    this.selectedEnemy = null;
    this.selectedObstacle = null;
    this.client = null;
    this.branches = [];
    this.branch = null;
    this.branchHead = null;
    this.draft = null;
    this.baseLevel = null;
    this.status = 'Edición local. Conecta GitHub para guardar en una rama.';
    this.error = false;

    this.overlay = document.createElement('div');
    this.overlay.className = 'level-editor-overlay';
    this.overlay.hidden = true;
    this.board.after(this.overlay);

    this.panel = document.createElement('aside');
    this.panel.className = 'level-editor-panel';
    this.panel.setAttribute('aria-label', 'Editor de nivel');
    this.panel.hidden = true;
    document.body.append(this.panel);

    this.panel.addEventListener('click', event => this.onPanelClick(event));
    this.panel.addEventListener('change', event => this.onPanelChange(event));
    this.panel.addEventListener('submit', event => event.preventDefault());
  }

  setLevel(level) {
    if (!level || !/^tutorial-0[1-4]$/.test(level.id)) {
      this.baseLevel = null;
      this.draft = null;
      return;
    }
    if (this.baseLevel?.id !== level.id) {
      this.draft = null;
      this.selectedEnemy = null;
      this.selectedObstacle = null;
      this.branchHead = null;
      this.baseLevel = level;
    }
  }

  async enable(level) {
    this.setLevel(level);
    if (!this.baseLevel) throw new Error('Solo se pueden editar los cuatro niveles de campaña.');
    if (!this.draft) {
      const values = this.client && this.branch
        ? await this.client.readCsv(this.branch, BALANCE_FILES)
        : { csv: await localCsv(), head: null };
      this.draft = createEditorDraft(values.csv, level.id);
      validateEditorDraft(this.draft);
      this.branchHead = values.head;
    }
    this.selectedEnemy ??= levelEnemies(this.draft)[0]?.unit_id ?? null;
    this.selectedObstacle ??= levelObstacles(this.draft)[0]?.obstacle_id ?? null;
    this.active = true;
    this.overlay.hidden = false;
    this.panel.hidden = false;
    this.board.classList.add('level-editor-board');
    this.shell.classList.add('level-editor-active');
    this.render();
    window.dispatchEvent(new Event('game:level-editor-state'));
  }

  disable() {
    this.active = false;
    this.overlay.hidden = true;
    this.panel.hidden = true;
    this.board.classList.remove('level-editor-board');
    this.shell.classList.remove('level-editor-active');
    window.dispatchEvent(new Event('game:level-editor-state'));
  }

  message(text, error = false) {
    this.status = text;
    this.error = error;
    const node = this.panel.querySelector('#level-editor-status');
    if (node) {
      node.textContent = text;
      node.classList.toggle('is-error', error);
    }
  }

  fail(error) {
    this.message(error?.message || 'No se pudo completar la operación.', true);
  }

  render() {
    if (!this.active || !this.draft) return;
    this.renderPanel();
    this.renderOverlay();
  }

  renderPanel() {
    const draft = this.draft;
    const level = levelRow(draft);
    const enemies = levelEnemies(draft);
    const obstacles = levelObstacles(draft);
    const enemy = enemies.find(item => item.unit_id === this.selectedEnemy);
    const obstacle = obstacles.find(item => item.obstacle_id === this.selectedObstacle);
    const profile = activeProfile(draft);
    const changes = editedFiles(draft).map(item => item.path);
    const profileIds = draft.rows.aiProfiles.map(item => item.profile_id);
    const branchOptions = this.branches.map(name => option(name, name, this.branch)).join('');
    const enemyOptions = enemies.map(item => option(item.unit_id,
      item.piece_type + ' · (' + item.x + ',' + item.y + ')', this.selectedEnemy)).join('');
    const obstacleOptions = obstacles.map(item => option(item.obstacle_id,
      item.obstacle_id + ' · (' + item.x + ',' + item.y + ')', this.selectedObstacle)).join('');

    this.panel.innerHTML =
      '<div class="level-editor-heading"><div><strong>Editor de nivel</strong><small>' +
      esc(level.name) + '</small></div><button type="button" data-action="close" aria-label="Cerrar editor">✕</button></div>' +
      '<div class="level-editor-scroll">' +
      '<p class="level-editor-help">Selecciona una pieza u obstáculo y pulsa su destino en el tablero. También puedes arrastrarlos.</p>' +
      '<div class="level-editor-toolbar">' +
        '<button type="button" data-mode="enemy"' + (this.mode === 'enemy' ? ' aria-pressed="true"' : '') + '>Rivales</button>' +
        '<button type="button" data-mode="obstacle"' + (this.mode === 'obstacle' ? ' aria-pressed="true"' : '') + '>Obstáculos</button>' +
        '<button type="button" data-mode="add-obstacle"' + (this.mode === 'add-obstacle' ? ' aria-pressed="true"' : '') + '>+ Obstáculo</button>' +
        '<button type="button" data-mode="erase"' + (this.mode === 'erase' ? ' aria-pressed="true"' : '') + '>Borrar</button>' +
      '</div>' +
      '<section class="level-editor-section"><h3>Despliegue rival</h3>' +
        '<label class="level-editor-field"><span>Pieza seleccionada</span><select id="editor-enemy">' +
          enemyOptions + '</select></label>' +
        (enemy ? fieldSelect('editor-enemy-type', 'Tipo', enemy.piece_type,
          PIECE_TYPES.map(type => [type, type])) +
          fieldSelect('editor-enemy-stage', 'Evolución', enemy.evolution_stage,
            [['base', 'Base'], ['evolved', 'Evolucionada']]) +
          fieldSelect('editor-enemy-facing', 'Orientación', enemy.facing,
            [['south', 'Sur'], ['north', 'Norte']]) +
          '<button type="button" data-action="remove-enemy">Retirar pieza rival</button>' : '') +
        '<div class="level-editor-inline"><select id="editor-new-enemy">' +
        PIECE_TYPES.map(type => option(type, type, 'pawn')).join('') +
        '</select><button type="button" data-action="add-enemy">Añadir pieza</button></div>' +
      '</section>' +
      '<section class="level-editor-section"><h3>Obstáculos</h3>' +
        '<label class="level-editor-field"><span>Obstáculo seleccionado</span><select id="editor-obstacle">' +
          obstacleOptions + '</select></label>' +
        (obstacle ? '<p class="level-editor-help">Posición: (' + esc(obstacle.x) + ', ' + esc(obstacle.y) +
          ')</p><button type="button" data-action="remove-obstacle">Retirar obstáculo</button>' : '') +
      '</section>' +
      '<section class="level-editor-section"><h3>Balance del nivel</h3><div class="level-editor-fields">' +
        inputNumber('point_limit', 'Presupuesto', level.point_limit, 1, 10000, 1) +
        inputNumber('ai_depth', 'Profundidad IA', level.ai_depth, 1, 10, 1) +
        inputNumber('ai_randomness', 'Aleatoriedad IA', level.ai_randomness, 0, 1, 0.01) +
        inputNumber('ai_think_delay_ms', 'Retardo IA (ms)', level.ai_think_delay_ms, 0, 10000, 50) +
        inputNumber('ai_aggression', 'Agresividad IA', level.ai_aggression, 0, 5, 0.1) +
        inputNumber('encroachment_start_action', 'Primer cierre', level.encroachment_start_action, 1, 999, 1) +
        (level.victory === 'survive'
          ? inputNumber('survive_rounds', 'Rondas de supervivencia', level.survive_rounds, 1, 999, 1) : '') +
        (level.victory === 'escort-king'
          ? inputNumber('target_row', 'Fila objetivo', level.target_row, 0, 7, 1) +
            inputNumber('mission_king_x', 'Rey misión X', level.mission_king_x, 0, 7, 1) +
            inputNumber('mission_king_y', 'Rey misión Y', level.mission_king_y, 6, 7, 1) : '') +
      '</div></section>' +
      '<section class="level-editor-section"><h3>Perfil de IA</h3>' +
        fieldSelect('editor-profile', 'Comportamiento', level.ai_profile,
          profileIds.map(id => [id, PROFILE_NAMES[id] || id])) +
        '<p class="level-editor-help">Los pesos son compartidos por todos los niveles que usan este perfil.</p>' +
        '<details class="level-editor-advanced"><summary>Editar pesos tácticos</summary>' +
          '<div class="level-editor-fields">' +
          (profile ? AI_FIELDS.map(key =>
            '<label class="level-editor-field"><span>' + esc(key) + '</span>' +
            '<input type="number" data-profile-field="' + esc(key) + '" value="' + esc(profile[key]) +
            '" min="0" max="2000" step="any"></label>').join('') : '') +
          '</div></details></section>' +
      '<section class="level-editor-section"><h3>Guardar en GitHub</h3>' +
        '<p class="level-editor-help">Repositorio: ' + esc(EDITOR_REPOSITORY) +
        '. Introduce un token temporal con permiso Contents: lectura y escritura. ' +
        'No se guarda en el navegador ni en los CSV.</p>' +
        '<div class="level-editor-inline"><input type="password" id="editor-token" autocomplete="off" ' +
          'placeholder="Token GitHub" aria-label="Token GitHub">' +
          '<button type="button" data-action="connect">Conectar</button></div>' +
        (this.client ? '<label class="level-editor-field"><span>Rama de destino</span>' +
          '<select id="editor-branch">' + branchOptions + '</select></label>' +
          '<div class="level-editor-inline"><input id="editor-new-branch" type="text" ' +
          'placeholder="balance/prueba-01" aria-label="Nueva rama">' +
          '<button type="button" data-action="create-branch">Crear rama</button></div>' : '') +
        '<p class="level-editor-help">CSV modificados: ' + (changes.length
          ? changes.map(esc).join(', ') : 'ninguno') + '</p>' +
        '<button type="button" class="level-editor-primary" data-action="save"' +
          (!this.client || !this.branchHead || !changes.length ? ' disabled' : '') +
          '>Guardar commit en rama</button>' +
      '</section>' +
      '<p id="level-editor-status" class="level-editor-status' +
        (this.error ? ' is-error' : '') + '" role="status" aria-live="polite">' +
        esc(this.status) + '</p>' +
      '</div><div class="level-editor-footer">' +
      '<button type="button" data-action="preview">Probar cambios</button>' +
      '<button type="button" data-action="close">Salir del editor</button></div>';
  }

  renderOverlay() {
    this.overlay.replaceChildren();
    const enemies = levelEnemies(this.draft);
    const obstacles = levelObstacles(this.draft);
    const projection = this.baseLevel.board.projection;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const enemy = enemies.find(item => Number(item.x) === x && Number(item.y) === y);
        const obstacle = obstacles.find(item => Number(item.x) === x && Number(item.y) === y);
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'level-editor-cell';
        if (enemy) cell.classList.add('has-enemy');
        if (obstacle) cell.classList.add('has-obstacle');
        if (enemy?.unit_id === this.selectedEnemy && this.mode === 'enemy') {
          cell.classList.add('is-selected');
        }
        if (obstacle?.obstacle_id === this.selectedObstacle && this.mode === 'obstacle') {
          cell.classList.add('is-selected');
        }
        cell.textContent = enemy ? (PIECES[enemy.piece_type]?.fallbackGlyph || enemy.piece_type[0])
          : obstacle ? '■' : '';
        cell.setAttribute('aria-label', 'Casilla ' + x + ',' + y +
          (enemy ? ' rival ' + enemy.piece_type : obstacle ? ' obstáculo' : ' libre'));
        place(cell, cellBox(projection, x, y), projection);
        cell.addEventListener('click', () => this.boardClick(x, y));
        if (enemy || obstacle) {
          cell.draggable = true;
          cell.addEventListener('dragstart', event => {
            event.dataTransfer.setData('text/plain', JSON.stringify({
              type: enemy ? 'enemy' : 'obstacle',
              id: enemy ? enemy.unit_id : obstacle.obstacle_id
            }));
          });
        }
        cell.addEventListener('dragover', event => event.preventDefault());
        cell.addEventListener('drop', event => {
          event.preventDefault();
          try {
            const item = JSON.parse(event.dataTransfer.getData('text/plain'));
            if (item.type === 'enemy') {
              moveEnemy(this.draft, item.id, x, y);
              this.selectedEnemy = item.id;
              this.mode = 'enemy';
            } else if (item.type === 'obstacle') {
              moveObstacle(this.draft, item.id, x, y);
              this.selectedObstacle = item.id;
              this.mode = 'obstacle';
            }
            this.message('Posición actualizada.');
            this.render();
          } catch (error) { this.fail(error); }
        });
        this.overlay.append(cell);
      }
    }
  }

  boardClick(x, y) {
    try {
      const enemy = levelEnemies(this.draft).find(item => Number(item.x) === x && Number(item.y) === y);
      const obstacle = levelObstacles(this.draft).find(item => Number(item.x) === x && Number(item.y) === y);
      if (this.mode === 'enemy') {
        if (enemy) this.selectedEnemy = enemy.unit_id;
        else if (this.selectedEnemy) moveEnemy(this.draft, this.selectedEnemy, x, y);
      } else if (this.mode === 'obstacle') {
        if (obstacle) this.selectedObstacle = obstacle.obstacle_id;
        else if (this.selectedObstacle) moveObstacle(this.draft, this.selectedObstacle, x, y);
      } else if (this.mode === 'add-obstacle') {
        this.selectedObstacle = addObstacle(this.draft, x, y).obstacle_id;
        this.mode = 'obstacle';
      } else if (this.mode === 'erase') {
        if (obstacle) removeObstacle(this.draft, obstacle.obstacle_id);
        else if (enemy) removeEnemy(this.draft, enemy.unit_id);
      }
      this.message('Cambios locales pendientes de guardar.');
      this.render();
    } catch (error) { this.fail(error); }
  }

  onPanelChange(event) {
    const element = event.target;
    try {
      if (element.matches('[data-level-field]')) {
        updateLevelField(this.draft, element.dataset.levelField, element.value);
      } else if (element.matches('[data-profile-field]')) {
        updateProfileField(this.draft, element.dataset.profileField, element.value);
      } else if (element.id === 'editor-profile') {
        updateLevelField(this.draft, 'ai_profile', element.value);
      } else if (element.id === 'editor-enemy') {
        this.selectedEnemy = element.value;
      } else if (element.id === 'editor-obstacle') {
        this.selectedObstacle = element.value;
      } else if (element.id === 'editor-enemy-type' || element.id === 'editor-enemy-stage' ||
                 element.id === 'editor-enemy-facing') {
        const field = element.id === 'editor-enemy-type' ? 'piece_type'
          : element.id === 'editor-enemy-stage' ? 'evolution_stage' : 'facing';
        updateEnemyField(this.draft, this.selectedEnemy, field, element.value);
      } else if (element.id === 'editor-branch') {
        void this.loadBranch(element.value);
        return;
      } else {
        return;
      }
      this.message('Cambios locales pendientes de guardar.');
      this.render();
    } catch (error) { this.fail(error); }
  }

  async onPanelClick(event) {
    const mode = event.target.closest('[data-mode]')?.dataset.mode;
    if (mode) { this.mode = mode; this.render(); return; }
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action || this.busy) return;
    try {
      if (action === 'close') {
        this.disable();
        this.onClose?.();
      } else if (action === 'preview') {
        const level = previewLevel(this.baseLevel, this.draft);
        this.disable();
        this.onPreview(level);
      } else if (action === 'add-enemy') {
        const type = this.panel.querySelector('#editor-new-enemy')?.value ?? 'pawn';
        this.selectedEnemy = addEnemy(this.draft, type).unit_id;
        this.mode = 'enemy';
        this.render();
      } else if (action === 'remove-enemy') {
        removeEnemy(this.draft, this.selectedEnemy);
        this.selectedEnemy = levelEnemies(this.draft)[0]?.unit_id ?? null;
        this.render();
      } else if (action === 'remove-obstacle') {
        removeObstacle(this.draft, this.selectedObstacle);
        this.selectedObstacle = levelObstacles(this.draft)[0]?.obstacle_id ?? null;
        this.render();
      } else if (action === 'connect') {
        await this.connect(this.panel.querySelector('#editor-token')?.value ?? '');
      } else if (action === 'create-branch') {
        await this.createBranch(this.panel.querySelector('#editor-new-branch')?.value.trim());
      } else if (action === 'save') {
        await this.save();
      }
      if (['add-enemy', 'remove-enemy', 'remove-obstacle'].includes(action)) {
        this.message('Cambios locales pendientes de guardar.');
      }
    } catch (error) { this.fail(error); }
  }

  async connect(token) {
    this.busy = true;
    this.message('Conectando con GitHub…');
    try {
      const client = createGitHubEditorClient(token);
      const branches = await client.branches();
      if (!branches.length) throw new Error('No se encontraron ramas en el repositorio.');
      this.client = client;
      this.branches = branches;
      this.branch = branches.includes('main') ? 'main' : branches[0];
      this.panel.querySelector('#editor-token').value = '';
      await this.loadBranch(this.branch);
    } finally {
      this.busy = false;
    }
  }

  async loadBranch(branch) {
    if (!this.client || !branch) return;
    if (editedFiles(this.draft).length &&
        !window.confirm('Hay cambios locales. ¿Descartarlos y cargar los CSV de ' + branch + '?')) {
      this.render();
      return;
    }
    this.busy = true;
    this.message('Cargando los CSV de ' + branch + '…');
    try {
      const data = await this.client.readCsv(branch, BALANCE_FILES);
      const draft = createEditorDraft(data.csv, this.baseLevel.id);
      validateEditorDraft(draft);
      this.draft = draft;
      this.branch = branch;
      this.branchHead = data.head;
      this.selectedEnemy = levelEnemies(draft)[0]?.unit_id ?? null;
      this.selectedObstacle = levelObstacles(draft)[0]?.obstacle_id ?? null;
      this.message('Rama ' + branch + ' cargada. Ya puedes editar y guardar.');
      this.render();
    } finally {
      this.busy = false;
    }
  }

  async createBranch(name) {
    if (!this.client || !this.branch) throw new Error('Conecta GitHub primero.');
    if (editedFiles(this.draft).length &&
        !window.confirm('Al crear la rama se cargarán sus CSV. ¿Descartar los cambios locales?')) {
      return;
    }
    this.busy = true;
    this.message('Creando rama ' + name + '…');
    try {
      await this.client.createBranch(this.branch, name);
      this.branches = await this.client.branches();
      if (!this.branches.includes(name)) this.branches.push(name);
      // loadBranch checks dirty state; discarded changes were already confirmed above.
      this.draft.touched.clear();
      await this.loadBranch(name);
      this.message('Nueva rama creada: ' + name);
    } finally {
      this.busy = false;
    }
  }

  async save() {
    if (!this.client || !this.branchHead) throw new Error('Selecciona una rama de GitHub.');
    validateEditorDraft(this.draft);
    const files = editedFiles(this.draft);
    if (!files.length) throw new Error('No hay cambios pendientes.');
    const branch = this.branch;
    this.busy = true;
    this.message('Guardando ' + files.length + ' CSV en ' + branch + '…');
    try {
      const result = await this.client.commitCsv(
        branch, this.branchHead, files,
        'balance: edit ' + this.baseLevel.id + ' from in-game editor'
      );
      const csv = editorCsv(this.draft);
      this.draft.original = csv;
      this.draft.touched.clear();
      this.branchHead = result.head;
      this.render();
      this.message('Guardado en ' + branch + '. Commit: ' + result.head.slice(0, 8) +
        '. ' + result.url);
    } finally {
      this.busy = false;
    }
  }
}

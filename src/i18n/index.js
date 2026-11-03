// El CSV es la fuente de verdad de todos los textos localizados.
const STORAGE_LANGUAGE = 'turn-over:language';
const STORAGE_GENDER = 'turn-over:player-gender';
const LANGUAGES = ['es', 'en'];
const GENDERS = ['masculine', 'feminine', 'neutral'];
const catalog = new Map();
const listeners = new Set();

function stored(key, accepted, fallback) {
  try {
    const value = localStorage.getItem(key);
    return accepted.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

let language = stored(STORAGE_LANGUAGE, LANGUAGES, 'es');
let gender = stored(STORAGE_GENDER, GENDERS, 'neutral');

export function parseCSV(source) {
  const records = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const text = source.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell);
      if (row.some(value => value !== '')) records.push(row);
      row = []; cell = '';
    } else cell += c;
  }
  if (quoted) throw new Error('Unclosed quoted CSV field');
  if (row.length || cell) { row.push(cell); records.push(row); }
  return records;
}

export async function initI18n() {
  const response = await fetch(new URL('../../locales/texts.csv', import.meta.url));
  if (!response.ok) throw new Error('Unable to load translations: ' + response.status);
  const [header, ...rows] = parseCSV(await response.text());
  if (!header || header.join(',') !== 'key,es,en,context') throw new Error('Invalid localization CSV header');
  for (const row of rows) {
    if (row.length !== header.length || !row[0]) throw new Error('Invalid translation row: ' + row[0]);
    if (catalog.has(row[0])) throw new Error('Duplicate translation key: ' + row[0]);
    catalog.set(row[0], { es: row[1], en: row[2] });
  }
  refreshStaticTranslations();
  emitChange();
}

export function getLanguage() { return language; }
export function getGender() { return gender; }

export function setLanguage(value) {
  if (!LANGUAGES.includes(value) || value === language) return;
  language = value;
  try { localStorage.setItem(STORAGE_LANGUAGE, language); } catch {}
  refreshStaticTranslations();
  emitChange();
}

export function setGender(value) {
  if (!GENDERS.includes(value) || value === gender) return;
  gender = value;
  try { localStorage.setItem(STORAGE_GENDER, gender); } catch {}
  emitChange();
}

export function onLocaleChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function emitChange() {
  for (const listener of listeners) listener();
  window.dispatchEvent(new CustomEvent('game:locale-change', { detail: { language, gender } }));
}

export function t(key, params = {}) {
  let text = catalog.get(key)?.[language] || catalog.get(key)?.es || key;
  text = text.replace(/\{([a-zA-Z_]+)\}/g, (match, name) => {
    return Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match;
  });
  return text;
}

export function playerText(baseKey, params = {}) {
  return t(baseKey + '.' + gender, params);
}

export function pieceName(unit) {
  if (unit?.i18nNameKey) return t(unit.i18nNameKey, unit.i18nNameParams ?? {});
  const type = unit?.pieceType;
  const base = catalog.has('ui.unit.' + type) ? t('ui.unit.' + type) : unit?.name ?? '';
  return base + (unit?.name?.endsWith('+') ? '+' : '');
}

export function factionName(factionId) {
  const key = 'ui.faction.' + factionId;
  return catalog.has(key) ? t(key) : factionId;
}

export function refreshStaticTranslations(root = document) {
  document.documentElement.lang = language;
  root.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = t(node.dataset.i18n); });
  root.querySelectorAll('[data-i18n-aria]').forEach(node => { node.setAttribute('aria-label', t(node.dataset.i18nAria)); });
  root.querySelectorAll('[data-i18n-title]').forEach(node => { node.title = t(node.dataset.i18nTitle); });
  root.querySelectorAll('[data-i18n-html]').forEach(node => { node.innerHTML = t(node.dataset.i18nHtml); });
  root.querySelectorAll('[data-i18n-language]').forEach(node => { node.value = language; });
  root.querySelectorAll('[data-i18n-gender]').forEach(node => { node.value = gender; });
}

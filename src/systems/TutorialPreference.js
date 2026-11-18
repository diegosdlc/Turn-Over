import { GAME_CONFIG } from '../config/gameConfig.js';

const STORAGE_KEY = GAME_CONFIG.tutorialStoragePrefix + 'enabled';

// First-time players see tutorials unless they explicitly turn them off.
export function loadTutorialPreference(storage) {
  try {
    return (storage ?? globalThis.localStorage)?.getItem(STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

export function saveTutorialPreference(enabled, storage) {
  const value = Boolean(enabled);
  try {
    (storage ?? globalThis.localStorage)?.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    // Storage can be blocked; the selection still applies to this session.
  }
  return value;
}

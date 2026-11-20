// Save and load: one localStorage record with missions, cash, position and
// settings. Everything the player earned survives a reload.

import { CFG } from './config.js';

export function loadSave() {
  try {
    const raw = localStorage.getItem(CFG.saveKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    const data = {
      version: 1,
      cash: state.cash,
      missionsDone: state.missionsDone,
      currentMission: state.currentMission,
      hasPistol: state.hasPistol,
      weapons: state.weapons || [],
      armor: state.armor || 0,
      playerPos: state.playerPos,
      muted: state.muted,
      savedAt: Date.now(),
    };
    localStorage.setItem(CFG.saveKey, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(CFG.saveKey); } catch { /* no storage */ }
}

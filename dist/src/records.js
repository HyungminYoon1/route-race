import {ACHIEVEMENT_TOTAL, validateWitness} from "./achievements.js";
import {reportProgress, clearProgress} from "./progress.js";

export const RECORD_KEY = "route-race-achievement-v1";
const MAX_RECORD = 8192;
export function readAchievement(storage) {
  try {
    const raw = storage.getItem(RECORD_KEY);
    if (typeof raw !== "string" || raw.length > MAX_RECORD) return null;
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value) || value.version !== 1 ||
      Object.keys(value).length !== 2 || !Object.hasOwn(value, "build")) return null;
    return validateWitness(value.build);
  } catch {return null;}
}
export function saveAchievement(storage, witness, updatedAt) {
  try {
    validateWitness(witness);
    const raw = JSON.stringify({version: 1, build: witness});
    if (raw.length > MAX_RECORD) return {saved: false, summary: false};
    storage.setItem(RECORD_KEY, raw);
    return {saved: true, summary: reportProgress(storage, 1, ACHIEVEMENT_TOTAL, updatedAt)};
  } catch {return {saved: false, summary: false};}
}
export function syncAchievement(storage, updatedAt) {
  const witness = readAchievement(storage);
  // An initial view never writes a zero record. Remove only a stale own badge.
  return {witness, summary: witness ? reportProgress(storage, 1, ACHIEVEMENT_TOTAL, updatedAt) : clearProgress(storage)};
}
export function eraseAchievement(storage) {
  try {
    storage.removeItem(RECORD_KEY);
    return {erased: true, summary: clearProgress(storage)};
  } catch {return {erased: false, summary: false};}
}

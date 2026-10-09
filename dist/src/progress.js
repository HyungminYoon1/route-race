export const PROGRESS_KEY = "web-lab-progress-v1";
export const APP_IDS = Object.freeze([
  "data-mirage", "echo-vault", "light-route", "logic-foundry", "neon-tactics",
  "orbit-courier", "packet-journey", "parcel-panic", "pixel-kitchen", "pocket-city",
  "route-race", "sense-lab", "swarm-garden", "think-forge", "traffic-lab"
]);
const MAX_SUMMARY = 8192;
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const keys = (value, expected) => object(value) && Object.keys(value).length === expected.length && expected.every(k => Object.hasOwn(value, k));
const iso = value => typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
function validRecord(record) {
  return keys(record, ["completed", "total", "updatedAt"]) && Number.isInteger(record.completed) && Number.isInteger(record.total) &&
    record.completed >= 0 && record.completed <= record.total && record.total <= 1000 && iso(record.updatedAt);
}
function read(storage) {
  const raw = storage.getItem(PROGRESS_KEY);
  if (raw === null) return {version: 1, apps: {}};
  if (typeof raw !== "string" || raw.length > MAX_SUMMARY) throw new TypeError("Invalid progress size");
  const value = JSON.parse(raw);
  if (!keys(value, ["version", "apps"]) || value.version !== 1 || !object(value.apps) || Object.keys(value.apps).length > 15 ||
    Object.entries(value.apps).some(([id, record]) => !APP_IDS.includes(id) || !validRecord(record))) throw new TypeError("Invalid progress");
  return value;
}
export function reportProgress(storage, completed, total, updatedAt) {
  try {
    const record = {completed, total, updatedAt};
    if (!validRecord(record)) return false;
    const value = read(storage);
    const previous = value.apps["route-race"];
    if (previous?.completed === completed && previous?.total === total) return true;
    value.apps["route-race"] = record;
    const raw = JSON.stringify(value);
    if (raw.length > MAX_SUMMARY) return false;
    storage.setItem(PROGRESS_KEY, raw);
    return true;
  } catch {return false;}
}
export function clearProgress(storage) {
  try {
    const value = read(storage);
    if (!Object.hasOwn(value.apps, "route-race")) return true;
    delete value.apps["route-race"];
    storage.setItem(PROGRESS_KEY, JSON.stringify(value));
    return true;
  } catch {return false;}
}

import test from "node:test";
import assert from "node:assert/strict";
import {defaultBoard, paint, neighbors, exportMap} from "../dist/src/model.js";
import {buildWitness, independentWitness, validateWitness} from "../dist/src/achievements.js";
import {PROGRESS_KEY, APP_IDS, reportProgress, clearProgress} from "../dist/src/progress.js";
import {RECORD_KEY, saveAchievement, readAchievement, syncAchievement, eraseAchievement} from "../dist/src/records.js";

const time = "2026-10-09T08:12:34.567Z";
function memory() {
  const data = new Map(), writes = [];
  return {data, writes, getItem: key => data.get(key) ?? null,
    setItem(key, value) {data.set(key, value); writes.push(key);}, removeItem(key) {data.delete(key); writes.push(key);}};
}
function legalBoard() {
  let board = defaultBoard(); board.cells.fill(1);
  for (const x of [4, 5, 6]) board = paint(board, x, 5, "weight");
  return board;
}
const context = {source: "build", hintUsed: false, independent: true};

test("legal three-cell design earns a verified witness; no visited/import/example/hint credit", () => {
  const board = legalBoard(), witness = independentWitness(board, context);
  assert.ok(witness); assert.equal(validateWitness(witness), witness);
  for (const source of ["challenge", "sample", "import", undefined]) assert.equal(independentWitness(board, {...context, source}), null);
  assert.equal(independentWitness(board, {...context, hintUsed: true}), null);
  assert.equal(independentWitness(board, {...context, independent: false}), null);
  const blank = defaultBoard(); blank.cells.fill(1);
  assert.equal(buildWitness(blank), null); assert.equal(buildWitness(defaultBoard()), null);
  const moved = {...board, end: board.end - 1}; assert.equal(buildWitness(moved), null);
  const blocked = structuredClone(board); for (const i of neighbors(blocked, blocked.end)) blocked.cells[i] = -1;
  assert.equal(buildWitness(blocked), null);
  const oversized = structuredClone(board); for (let i = 0; i < 9; i++) oversized.cells[i] = -1;
  assert.equal(buildWitness(oversized), null);
  const shortcut = structuredClone(board); shortcut.cells[104] = 99; assert.equal(buildWitness(shortcut), null);
  assert.equal(buildWitness({width: 2, height: 2, cells: [1, 5, 1, 1], start: 0, end: 3}), null);
  assert.throws(() => validateWitness(exportMap(blank)));
  assert.throws(() => validateWitness(exportMap(board, 99, 4)));
});
test("initial view writes nothing; own aggregate is derived from durable revalidated achievement", () => {
  const storage = memory(); assert.deepEqual(syncAchievement(storage, time), {witness: null, summary: true});
  assert.equal(storage.writes.length, 0);
  const witness = buildWitness(legalBoard());
  assert.deepEqual(saveAchievement(storage, witness, time), {saved: true, summary: true});
  assert.equal(readAchievement(storage), witness);
  const aggregate = JSON.parse(storage.getItem(PROGRESS_KEY));
  assert.deepEqual(aggregate, {version: 1, apps: {"route-race": {completed: 1, total: 1, updatedAt: time}}});
  const before = storage.writes.length;
  assert.equal(syncAchievement(storage, "2026-10-10T09:00:00.000Z").witness, witness);
  assert.equal(storage.writes.length, before); // No invented refresh timestamp.
  assert.ok(!/tiles|seed|actions|name|build/.test(storage.getItem(PROGRESS_KEY)));
});
test("clearing owns only route-race witness and aggregate, retaining all 14 peers and unrelated data", () => {
  const storage = memory(), peer = {completed: 2, total: 7, updatedAt: time};
  const apps = Object.fromEntries(APP_IDS.filter(id => id !== "route-race").map(id => [id, {...peer}]));
  storage.setItem(PROGRESS_KEY, JSON.stringify({version: 1, apps})); storage.setItem("other-private-key", "untouched");
  saveAchievement(storage, buildWitness(legalBoard()), time);
  assert.equal(Object.keys(JSON.parse(storage.getItem(PROGRESS_KEY)).apps).length, 15);
  assert.deepEqual(eraseAchievement(storage), {erased: true, summary: true});
  assert.equal(readAchievement(storage), null);
  assert.deepEqual(JSON.parse(storage.getItem(PROGRESS_KEY)), {version: 1, apps});
  assert.equal(storage.getItem("other-private-key"), "untouched");
  assert.equal(APP_IDS.length, 15); assert.equal(new Set(APP_IDS).size, 15);
});
test("corrupt and unverified private records cannot create badges and stale own badges are removed", () => {
  for (const raw of ["{", "x".repeat(8193), "null", "[]", JSON.stringify({version: 1, build: exportMap(defaultBoard())}),
    JSON.stringify({version: 2, build: buildWitness(legalBoard())}),
    JSON.stringify({version: 1, build: buildWitness(legalBoard()), success: true})]) {
    const storage = memory(); reportProgress(storage, 1, 1, time); storage.setItem(RECORD_KEY, raw);
    assert.equal(readAchievement(storage), null); assert.equal(syncAchievement(storage, time).witness, null);
    assert.deepEqual(JSON.parse(storage.getItem(PROGRESS_KEY)).apps, {});
  }
});
test("invalid shared summaries are never overwritten or cleared wholesale", () => {
  const valid = {completed: 1, total: 1, updatedAt: time};
  const invalid = ["{", "x".repeat(8193), "null", "[]", JSON.stringify({version: 2, apps: {}}),
    JSON.stringify({version: 1, apps: [], extra: 1}), JSON.stringify({version: 1, apps: {unknown: valid}}),
    JSON.stringify({version: 1, apps: {"route-race": {...valid, name: "not allowed"}}})];
  for (const record of [{...valid, completed: -1}, {...valid, completed: 2}, {...valid, total: 1001}, {...valid, total: "1"},
    {...valid, completed: 0.5}, {...valid, updatedAt: "2026-02-30T08:12:34.567Z"}, {...valid, updatedAt: "yesterday"}]) {
    invalid.push(JSON.stringify({version: 1, apps: {"route-race": record}}));
  }
  invalid.push('{"version":1,"apps":{"__proto__":' + JSON.stringify(valid) + '}}');
  for (const raw of invalid) {
    const storage = memory(); storage.data.set(PROGRESS_KEY, raw);
    assert.equal(reportProgress(storage, 1, 1, time), false); assert.equal(clearProgress(storage), false);
    assert.equal(storage.getItem(PROGRESS_KEY), raw); assert.equal(storage.writes.length, 0);
  }
});
test("quota, denied storage and malformed writes fail without fabricated durable success", () => {
  const witness = buildWitness(legalBoard());
  const blocked = {getItem() {throw new Error("denied");}, setItem() {throw new Error("quota");}, removeItem() {throw new Error("denied");}};
  for (const storage of [blocked, null]) {
    assert.deepEqual(saveAchievement(storage, witness, time), {saved: false, summary: false});
    assert.deepEqual(syncAchievement(storage, time), {witness: null, summary: false});
    assert.deepEqual(eraseAchievement(storage), {erased: false, summary: false});
  }
  const storage = memory();
  for (const [completed, total, stamp] of [[1, 0, time], [-1, 1, time], [1, 1001, time], [1.5, 2, time], [1, 1, "wrong"]]) {
    assert.equal(reportProgress(storage, completed, total, stamp), false);
  }
  assert.equal(storage.writes.length, 0);
  assert.deepEqual(saveAchievement(storage, exportMap(defaultBoard()), time), {saved: false, summary: false});
  // A valid private write may survive an aggregate failure; report the two states separately.
  storage.data.set(PROGRESS_KEY, "{");
  assert.deepEqual(saveAchievement(storage, witness, time), {saved: true, summary: false});
  assert.equal(readAchievement(storage), witness); assert.equal(storage.getItem(PROGRESS_KEY), "{");
});

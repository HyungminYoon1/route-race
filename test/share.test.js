import test from "node:test";
import assert from "node:assert/strict";
import {ALGORITHMS, defaultBoard, challengeBoard, paint, solve, exportMap, importMap, MAX_MAP_CODE} from "../dist/src/model.js";

const encode = value => "RRM1-" + JSON.stringify(value);
const payload = () => JSON.parse(exportMap(defaultBoard()).slice(5));

test("full edited map, mixed custom costs, endpoints and all factors round-trip exact traces", () => {
  let board = challengeBoard("maze", 2026);
  board = paint(board, 2, 2, "weight", 99);
  board = paint(board, 3, 2, "weight", 7);
  board = paint(board, 2, 1, "start");
  board = paint(board, 16, 9, "end");
  const before = structuredClone(board);
  for (const weight of [1, 1.5, 2, 3, 4]) {
    const code = exportMap(board, 7, weight), imported = importMap(code);
    assert.deepEqual(imported, {board, terrainCost: 7, weight});
    for (const a of ALGORITHMS) assert.deepEqual(solve(imported.board, a, {weight: imported.weight}), solve(board, a, {weight}));
    imported.board.cells[0] = 1;
    assert.deepEqual(board, before);
    assert.equal(exportMap(board, 7, weight), code);
  }
});
test("minimum/maximum grids, unreachable and coincident weighted endpoints remain valid", () => {
  for (const [width, height] of [[2, 2], [30, 20]]) {
    const board = {width, height, cells: Array(width * height).fill(99), start: 0, end: width * height - 1};
    let code = exportMap(board, 99, 4);
    assert.ok(code.length <= MAX_MAP_CODE); assert.deepEqual(importMap(code).board, board);
    board.cells[1] = board.cells[width] = -1;
    code = exportMap(board); assert.equal(solve(importMap(code).board, "astar").found, false);
    board.end = board.start;
    assert.equal(solve(importMap(exportMap(board)).board, "astar").cost, 0);
  }
});
test("import rejects exact field, size, type, tile count, endpoint and cost boundary violations", () => {
  const valid = payload();
  const wrong = [null, [], {}, {...valid, version: 2}, {...valid, version: "1"}, {...valid, extra: 1}, {...valid, board: {}},
    {...valid, width: 1}, {...valid, width: 31}, {...valid, width: "20"}, {...valid, width: 2.5},
    {...valid, height: 1}, {...valid, height: 21}, {...valid, height: false}, {...valid, tiles: {}},
    {...valid, tiles: valid.tiles.slice(1)}, {...valid, tiles: [...valid.tiles, 1]}];
  const missing = {...valid}; delete missing.weight; wrong.push(missing);
  for (const value of [0, -2, 100, 1.5, "5", null, {}, [], true]) {
    const tiles = [...valid.tiles]; tiles[3] = value; wrong.push({...valid, tiles});
  }
  for (const key of ["start", "end"]) for (const value of [-1, 240, 2.5, "101", null, true]) wrong.push({...valid, [key]: value});
  const wall = {...valid, tiles: [...valid.tiles]}; wall.tiles[valid.start] = -1; wrong.push(wall);
  for (const value of [1, 100, 2.5, "5", null, true]) wrong.push({...valid, terrainCost: value});
  for (const value of [0, 5, 1.2, "2", null, true]) wrong.push({...valid, weight: value});
  wrong.push({...valid, __proto__: null, constructor: "bad"});
  for (const value of wrong) assert.throws(() => importMap(encode(value)), JSON.stringify(value)?.slice(0, 120));
  for (const code of [null, 42, "", "RR1-maze-2026", "RRM2-{}", "RRM1-{", "RRM1-{}\n", "RRM1-한글", "RRM1-" + " ".repeat(MAX_MAP_CODE)]) assert.throws(() => importMap(code));
});
test("export rejects sparse/typed tiles, unexpected board fields and invalid settings", () => {
  const board = defaultBoard();
  for (const invalid of [{...board, cells: Array(240)}, {...board, cells: new Uint8Array(240)}, {...board, seed: 9}]) assert.throws(() => exportMap(invalid));
  for (const cost of [0, 1, 100, 2.5, undefined, null, "5"]) {
    if (cost !== undefined) assert.throws(() => exportMap(board, cost));
  }
  for (const weight of [0, 5, null, "2"]) assert.throws(() => exportMap(board, 5, weight));
  const code = exportMap(board); assert.throws(() => importMap(code.replace('"version":1', '"version":1,"actions":[]')));
});
test("custom brush costs are immutable, integer bounded and do not repaint older cells", () => {
  const board = defaultBoard(), next = paint(board, 2, 2, "weight", 99);
  assert.equal(next.cells[42], 99); assert.equal(board.cells[42], 1);
  const mixed = paint(next, 3, 2, "weight", 2);
  assert.equal(mixed.cells[42], 99); assert.equal(mixed.cells[43], 2);
  assert.equal(paint(mixed, 1, 5, "weight", 99).cells[board.start], 1);
  for (const cost of [0, 1, 100, 1.5, "5", NaN, null]) assert.throws(() => paint(board, 2, 2, "weight", cost));
});

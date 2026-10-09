import test from "node:test";
import assert from "node:assert/strict";
import {ALGORITHMS, CHALLENGES, defaultBoard, randomBoard, solve, paint, validate, challengeBoard, challengeCode, parseChallengeCode, predictionFact, evaluateBuild} from "../dist/src/model.js";

// Independent Bellman-Ford oracle: no production solver, neighbor function,
// PRNG or path reconstruction is reused.
function adjacent(b, i) {
  const out = [];
  for (let j = 0; j < b.cells.length; j++) if (b.cells[j] !== -1 &&
    Math.abs(i % b.width - j % b.width) + Math.abs(Math.floor(i / b.width) - Math.floor(j / b.width)) === 1) out.push(j);
  return out;
}
function oracle(b, unit = false) {
  const edges = [];
  for (let i = 0; i < b.cells.length; i++) if (b.cells[i] !== -1) for (const j of adjacent(b, i)) edges.push([i, j, unit ? 1 : b.cells[j]]);
  const distance = Array(b.cells.length).fill(Infinity); distance[b.start] = 0;
  for (let pass = 1; pass < b.cells.length; pass++) {
    let changed = false;
    for (const [i, j, cost] of edges) if (distance[i] + cost < distance[j]) {distance[j] = distance[i] + cost; changed = true;}
    if (!changed) break;
  }
  return Number.isFinite(distance[b.end]) ? distance[b.end] : null;
}
function validPath(b, r) {
  assert.equal(new Set(r.visited).size, r.visited.length);
  assert.ok(r.visited.length <= b.cells.length);
  assert.equal(r.trace.length, r.visited.length);
  if (!r.found) {assert.deepEqual(r.path, []); assert.equal(r.steps, null); assert.equal(r.cost, null); return;}
  assert.equal(r.path[0], b.start); assert.equal(r.path.at(-1), b.end);
  assert.equal(new Set(r.path).size, r.path.length);
  assert.equal(r.steps, r.path.length - 1);
  assert.equal(r.cost, r.path.slice(1).reduce((sum, i) => sum + b.cells[i], 0));
  for (let n = 1; n < r.path.length; n++) assert.ok(adjacent(b, r.path[n - 1]).includes(r.path[n]));
}
function compare(b) {
  const cost = oracle(b), steps = oracle(b, true), copy = structuredClone(b);
  const results = ALGORITHMS.map(a => solve(b, a, {weight: 2}));
  for (const r of results) validPath(b, r);
  assert.equal(results[0].steps, steps);
  assert.equal(results[1].cost, cost); assert.equal(results[2].cost, cost);
  for (const weight of [1, 1.5, 3, 4]) {
    const r = solve(b, "weighted", {weight}); validPath(b, r);
    assert.equal(r.found, cost !== null);
    if (cost !== null) assert.ok(r.cost >= cost);
    if (weight === 1) {assert.equal(r.cost, cost); assert.deepEqual(r.path, results[2].path); assert.deepEqual(r.visited, results[2].visited);}
    assert.equal(r.guarantee, weight === 1 ? "cost" : "none");
  }
  assert.deepEqual(b, copy);
  return results;
}
test("orthodox BFS shortest steps vs Dijkstra/A* cheapest entry cost", () => {
  const r = compare(defaultBoard());
  assert.equal(r[0].steps, 17); assert.equal(r[0].cost, 65);
  assert.equal(r[1].cost, 19); assert.equal(r[2].cost, 19);
});
test("600 seeded challenge maps are reachable, varied, reproducible, oracle-correct", () => {
  let counterexamples = 0;
  for (const {id} of CHALLENGES) {
    const distinct = new Set();
    for (let seed = 0; seed < 120; seed++) {
      const b = challengeBoard(id, seed);
      assert.deepEqual(b, challengeBoard(id, seed));
      distinct.add(JSON.stringify(b));
      const r = compare(b);
      assert.ok(r.every(result => result.found), `${id}:${seed}`);
      if (solve(b, "weighted", {weight: 4}).cost > r[2].cost) counterexamples++;
      const code = challengeCode(id, seed);
      assert.deepEqual(parseChallengeCode(code), {id, seed});
    }
    assert.ok(distinct.size >= (id === "lure" ? 75 : 100), `${id} variety ${distinct.size}`);
  }
  assert.ok(counterexamples > 0, "weighted optimality counterexamples must exist");
  for (const id of CHALLENGES.map(c => c.id)) compare(challengeBoard(id, 0xffffffff));
});
test("180 independently generated boards include unreachable and varied dimensions", () => {
  let state = 0x12345678, unreachable = 0;
  const random = () => {state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296;};
  for (let seed = 0; seed < 180; seed++) {
    const width = 2 + Math.floor(random() * 13), height = 2 + Math.floor(random() * 10);
    const b = {width, height, cells: Array.from({length: width * height}, () => random() < .32 ? -1 : random() < .35 ? 5 : 1), start: 0, end: width * height - 1};
    b.cells[b.start] = 5; b.cells[b.end] = 1;
    const results = compare(b); if (!results[0].found) unreachable++;
  }
  assert.ok(unreachable > 10);
});
test("trace snapshots match queue choice, priorities and legitimate relaxations", () => {
  for (const id of CHALLENGES.map(c => c.id)) for (const algorithm of ALGORITHMS) {
    const b = challengeBoard(id, 27), r = solve(b, algorithm, {weight: 3});
    const open = new Map([[b.start, 0]]), closed = new Set();
    const heuristic = i => Math.abs(i % b.width - b.end % b.width) + Math.abs(Math.floor(i / b.width) - Math.floor(b.end / b.width));
    const priority = (i, g) => g + (algorithm === "astar" ? heuristic(i) : algorithm === "weighted" ? 3 * heuristic(i) : 0);
    for (const t of r.trace) {
      const order = [...open.keys()];
      if (algorithm !== "bfs") order.sort((a, c) => priority(a, open.get(a)) - priority(c, open.get(c)));
      assert.equal(t.current, order[0]); assert.equal(t.g, open.get(t.current));
      assert.equal(t.h, heuristic(t.current)); assert.equal(t.priority, priority(t.current, t.g));
      open.delete(t.current); closed.add(t.current);
      for (const u of t.updates) {
        assert.ok(adjacent(b, t.current).includes(u.index)); assert.ok(!closed.has(u.index));
        assert.equal(u.oldG, open.get(u.index) ?? null);
        assert.equal(u.g, t.g + (algorithm === "bfs" ? 1 : b.cells[u.index]));
        assert.ok(u.oldG === null || u.g < u.oldG);
        assert.equal(u.priority, priority(u.index, u.g)); open.set(u.index, u.g);
      }
      const after = [...open.keys()];
      if (algorithm !== "bfs") after.sort((a, c) => priority(a, open.get(a)) - priority(c, open.get(c)));
      assert.deepEqual(t.frontier, after);
      assert.deepEqual(t.candidates.map(c => c.index), after.slice(0, 5));
      assert.equal(new Set(t.frontier).size, t.frontier.length);
      for (const candidate of t.candidates) assert.equal(candidate.g, open.get(candidate.index));
    }
  }
});
test("no solution, identical endpoints, all weighted cells, and maximum bound", () => {
  const b = defaultBoard();
  for (const i of adjacent(b, b.end)) b.cells[i] = -1;
  compare(b);
  const same = defaultBoard(); same.end = same.start; same.cells[same.start] = 5;
  const r = compare(same); for (const result of r) {assert.equal(result.cost, 0); assert.equal(result.steps, 0); assert.equal(result.visited.length, 1);}
  const maximum = {width: 30, height: 20, cells: Array(600).fill(5), start: 0, end: 599};
  compare(maximum);
  for (const algorithm of ALGORITHMS) {const result = solve(maximum, algorithm); assert.ok(result.trace.reduce((n, t) => n + t.frontier.length, 0) <= 600 * 600);}
});
test("strict invalid inputs reject holes, malformed endpoints, codes and options", () => {
  const b = defaultBoard();
  for (const cells of [Array(240), b.cells.map((v, i) => i === 3 ? NaN : v), [1], new Uint8Array(240)]) assert.throws(() => validate({...b, cells}));
  for (const width of [0, 1, 31, 2.5, "20", Infinity]) assert.throws(() => validate({...b, width}));
  for (const height of [0, 1, 21, null]) assert.throws(() => validate({...b, height}));
  for (const start of [-1, 240, 1.2, undefined, "1"]) assert.throws(() => validate({...b, start}));
  const wall = structuredClone(b); wall.cells[wall.end] = -1; assert.throws(() => validate(wall));
  assert.throws(() => solve(b, "greedy"));
  for (const options of [null, [], {extra: 1}, {weight: null}, {weight: undefined}, {weight: 0}, {weight: 5}, {weight: NaN}, {weight: "2"}, {weight: 1.2}]) assert.throws(() => solve(b, "weighted", options));
  for (const seed of [-1, 4294967296, NaN, 1.5, "1", undefined, null]) {assert.throws(() => challengeBoard("maze", seed)); assert.throws(() => challengeCode("maze", seed));}
  assert.throws(() => challengeBoard("other", 1));
  for (const code of ["", "RR2-maze-1", "RR1-maze-01", "RR1-maze--1", "RR1-maze-4294967296", "RR1-maze-1x", "RR1-other-1", "<img>", null]) assert.throws(() => parseChallengeCode(code));
  assert.deepEqual(parseChallengeCode("RR1-mixed-0"), {id: "mixed", seed: 0});
  assert.deepEqual(randomBoard(8), challengeBoard("mixed", 8));
});
test("immutable painting, endpoint protection and bounded actions", () => {
  const b = defaultBoard(), copy = structuredClone(b);
  assert.equal(paint(b, 2, 3, "wall").cells[62], -1); assert.deepEqual(b, copy);
  assert.equal(paint(b, 1, 5, "wall").cells[b.start], 1);
  assert.equal(paint(b, 18, 5, "weight").cells[b.end], 1);
  for (const [x, y, mode] of [[20, 1, "wall"], [-1, 0, "wall"], [1, 12, "wall"], [1.1, 1, "wall"], [NaN, 1, "wall"], [1, 1, undefined], [1, 1, "missing"]]) assert.throws(() => paint(b, x, y, mode));
  assert.equal(paint(b, 10, 1, "start").cells[30], 1);
});
test("predictions are actual comparisons, never fixed answers", () => {
  for (const {id} of CHALLENGES) {
    const b = challengeBoard(id, 14), r = ALGORITHMS.map(a => solve(b, a, {weight: 4}));
    const expected = id === "trap" ? r[0].cost > r[1].cost : ["maze", "bottleneck"].includes(id) ? r[2].visited.length < r[1].visited.length : r[3].cost > r[2].cost;
    assert.equal(predictionFact(id, r).answer, expected ? "yes" : "no");
    assert.ok(predictionFact(id, r).evidence.length > 30);
    r[0].found = false; assert.equal(predictionFact(id, r), null);
  }
});
test("build mission requires a real cost gap, fixed endpoints and edit budget", () => {
  const baseline = defaultBoard(); baseline.cells.fill(1);
  const b = structuredClone(baseline);
  for (let x = 4; x < 7; x++) b.cells[5 * b.width + x] = 5;
  const results = board => ALGORITHMS.map(a => solve(board, a));
  assert.equal(evaluateBuild(b, baseline, results(b)).success, true);
  assert.equal(evaluateBuild(baseline, baseline, results(baseline)).success, false);
  const moved = {...b, end: b.end - 1}; assert.equal(evaluateBuild(moved, baseline, results(moved)).success, false);
  const oversized = structuredClone(b); for (let x = 0; x < 9; x++) oversized.cells[x] = -1;
  assert.equal(evaluateBuild(oversized, baseline, results(oversized)).success, false);
  const blocked = structuredClone(b); for (const i of adjacent(blocked, blocked.end)) blocked.cells[i] = -1;
  assert.equal(evaluateBuild(blocked, baseline, results(blocked)).success, false);
});

test("custom integer entry costs preserve optimality against the independent oracle", () => {
  let state = 37;
  const next = () => {state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state;};
  for (let n = 0; n < 60; n++) {
    const width = 2 + next() % 9, height = 2 + next() % 7;
    const board = {width, height, cells: Array.from({length: width * height}, () => next() % 7 === 0 ? -1 : 1 + next() % 99), start: 0, end: width * height - 1};
    board.cells[0] = 99; board.cells[board.end] = 1;
    compare(board);
  }
});

export const WIDTH = 20, HEIGHT = 12;
export const MAX_CELL_COST = 99;
export const HEURISTIC_WEIGHTS = [1, 1.5, 2, 3, 4];
export const MAX_MAP_CODE = 8192;
export const ALGORITHMS = ["bfs", "dijkstra", "astar", "weighted"];
export const CHALLENGES = [
  {id: "trap", title: "싼 우회로", question: "BFS의 짧은 길은 Dijkstra의 길보다 비쌀까요?", hint: "험지 한 칸을 평지 다섯 칸과 바꾸어 생각하세요. 우회로의 추가 이동과 험지의 추가 비용을 비교하세요."},
  {id: "maze", title: "막다른 미로", question: "A*가 Dijkstra보다 적은 칸을 확장할까요?", hint: "맨해튼 거리는 벽을 보지 못합니다. 도착점을 향한 막다른 가지에서도 낮은 추정값이 나올 수 있습니다."},
  {id: "bottleneck", title: "엇갈린 관문", question: "A*가 Dijkstra보다 적은 칸을 확장할까요?", hint: "세 벽의 통과 구멍을 찾으세요. 도착점까지 직선으로 가까워져도 관문을 돌아가야 합니다."},
  {id: "lure", title: "거리의 유혹", question: "Weighted A*가 A*보다 비싼 길을 선택할까요?", hint: "w를 키우면 남은 거리가 더 큰 영향력을 갖습니다. 가까운 험지와 먼 평지 중 어디를 먼저 확장하는지 관찰하세요."},
  {id: "mixed", title: "구조된 황야", question: "Weighted A*가 A*보다 비싼 길을 선택할까요?", hint: "평지 통로가 하나 확보되어 있지만 지름길에는 험지와 벽이 섞여 있습니다. 결과가 같다면 다른 시드나 w로 반례를 찾아보세요."}
];

// Deterministic seeded randomness belongs to calculation, never to the DOM.
export function rng(seed = 1) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError("Invalid seed");
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ state >>> 15, state | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function defaultBoard() {
  const cells = Array(WIDTH * HEIGHT).fill(1);
  for (let x = 4; x <= 15; x++) cells[5 * WIDTH + x] = 5;
  for (const y of [1, 2, 3, 8, 9, 10]) cells[y * WIDTH + 10] = -1;
  return {width: WIDTH, height: HEIGHT, cells, start: 5 * WIDTH + 1, end: 5 * WIDTH + 18};
}

export function validate(board) {
  if (!board || !Number.isInteger(board.width) || !Number.isInteger(board.height) ||
      board.width < 2 || board.height < 2 || board.width > 30 || board.height > 20 ||
      !Array.isArray(board.cells) || board.cells.length !== board.width * board.height) throw new TypeError("Invalid board");
  // Indexed checks reject sparse arrays as well as invalid values.
  for (let i = 0; i < board.cells.length; i++) if (!Number.isInteger(board.cells[i]) ||
    (board.cells[i] !== -1 && (board.cells[i] < 1 || board.cells[i] > MAX_CELL_COST))) throw new TypeError("Invalid cell");
  for (const key of ["start", "end"]) if (!Number.isInteger(board[key]) || board[key] < 0 ||
    board[key] >= board.cells.length || board.cells[board[key]] === -1) throw new TypeError("Invalid endpoint");
  return board;
}

export function neighbors(board, index) {
  const x = index % board.width, y = Math.floor(index / board.width), out = [];
  for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < board.width && ny < board.height && board.cells[ny * board.width + nx] !== -1) out.push(ny * board.width + nx);
  }
  return out;
}

export function solve(board, algorithm, options = {}) {
  validate(board);
  if (!ALGORITHMS.includes(algorithm)) throw new TypeError("Unknown algorithm");
  if (!options || typeof options !== "object" || Array.isArray(options) || Object.keys(options).some(k => k !== "weight")) throw new TypeError("Invalid options");
  const weight = Object.hasOwn(options, "weight") ? options.weight : 2;
  if (!HEURISTIC_WEIGHTS.includes(weight)) throw new RangeError("Invalid heuristic weight");
  const size = board.cells.length, dist = Array(size).fill(Infinity), prev = Array(size).fill(-1);
  const closed = new Set(), visited = [], trace = [], frontier = [board.start];
  const h = i => Math.abs(i % board.width - board.end % board.width) + Math.abs(Math.floor(i / board.width) - Math.floor(board.end / board.width));
  const score = i => dist[i] + (algorithm === "astar" ? h(i) : algorithm === "weighted" ? weight * h(i) : 0);
  const entry = i => ({index: i, g: dist[i], h: h(i), priority: score(i)});
  const ordered = () => algorithm === "bfs" ? frontier.slice() : frontier.slice().sort((a, b) => score(a) - score(b));
  dist[board.start] = 0;
  let peakFrontier = 1;
  while (frontier.length) {
    // Unique queue; ties retain discovery order. Each cell expands at most once.
    let at = 0;
    if (algorithm !== "bfs") for (let i = 1; i < frontier.length; i++) if (score(frontier[i]) < score(frontier[at])) at = i;
    const current = frontier.splice(at, 1)[0], selected = entry(current), updates = [];
    closed.add(current); visited.push(current);
    if (current !== board.end) for (const next of neighbors(board, current)) {
      if (closed.has(next)) continue;
      const cost = dist[current] + (algorithm === "bfs" ? 1 : board.cells[next]);
      if (cost < dist[next]) {
        const oldG = Number.isFinite(dist[next]) ? dist[next] : null;
        dist[next] = cost; prev[next] = current;
        if (!frontier.includes(next)) frontier.push(next);
        updates.push({...entry(next), oldG});
      }
    }
    const queue = ordered();
    peakFrontier = Math.max(peakFrontier, queue.length);
    trace.push({...selected, current, frontier: queue, candidates: queue.slice(0, 5).map(entry), updates});
    if (current === board.end) break;
  }
  const found = closed.has(board.end), path = [];
  if (found) for (let cur = board.end; cur !== -1; cur = prev[cur]) {path.push(cur); if (cur === board.start) break;}
  path.reverse();
  return {algorithm, weight: algorithm === "weighted" ? weight : null,
    guarantee: algorithm === "bfs" ? "steps" : algorithm !== "weighted" || weight === 1 ? "cost" : "none",
    visited, trace, peakFrontier, path, found, steps: found ? path.length - 1 : null,
    cost: found ? path.slice(1).reduce((sum, i) => sum + board.cells[i], 0) : null};
}

export function paint(board, x, y, mode, terrainCost = 5) {
  validate(board);
  if (!Number.isInteger(terrainCost) || terrainCost < 2 || terrainCost > MAX_CELL_COST) throw new RangeError("Invalid terrain cost");
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= board.width || y >= board.height ||
      !["wall", "weight", "erase", "start", "end"].includes(mode)) throw new TypeError("Invalid paint action");
  const index = y * board.width + x, next = structuredClone(board);
  if (mode === "start" || mode === "end") {next[mode] = index; next.cells[index] = 1;}
  else if (index !== board.start && index !== board.end) next.cells[index] = {wall: -1, weight: terrainCost, erase: 1}[mode];
  return next;
}

export function challengeBoard(id, seed) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError("Invalid seed");
  const random = rng(seed), pick = n => Math.floor(random() * n);
  if (!CHALLENGES.some(c => c.id === id)) throw new TypeError("Unknown challenge");
  const b = {width: WIDTH, height: HEIGHT, cells: Array(WIDTH * HEIGHT).fill(-1), start: 101, end: 118};
  const set = (x, y, cost = 1) => {b.cells[y * WIDTH + x] = cost;};
  if (id === "trap" || id === "lure") {
    const row = 3 + pick(3), detour = row + 3 + pick(3), from = 3 + pick(3), to = 13 + pick(4);
    b.start = row * WIDTH + 1; b.end = row * WIDTH + 18;
    for (let x = 1; x <= 18; x++) {set(x, row, x >= from && x <= to ? 5 : 1); set(x, detour);}
    for (let y = row; y <= detour; y++) {set(1, y); set(18, y);}
    if (id === "trap") {
      for (let x = 2; x < 18; x++) if (random() < .55) {
        const stop = 1 + pick(2);
        for (let y = row - 1; y >= stop; y--) set(x, y, random() < .2 ? 5 : 1);
      }
    } else {
      // A tempting dead end points toward E but stays separated by a wall row.
      for (let y = 1; y < row; y++) set(1, y);
      for (let x = 2; x <= 16; x++) set(x, 1);
      for (let y = 2; y <= row - 2; y++) set(16, y);
    }
  } else if (id === "maze") {
    b.start = WIDTH + 1; b.end = 9 * WIDTH + 17;
    const stack = [[1, 1]]; set(1, 1);
    while (stack.length) {
      const [x, y] = stack.at(-1);
      const choices = [[2, 0], [0, 2], [-2, 0], [0, -2]].map(([dx, dy]) => [x + dx, y + dy])
        .filter(([nx, ny]) => nx > 0 && nx < 19 && ny > 0 && ny < 11 && b.cells[ny * WIDTH + nx] === -1);
      if (!choices.length) {stack.pop(); continue;}
      const [nx, ny] = choices[pick(choices.length)]; set((x + nx) / 2, (y + ny) / 2); set(nx, ny); stack.push([nx, ny]);
    }
    b.cells = b.cells.map(v => v === 1 && random() < .16 ? 5 : v);
  } else if (id === "bottleneck") {
    b.cells.fill(1);
    for (let x = 5; x <= 15; x += 5) {
      const gap = x === 10 ? 7 + pick(4) : 1 + pick(3);
      for (let y = 0; y < HEIGHT; y++) set(x, y, y === gap ? 1 : -1);
    }
    for (let i = 0; i < b.cells.length; i++) if (b.cells[i] === 1 && random() < .23) b.cells[i] = 5;
  } else {
    b.cells = b.cells.map(() => random() < .26 ? -1 : random() < .3 ? 5 : 1);
    // Carve a seed-selected monotone witness route. No retry or hidden solve.
    let x = 1, y = 5; set(x, y);
    const via = 1 + pick(10);
    while (y !== via) {y += Math.sign(via - y); set(x, y);}
    while (x < 18) {x++; set(x, y);}
    while (y !== 5) {y += Math.sign(5 - y); set(x, y);}
  }
  b.cells[b.start] = b.cells[b.end] = 1;
  // Seeded reflection changes orientation while preserving the challenge.
  const flipX = random() < .5, flipY = random() < .5;
  const transform = i => (flipY ? HEIGHT - 1 - Math.floor(i / WIDTH) : Math.floor(i / WIDTH)) * WIDTH + (flipX ? WIDTH - 1 - i % WIDTH : i % WIDTH);
  const cells = Array(b.cells.length);
  b.cells.forEach((v, i) => {cells[transform(i)] = v;});
  return validate({...b, cells, start: transform(b.start), end: transform(b.end)});
}

export function challengeCode(id, seed) {
  if (!CHALLENGES.some(c => c.id === id)) throw new TypeError("Unknown challenge");
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError("Invalid seed");
  rng(seed);
  return `RR1-${id}-${seed}`;
}
export function parseChallengeCode(code) {
  if (typeof code !== "string" || code.length > 32) throw new TypeError("Invalid replay code");
  const match = /^RR1-(trap|maze|bottleneck|lure|mixed)-(0|[1-9]\d{0,9})$/.exec(code);
  if (!match || Number(match[2]) > 0xffffffff) throw new TypeError("Invalid replay code");
  return {id: match[1], seed: Number(match[2])};
}
export function randomBoard(seed = 1) {return challengeBoard("mixed", seed);}

function exactKeys(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
    Object.keys(value).length !== keys.length || keys.some(k => !Object.hasOwn(value, k))) throw new TypeError("Invalid map fields");
}
function mapPayload(value) {
  exactKeys(value, ["version", "width", "height", "tiles", "start", "end", "terrainCost", "weight"]);
  if (value.version !== 1 || !Number.isInteger(value.terrainCost) || value.terrainCost < 2 || value.terrainCost > MAX_CELL_COST ||
    !HEURISTIC_WEIGHTS.includes(value.weight)) throw new TypeError("Invalid map settings");
  const board = validate({width: value.width, height: value.height, cells: value.tiles, start: value.start, end: value.end});
  return {board: structuredClone(board), terrainCost: value.terrainCost, weight: value.weight};
}
export function exportMap(board, terrainCost = 5, weight = 2) {
  exactKeys(board, ["width", "height", "cells", "start", "end"]);
  const payload = {version: 1, width: board.width, height: board.height, tiles: board.cells,
    start: board.start, end: board.end, terrainCost, weight};
  mapPayload(payload);
  const code = "RRM1-" + JSON.stringify(payload);
  if (code.length > MAX_MAP_CODE) throw new RangeError("Map code too large");
  return code;
}
export function importMap(code) {
  if (typeof code !== "string" || code.length > MAX_MAP_CODE || !code.startsWith("RRM1-") ||
    !/^[\x20-\x7e]+$/.test(code)) throw new TypeError("Invalid map code");
  return mapPayload(JSON.parse(code.slice(5)));
}

export function predictionFact(id, results) {
  const get = a => results.find(r => r.algorithm === a), bfs = get("bfs"), d = get("dijkstra"), a = get("astar"), w = get("weighted");
  if (!bfs || !d || !a || !w || results.some(r => !r.found)) return null;
  if (id === "trap") return {answer: bfs.cost > d.cost ? "yes" : "no", evidence: `BFS ${bfs.steps}회 / 비용 ${bfs.cost}, Dijkstra ${d.steps}회 / 비용 ${d.cost}. BFS는 이동 횟수를 최소화합니다.`};
  if (id === "maze" || id === "bottleneck") return {answer: a.visited.length < d.visited.length ? "yes" : "no", evidence: `A* ${a.visited.length}칸, Dijkstra ${d.visited.length}칸 확장. 벽을 무시하는 거리 추정과 동률 순서가 탐색 범위를 결정합니다. 항상 적어지는 것은 아닙니다.`};
  return {answer: w.cost > a.cost ? "yes" : "no", evidence: `Weighted A*(w=${w.weight}) 비용 ${w.cost} / ${w.visited.length}칸, A* 비용 ${a.cost} / ${a.visited.length}칸.`};
}

export function evaluateBuild(board, baseline, results, budget = 8) {
  validate(board); validate(baseline);
  if (board.width !== baseline.width || board.height !== baseline.height) throw new TypeError("Different board sizes");
  const changed = board.cells.reduce((n, v, i) => n + Number(v !== baseline.cells[i]), 0);
  const bfs = results.find(r => r.algorithm === "bfs"), d = results.find(r => r.algorithm === "dijkstra");
  const fixedEndpoints = board.start === baseline.start && board.end === baseline.end;
  const gap = bfs?.found && d?.found ? bfs.cost - d.cost : null;
  return {changed, budget, fixedEndpoints, gap,
    success: fixedEndpoints && changed > 0 && changed <= budget && gap !== null && gap >= 8};
}

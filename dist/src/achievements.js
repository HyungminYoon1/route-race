import {WIDTH, HEIGHT, defaultBoard, validate, solve, evaluateBuild, exportMap, importMap} from "./model.js";

export const ACHIEVEMENT_TOTAL = 1;

// The original fixed-condition build mission remains 1/5 terrain on 20x12.
// Recompute from a witness board; never accept a supplied score or success flag.
export function buildWitness(board) {
  validate(board);
  if (board.width !== WIDTH || board.height !== HEIGHT || board.cells.some(v => ![-1, 1, 5].includes(v))) return null;
  const baseline = defaultBoard(); baseline.cells.fill(1);
  const results = ["bfs", "dijkstra"].map(a => solve(board, a));
  if (!evaluateBuild(board, baseline, results).success) return null;
  return exportMap(board, 5, 2);
}
export function independentWitness(board, {source, hintUsed, independent}) {
  return source === "build" && independent === true && hintUsed === false ? buildWitness(board) : null;
}
export function validateWitness(code) {
  const {board, terrainCost, weight} = importMap(code);
  if (terrainCost !== 5 || weight !== 2 || buildWitness(board) !== code) throw new TypeError("Invalid achievement witness");
  return code;
}

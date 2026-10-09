import {ALGORITHMS, CHALLENGES, defaultBoard, challengeBoard, challengeCode, parseChallengeCode, solve, paint, predictionFact, evaluateBuild, exportMap, importMap, MAX_MAP_CODE} from "./model.js";
import {expose, tool, canvasPointer, clamp} from "./ui.js";
import {independentWitness} from "./achievements.js";
import {syncAchievement, saveAchievement, eraseAchievement} from "./records.js";

const $ = s => document.querySelector(s);
const colors = {bfs: "#3775c0", dijkstra: "#2d8652", astar: "#8959b4", weighted: "#be6436"};
const names = {bfs: "BFS", dijkstra: "Dijkstra", astar: "A*", weighted: "Weighted A*"};
let challenge = "trap", seed = 2026, board = challengeBoard(challenge, seed), baseline = structuredClone(board);
let mode = "wall", cursor = {x: board.start % board.width, y: Math.floor(board.start / board.width)};
let results = null, progress = 0, running = false, last = 0, drawing = false, lastCell = -1;
let prediction = null, lockedPrediction = null, mission = "predict", weight = 2, edited = false, history = [], source = "challenge";
let animationId = null;
let terrainCost = 5, originMap = null, hintUsed = false, independent = false, achievement = null;
let storage = null;
try {storage = window.localStorage;} catch {}
const maxSteps = () => Math.max(1, ...(results ?? []).map(r => r.visited.length));
const coord = i => `${i % board.width + 1}열 ${Math.floor(i / board.width) + 1}행`;
const changes = () => board.cells.reduce((n, v, i) => n + Number(v !== baseline.cells[i]), 0);
const status = text => {$("#status").textContent = text;};
function summary() {
  return {width: board.width, height: board.height, start: board.start, end: board.end,
    challenge, code: source === "challenge" ? challengeCode(challenge, seed) : null, edited, mission, weight, progress,
    terrainCost, wallCount: board.cells.filter(v => v === -1).length, weightedCount: board.cells.filter(v => v > 1).length,
    results: results?.map(r => ({algorithm: r.algorithm, guarantee: r.guarantee, found: r.found,
      visited: r.visited.length, cost: r.cost, steps: r.steps})) ?? null};
}
function invalidate() {
  results = null; running = false; progress = 0; prediction = null; lockedPrediction = null;
}
function emptyBoard() {
  const b = defaultBoard(); b.cells.fill(1); return b;
}
function freshSeed() {
  let value = crypto.getRandomValues(new Uint32Array(1))[0];
  if (value === seed) value = (value ^ 0x9e3779b9) >>> 0;
  return value;
}
function replace(next, text, keepHistory = false) {
  board = next; baseline = structuredClone(next); if (!keepHistory) history = []; edited = false; invalidate();
  hintUsed = $("#hint").open; independent = source === "build" && !hintUsed;
  if (source === "build") terrainCost = 5;
  cursor = {x: board.start % board.width, y: Math.floor(board.start / board.width)};
  $("#weight").value = String(weight); $("#terrainCost").value = String(terrainCost);
  $("#replayCode").value = challengeCode(challenge, seed);
  status(text); render();
}
function loadChallenge(id, nextSeed) {
  board = challengeBoard(id, nextSeed); challenge = id; seed = nextSeed; mission = "predict"; source = "challenge";
  $("#missionMode").value = mission; $("#challenge").value = id;
  replace(board, "새 도전입니다.");
}
function pushHistory() {
  history.push(structuredClone({board, baseline, source, mission, weight, terrainCost, edited, challenge, seed, originMap}));
  if (history.length > 32) history.shift();
}
function snapshot(result) {
  const n = Math.min(progress, result.visited.length);
  return n ? result.trace[n - 1] : null;
}
function draw(canvas, result) {
  if (canvas.width !== board.width * 40) canvas.width = board.width * 40;
  if (canvas.height !== board.height * 40) canvas.height = board.height * 40;
  const ctx = canvas.getContext("2d"), w = canvas.width / board.width, h = canvas.height / board.height;
  const trace = result ? snapshot(result) : null;
  const visited = new Set(result?.visited.slice(0, progress) ?? []);
  const frontier = new Set(result ? trace?.frontier ?? [board.start] : []);
  const finished = result && progress >= result.visited.length;
  const path = new Set(finished ? result.path : []);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < board.cells.length; i++) {
    const x = i % board.width * w, y = Math.floor(i / board.width) * h;
    ctx.fillStyle = board.cells[i] === -1 ? "#273a57" : board.cells[i] > 1 ? "#f2d4af" : "#f0f4fa";
    if (visited.has(i)) ctx.fillStyle = colors[result.algorithm] + "44";
    if (path.has(i)) ctx.fillStyle = colors[result.algorithm];
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    if (board.cells[i] > 1) {
      ctx.fillStyle = path.has(i) ? "#fff" : "#704213"; ctx.font = "16px system-ui"; ctx.textAlign = "center";
      ctx.fillText(String(board.cells[i]), x + w / 2, y + h * .64);
    }
    if (i === board.start || i === board.end) {
      ctx.fillStyle = i === board.start ? "#3578cd" : "#e1be5a"; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
      ctx.fillStyle = i === board.start ? "#fff" : "#263c5e"; ctx.font = "bold 22px system-ui"; ctx.textAlign = "center";
      ctx.fillText(i === board.start ? "S" : "E", x + w / 2, y + h * .69);
    }
    if (frontier.has(i)) {
      ctx.strokeStyle = colors[result.algorithm]; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
      ctx.strokeRect(x + 3, y + 3, w - 6, h - 6); ctx.setLineDash([]);
    }
    if (trace?.current === i) {
      ctx.strokeStyle = "#162b49"; ctx.lineWidth = 3; ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
      ctx.fillStyle = "#162b49"; ctx.beginPath(); ctx.arc(x + 8, y + 8, 3, 0, 2 * Math.PI); ctx.fill();
    }
  }
  if (!result) {ctx.strokeStyle = "#d77e21"; ctx.lineWidth = 3; ctx.strokeRect(cursor.x * w + 2, cursor.y * h + 2, w - 4, h - 4);}
}
function node(tag, text, className) {
  const element = document.createElement(tag); element.textContent = text;
  if (className) element.className = className; return element;
}
function renderTrace(a, r) {
  const container = $("#" + a + "Trace"); container.replaceChildren();
  if (!r) return;
  const t = snapshot(r), done = progress >= r.visited.length;
  const rule = a === "bfs" ? "선입선출 · g는 이동 횟수" : a === "dijkstra" ? "가장 작은 g · g는 누적 진입 비용" :
    a === "astar" ? "가장 작은 g + h · h는 맨해튼 거리" : `가장 작은 g + ${weight}h · g는 누적 진입 비용`;
  container.append(node("p", rule, "rule"));
  container.append(node("p", t ? `꺼낸 칸 ${coord(t.current)} · g=${t.g}, h=${t.h}${a === "bfs" ? "" : `, 우선값=${t.priority}`}` : `첫 후보 ${coord(board.start)} · 출발 g=0`));
  const q = t?.frontier ?? [board.start];
  container.append(node("p", `${done ? "종료 시 남은" : "대기 중인"} 후보 ${q.length}칸 · 누적 확장 ${Math.min(progress, r.visited.length)}칸`));
  if (t) {
    container.append(node("p", `이번 갱신: 새 후보 ${t.updates.filter(u => u.oldG === null).length}칸 / ${a === "bfs" ? "더 짧은" : "더 싼"} 경로 ${t.updates.filter(u => u.oldG !== null).length}칸`));
    if (t.updates.length) container.append(node("p", t.updates.map(u => `${coord(u.index)}: g ${u.oldG ?? "미발견"} → ${u.g}`).join(" · ")));
  }
  const candidates = t?.candidates ?? [{index: board.start, g: 0, h: Math.abs(board.start % board.width - board.end % board.width) + Math.abs(Math.floor(board.start / board.width) - Math.floor(board.end / board.width))}];
  if (candidates.length) {
    const table = document.createElement("table"), caption = node("caption", done ? "종료 시 남은 후보 상위 5개 (이후 탐색하지 않음)" : "다음 후보 상위 5개");
    const head = document.createElement("thead"), row = document.createElement("tr");
    for (const label of ["칸", "g", "h", a === "bfs" ? "순번" : "우선값"]) {const th = node("th", label); th.scope = "col"; row.append(th);}
    head.append(row); const body = document.createElement("tbody");
    candidates.forEach((candidate, i) => {
      const tr = document.createElement("tr");
      const priority = candidate.priority ?? (a === "bfs" || a === "dijkstra" ? 0 : candidate.h * (a === "weighted" ? weight : 1));
      for (const value of [coord(candidate.index), candidate.g, candidate.h, a === "bfs" ? i + 1 : priority]) tr.append(node("td", value));
      body.append(tr);
    });
    table.append(caption, head, body); container.append(table);
  }
  if (done) container.append(node("p", r.found ? "E를 꺼내 종료했습니다. 진한 색은 최종 경로입니다." : "후보가 소진되어 경로가 없음을 확인했습니다.", "rule"));
}
function renderMission() {
  const info = CHALLENGES.find(c => c.id === challenge), finished = results && progress >= maxSteps();
  $("#missionTitle").textContent = mission === "predict" ? "결과 예측" : "8칸 비용 차이 설계";
  $("#question").textContent = mission === "predict" ? info.question : "S/E를 유지하고 빈 지도에서 1~8칸을 바꾸어, BFS 경로 비용이 Dijkstra보다 8 이상 높게 만드세요.";
  $("#predictionChoices").hidden = mission !== "predict";
  $("#hintText").textContent = mission === "predict" ? info.hint : "직선 위에 험지를 놓아도 BFS는 짧은 길을 고릅니다. Dijkstra가 선택할 평지 우회로를 남겨 두세요. 벽으로 끊기만 하면 목표를 달성하지 못합니다.";
  for (const b of document.querySelectorAll("[data-prediction]")) {
    b.setAttribute("aria-pressed", String(b.dataset.prediction === prediction)); b.disabled = Boolean(results);
  }
  $("#predictionState").textContent = mission === "predict" ? (results ? "예측 잠금" : prediction ? "예측 선택됨" : "실행 전 예측을 선택하세요.") :
    `기준 지도와 다른 칸 ${changes()} / 8 · S/E ${board.start === baseline.start && board.end === baseline.end ? "유지됨" : "변경됨"}`;
  const feedback = $("#feedback");
  if (!finished) {
    const text = results ? "탐색 중" : "";
    if (feedback.textContent !== text) feedback.replaceChildren(node("p", text));
    return;
  }
  feedback.replaceChildren();
  if (mission === "predict") {
    const fact = predictionFact(challenge, results);
    if (!fact) {feedback.append(node("p", "경로가 없어 이 비교 예측을 채점할 수 없습니다. 벽을 지우거나 원본 도전을 다시 시작하세요.")); return;}
    feedback.append(node("strong", lockedPrediction ? lockedPrediction === fact.answer ? "예측 일치" : "예측 불일치" : "예측 없음"));
    feedback.append(node("p", `실제 답: ${fact.answer === "yes" ? "그렇다" : "아니다"}. ${fact.evidence}`));
  } else {
    const goal = evaluateBuild(board, baseline, results);
    feedback.append(node("strong", goal.success ? "설계 목표 달성" : "목표 미달"));
    feedback.append(node("p", `편집 ${goal.changed}/8칸 · S/E ${goal.fixedEndpoints ? "유지" : "이동"} · 비용 차이 ${goal.gap ?? "경로 없음"} (목표 8 이상).`));
  }
}
function render() {
  draw($("#map"));
  const index = cursor.y * board.width + cursor.x;
  const terrain = index === board.start ? "출발 S" : index === board.end ? "도착 E" : board.cells[index] === -1 ? "벽" : `진입 비용 ${board.cells[index]}`;
  const cursorText = `선택한 칸: ${coord(index)} · ${terrain} · 도구 ${mode}`;
  if ($("#cursor").textContent !== cursorText) $("#cursor").textContent = cursorText;
  $("#map").setAttribute("aria-label", `지도 편집기. ${$("#cursor").textContent}. 방향키로 이동, Space 또는 Enter로 적용.`);
  $("#progress").max = maxSteps(); $("#progress").value = progress;
  $("#stepOut").textContent = `${progress} / ${results ? maxSteps() : "—"}`;
  $("#play").textContent = running ? "일시 정지" : "재생";
  $("#undo").disabled = history.length === 0;
  $("#mapSize").textContent = `${board.width} × ${board.height} · 상하좌우 이동`;
  $("#codeLabel").textContent = source === "build" ? "빈 지도 설계" : source === "sample" ? "기본 지도" : source === "import" ? "가져온 지도" : `${challengeCode(challenge, seed)}${edited ? " · 편집됨" : ""}`;
  $("#terrainCost").disabled = source === "build";
  $("[data-mode=weight]").textContent = `험지 · 비용 ${terrainCost}`;
  $("#weightedGuarantee").textContent = weight === 1 ? "w=1: 기본 A*와 같은 최소 비용 보장" : `w=${weight}: 최소 비용 보장 없음`;
  $("#weightOut").textContent = `g + ${weight}h`;
  for (const a of ALGORITHMS) {
    const r = results?.find(result => result.algorithm === a), done = r && progress >= r.visited.length;
    draw($("#" + a), r); const container = $("#" + a + "Metrics"); container.replaceChildren();
    for (const [label, value] of [["확장한 칸", r ? Math.min(progress, r.visited.length) : "—"], ["이동 횟수", done ? r.steps ?? "없음" : "—"], ["경로 비용", done ? r.cost ?? "없음" : "—"]]) {
      const div = document.createElement("div"); div.append(node("span", label), node("strong", value)); container.append(div);
    }
    renderTrace(a, r);
    $("#" + a).setAttribute("aria-label", `${names[a]}: ${r ? `${Math.min(progress, r.visited.length)}칸 확장, ${snapshot(r)?.frontier.length ?? 1}칸 후보${done ? r.found ? `, 이동 ${r.steps}회, 비용 ${r.cost}` : ", 경로 없음" : ""}` : "실행 대기"}`);
  }
  $("#comparison").replaceChildren();
  if (results && progress >= maxSteps()) {
    const d = results.find(r => r.algorithm === "dijkstra");
    if (d.found) {
      $("#comparison").append(node("strong", `이 지도의 최소 비용: ${d.cost}`));
      for (const r of results) $("#comparison").append(node("p", `${names[r.algorithm]} · 비용 ${r.cost} · 최적 비용 대비 +${r.cost - d.cost} · ${r.visited.length}칸 확장 · 최대 후보 ${r.peakFrontier}칸`));
    } else $("#comparison").append(node("strong", "모든 전략에서 경로 없음. 후보 소진은 지도 단절의 근거입니다."));
  }
  renderMission();
}
function solveAll(reveal = false, manual = false) {
  hintUsed = hintUsed || $("#hint").open;
  if (!manual) independent = false;
  results = ALGORITHMS.map(a => solve(board, a, {weight})); lockedPrediction = prediction;
  if (manual && !achievement) {
    const witness = independentWitness(board, {source, hintUsed, independent});
    if (witness) {
      const saved = saveAchievement(storage, witness, new Date().toISOString());
      if (saved.saved) achievement = witness;
      $("#recordStatus").textContent = saved.saved ? `독립 설계 완료 1 / 1${saved.summary ? "" : " · 갤러리 요약 저장 실패"}` : "목표 달성 · 기기 기록 저장 실패";
    }
  }
  running = !reveal && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  progress = reveal ? maxSteps() : 0;
  status(reveal ? "계산 완료" : running ? "탐색 기록 재생 중" : "재생 대기");
  render(); schedule(); return summary();
}
function applyPaint(x, y, newMode = mode, manual = false) {
  const next = paint(board, x, y, newMode, terrainCost);
  if (!manual) independent = false;
  if (next.start === board.start && next.end === board.end && next.cells.every((v, i) => v === board.cells[i])) {cursor = {x, y}; render(); return summary();}
  pushHistory();
  board = next; cursor = {x, y}; edited = changes() > 0 || board.start !== baseline.start || board.end !== baseline.end; invalidate();
  status("지도 변경 · 결과와 예측 초기화"); render(); return summary();
}
function setMode(button) {
  mode = button.dataset.mode;
  for (const b of document.querySelectorAll("[data-mode]")) b.setAttribute("aria-pressed", String(b === button));
  render();
}
for (const b of document.querySelectorAll("[data-mode]")) b.addEventListener("click", () => setMode(b));
for (const b of document.querySelectorAll("[data-prediction]")) b.addEventListener("click", () => {
  if (!results) {prediction = b.dataset.prediction; renderMission();}
});
const map = $("#map");
function pointer(event) {
  const p = canvasPointer(map, event);
  if (p.x < 0 || p.y < 0 || p.x >= map.width || p.y >= map.height) return;
  const x = Math.floor(p.x / map.width * board.width), y = Math.floor(p.y / map.height * board.height), i = y * board.width + x;
  if (i !== lastCell) {lastCell = i; applyPaint(x, y, mode, true);}
}
map.addEventListener("pointerdown", e => {if (e.button !== 0) return; drawing = true; lastCell = -1; map.focus(); map.setPointerCapture(e.pointerId); pointer(e);});
map.addEventListener("pointermove", e => {if (drawing) pointer(e);});
for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) map.addEventListener(event, () => {drawing = false; lastCell = -1;});
map.addEventListener("keydown", e => {
  const keys = {ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]};
  if (keys[e.key]) {e.preventDefault(); cursor = {x: clamp(cursor.x + keys[e.key][0], 0, board.width - 1), y: clamp(cursor.y + keys[e.key][1], 0, board.height - 1)}; render();}
  else if (e.key === " " || e.key === "Enter") {e.preventDefault(); applyPaint(cursor.x, cursor.y, mode, true);}
});
$("#challenge").addEventListener("change", e => loadChallenge(e.target.value, freshSeed()));
$("#random").addEventListener("click", () => loadChallenge($("#challenge").value, freshSeed()));
$("#replay").addEventListener("click", () => {
  try {const code = parseChallengeCode($("#replayCode").value.trim()); loadChallenge(code.id, code.seed);}
  catch {status("재현 코드를 확인하세요. 예: RR1-maze-2026 (시드 0~4294967295). 현재 지도는 유지됩니다."); $("#replayCode").focus();}
});
$("#missionMode").addEventListener("change", e => {
  mission = e.target.value; source = mission === "build" ? "build" : "challenge";
  replace(mission === "build" ? emptyBoard() : challengeBoard(challenge, seed), mission === "build" ? "빈 지도에서 8칸 설계를 시작합니다." : "도전 원본에서 새 예측을 시작합니다.");
});
$("#restart").addEventListener("click", () => {
  if (source === "import") {weight = originMap.weight; terrainCost = originMap.terrainCost;}
  replace(source === "import" ? structuredClone(originMap.board) : source === "build" ? emptyBoard() : source === "sample" ? defaultBoard() : challengeBoard(challenge, seed), "원본 복원");
});
$("#sample").addEventListener("click", () => {mission = "predict"; challenge = "trap"; source = "sample"; $("#missionMode").value = mission; $("#challenge").value = challenge; replace(defaultBoard(), "기본 지도");});
$("#clear").addEventListener("click", () => {mission = "build"; source = "build"; $("#missionMode").value = mission; replace(emptyBoard(), "빈 지도에서 비용 차이 설계 미션을 시작합니다.");});
$("#undo").addEventListener("click", () => {
  if (!history.length) return;
  ({board, baseline, source, mission, weight, terrainCost, edited, challenge, seed, originMap} = history.pop());
  cursor = {x: board.start % board.width, y: Math.floor(board.start / board.width)};
  $("#missionMode").value = mission; $("#challenge").value = challenge;
  $("#weight").value = String(weight); $("#terrainCost").value = String(terrainCost);
  $("#replayCode").value = challengeCode(challenge, seed);
  invalidate(); status("되돌림 · 결과와 예측 초기화"); render();
});
$("#terrainCost").addEventListener("change", e => {
  const next = Number(e.target.value);
  if (!Number.isInteger(next) || next < 2 || next > 99 || source === "build") {
    e.target.value = String(terrainCost); status("험지 비용: 정수 2~99. 설계 미션은 5 고정."); return;
  }
  terrainCost = next; render();
});
$("#hint").addEventListener("toggle", () => {if ($("#hint").open) hintUsed = true;});
$("#exportMap").addEventListener("click", () => {
  $("#mapCode").value = exportMap(board, terrainCost, weight); status("지도 코드 생성됨");
});
$("#copyMap").addEventListener("click", async () => {
  const code = exportMap(board, terrainCost, weight); $("#mapCode").value = code;
  try {await navigator.clipboard.writeText(code); status("지도 코드 복사됨");}
  catch {$("#mapCode").focus(); $("#mapCode").select(); status("자동 복사 불가 · 선택한 코드를 직접 복사하세요.");}
});
$("#importMap").addEventListener("click", () => {
  try {
    // Validate the complete payload before mutating any editor state.
    const next = importMap($("#mapCode").value); pushHistory();
    originMap = structuredClone(next); source = "import"; mission = "predict";
    weight = next.weight; terrainCost = next.terrainCost; $("#missionMode").value = mission;
    replace(next.board, "지도 가져옴 · 되돌리기 가능", true);
  } catch {status(`지도 코드 오류 · RRM1, 최대 ${MAX_MAP_CODE}자. 현재 지도 유지.`); $("#mapCode").focus();}
});
$("#eraseRecord").addEventListener("click", () => {
  const result = eraseAchievement(storage);
  if (result.erased) achievement = null;
  $("#recordStatus").textContent = result.erased ? `독립 설계 완료 0 / 1${result.summary ? "" : " · 갤러리 요약 삭제 실패"}` : "기기 기록 삭제 실패";
});
$("#weight").addEventListener("change", e => {
  const next = Number(e.target.value); if (![1, 1.5, 2, 3, 4].includes(next)) return;
  weight = next; invalidate(); status("w 변경 · 결과와 예측 초기화"); render();
});
$("#run").addEventListener("click", () => solveAll(false, true));
$("#play").addEventListener("click", () => {
  if (!results) {solveAll(false, true); return;}
  if (progress >= maxSteps()) progress = 0;
  running = !running; last = 0; render(); schedule();
});
$("#next").addEventListener("click", () => {if (!results) solveAll(false, true); running = false; progress = Math.min(progress + 1, maxSteps()); render();});
$("#finish").addEventListener("click", () => {if (!results) solveAll(true, true); running = false; progress = maxSteps(); render();});
$("#progress").addEventListener("input", e => {running = false; progress = clamp(Number(e.target.value), 0, results ? maxSteps() : 0); render();});
document.addEventListener("visibilitychange", () => {if (document.hidden) {running = false; render();}});
function schedule() {if (running && animationId === null) animationId = requestAnimationFrame(frame);}
function frame(now) {
  animationId = null; if (!running) return;
  if (now - last >= 100) {progress = Math.min(progress + 1, maxSteps()); if (progress >= maxSteps()) running = false; render(); last = now;}
  schedule();
}
window.addEventListener("pagehide", () => {running = false; if (animationId !== null) cancelAnimationFrame(animationId); animationId = null; last = 0;});
window.addEventListener("pageshow", e => {if (e.persisted) render();});
$("#replayCode").value = challengeCode(challenge, seed);
const stored = syncAchievement(storage, new Date().toISOString()); achievement = stored.witness;
$("#recordStatus").textContent = `독립 설계 완료 ${achievement ? 1 : 0} / 1${stored.summary ? "" : " · 기기 저장소 사용 불가"}`;
render();
expose([
  tool("read_route_state", "Read transient board configuration and actual computed result summaries.", {}, () => summary(), true),
  tool("paint_route_cell", "Paint one bounded cell through the visible editor action.", {x: {type: "integer", minimum: 0, maximum: 29}, y: {type: "integer", minimum: 0, maximum: 19}, mode: {type: "string", enum: ["wall", "weight", "erase", "start", "end"]}}, input => {
    if (!Object.hasOwn(input, "mode")) throw new TypeError("Missing mode");
    return applyPaint(input.x, input.y, input.mode);
  }),
  tool("solve_route_race", "Compute four strategies and show results; weighted strategy does not promise optimal cost when w>1.", {}, () => solveAll(true))
]);

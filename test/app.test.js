import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {exportMap, importMap, defaultBoard, solve} from "../dist/src/model.js";
import {PROGRESS_KEY} from "../dist/src/progress.js";
import {RECORD_KEY} from "../dist/src/records.js";

// Executes actual application handlers against a deliberately minimal DOM/storage
// double. This verifies wiring/state transitions, not browser layout or clipboard permissions.
class Element {
  constructor() {this.children = []; this.value = ""; this.dataset = {}; this.handlers = {}; this.attributes = {}; this.open = false; this.width = 800; this.height = 480;}
  set textContent(value) {this.text = String(value); this.children = [];}
  get textContent() {return this.text ?? this.children.map(c => c.textContent).join("");}
  append(...values) {delete this.text; this.children.push(...values);}
  replaceChildren(...values) {delete this.text; this.children = values;}
  setAttribute(key, value) {this.attributes[key] = value;}
  addEventListener(name, fn) {(this.handlers[name] ??= []).push(fn);}
  async trigger(name, extra = {}) {for (const fn of this.handlers[name] ?? []) await fn({target: this, preventDefault() {}, ...extra});}
  getContext() {return new Proxy({}, {get: () => () => {}, set: () => true});}
  focus() {this.focused = true;}
  select() {this.selected = true;}
}
test("actual UI handlers preserve map/settings across import and undo, and gate durable completion", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const nodes = new Map([...html.matchAll(/id="([^"]+)"/g)].map(([, id]) => ["#" + id, new Element()]));
  const modes = [...html.matchAll(/data-mode="([^"]+)"/g)].map(([, mode]) => {const e = new Element(); e.dataset.mode = mode; return e;});
  const predictions = ["yes", "no"].map(prediction => {const e = new Element(); e.dataset.prediction = prediction; return e;});
  const tools = new Map(), data = new Map(), clipboardWrites = [];
  const globals = ["document", "window", "matchMedia", "requestAnimationFrame", "cancelAnimationFrame", "navigator"];
  const original = globals.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  const storage = {getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key)};
  const document = {querySelector(selector) {
    const e = selector === "[data-mode=weight]" ? modes.find(m => m.dataset.mode === "weight") : nodes.get(selector);
    assert.ok(e, `Missing actual HTML selector ${selector}`); return e;
  }, querySelectorAll: selector => selector === "[data-mode]" ? modes : predictions,
  createElement: () => new Element(), addEventListener() {}, modelContext: {registerTool(tool) {tools.set(tool.name, tool);}}};
  for (const [key, value] of Object.entries({document, window: {localStorage: storage, addEventListener() {}},
    navigator: {clipboard: {writeText: async text => clipboardWrites.push(text)}},
    matchMedia: () => ({matches: true}), requestAnimationFrame: () => 1, cancelAnimationFrame() {}})) {
    Object.defineProperty(globalThis, key, {value, configurable: true, writable: true});
  }
  const click = id => nodes.get("#" + id).trigger("click");
  const change = async (id, value) => {nodes.get("#" + id).value = String(value); await nodes.get("#" + id).trigger("change");};
  const key = key => nodes.get("#map").trigger("keydown", {key});
  const weightBrush = () => modes.find(m => m.dataset.mode === "weight").trigger("click");
  const code = async () => {await click("exportMap"); return nodes.get("#mapCode").value;};
  const build = async () => {
    await click("clear"); await weightBrush();
    for (let n = 0; n < 3; n++) await key("ArrowRight");
    for (let n = 0; n < 3; n++) {await key(" "); if (n < 2) await key("ArrowRight");}
  };
  try {
    await import("../dist/src/app.js?handler-test");
    assert.equal(data.size, 0); assert.equal(clipboardWrites.length, 0);
    await click("sample"); await change("terrainCost", 9); await weightBrush();
    await key("ArrowRight"); await key(" "); await change("weight", 4);
    const edited = await code();
    assert.equal(importMap(edited).board.cells[102], 9); assert.equal(importMap(edited).weight, 4);
    assert.equal(clipboardWrites.length, 0); await click("copyMap"); assert.deepEqual(clipboardWrites, [edited]);
    await click("clear"); nodes.get("#mapCode").value = edited; await click("importMap");
    assert.equal(await code(), edited); assert.equal(nodes.get("#weight").value, "4");
    await click("finish"); assert.equal(data.size, 0);
    assert.ok(nodes.get("#comparison").textContent.includes(`최소 비용: ${solve(importMap(edited).board, "dijkstra").cost}`));
    const invalid = JSON.parse(edited.slice(5)); invalid.extra = "rejected";
    nodes.get("#mapCode").value = "RRM1-" + JSON.stringify(invalid); await click("importMap");
    assert.ok(nodes.get("#status").textContent.includes("지도 코드 오류")); assert.equal(await code(), edited);
    // Editing an imported map then restart restores the full imported baseline.
    await key("ArrowRight"); await key(" "); await click("restart"); assert.equal(await code(), edited);
    const large = {width: 30, height: 20, cells: Array(600).fill(1), start: 0, end: 599};
    nodes.get("#mapCode").value = exportMap(large, 99, 1.5); await click("importMap");
    assert.equal(nodes.get("#map").width, 1200); assert.equal(nodes.get("#map").height, 800);
    await click("undo"); assert.equal(await code(), edited); assert.equal(nodes.get("#map").width, 800);
    await build(); assert.equal(nodes.get("#terrainCost").disabled, true); await click("finish");
    assert.ok(data.has(RECORD_KEY)); assert.equal(JSON.parse(data.get(PROGRESS_KEY)).apps["route-race"].completed, 1);
    assert.ok(nodes.get("#feedback").textContent.includes("비용 차이 10"));
    await click("eraseRecord"); assert.equal(data.has(RECORD_KEY), false);
    assert.equal(Object.hasOwn(JSON.parse(data.get(PROGRESS_KEY)).apps, "route-race"), false);
    await build(); nodes.get("#hint").open = true; await nodes.get("#hint").trigger("toggle");
    nodes.get("#hint").open = false; await nodes.get("#hint").trigger("toggle"); await click("finish");
    assert.equal(data.has(RECORD_KEY), false);
    await build(); const ownCode = await code();
    nodes.get("#mapCode").value = ownCode; await click("importMap"); await click("undo"); await click("finish");
    assert.equal(data.has(RECORD_KEY), false); // Undo cannot launder an import into completion.
    await build(); tools.get("solve_route_race").execute(); await click("run"); assert.equal(data.has(RECORD_KEY), false);
    await build(); tools.get("paint_route_cell").execute({x: 4, y: 5, mode: "weight"});
    await click("finish"); assert.equal(data.has(RECORD_KEY), false);
    // Clipboard denial has a selectable, explicit manual-copy fallback.
    navigator.clipboard.writeText = async () => {throw new Error("denied");}; await click("copyMap");
    assert.equal(nodes.get("#mapCode").selected, true);
    assert.ok(nodes.get("#status").textContent.includes("직접 복사"));
    // The original RR1 lane and its known comparison still work.
    nodes.get("#replayCode").value = "RR1-trap-2026"; await click("replay"); await click("finish");
    assert.ok(nodes.get("#comparison").textContent.includes("BFS · 비용 65"));
    assert.ok(nodes.get("#comparison").textContent.includes("Dijkstra · 비용 23"));
    assert.equal(data.has(RECORD_KEY), false);
    // 33 distinct edits retain exactly the newest 32 snapshots.
    await click("clear"); await weightBrush();
    for (let n = 0; n < 35; n++) {
      await key(" "); await key("ArrowRight");
      if (n === 18) {await key("ArrowDown"); for (let x = 0; x < 19; x++) await key("ArrowLeft");}
    }
    assert.equal(importMap(await code()).board.cells.filter(v => v === 5).length, 33); // S/E are protected.
    for (let n = 0; n < 32; n++) await click("undo");
    assert.equal(importMap(await code()).board.cells.filter(v => v === 5).length, 1);
    assert.equal(nodes.get("#undo").disabled, true);
  } finally {
    for (const [key, descriptor] of original) {if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];}
  }
});

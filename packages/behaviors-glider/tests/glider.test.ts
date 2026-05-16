import test from "node:test";
import assert from "node:assert/strict";
import { GRID_HEIGHT, GRID_WIDTH, type DeviceInput } from "@cellsymphony/device-contracts";
import { gliderBehavior, type GliderState } from "../src/index";

const CELL_COUNT = GRID_WIDTH * GRID_HEIGHT;

function idx(x: number, y: number): number {
  return y * GRID_WIDTH + x;
}

const GLIDER_CELLS = [idx(1,0), idx(2,1), idx(0,2), idx(1,2), idx(2,2)];

test("Conway B3/S23 rules: block is stable", () => {
  const state = gliderBehavior.init({ spawnInterval: 0 });
  const block = [idx(1,1), idx(2,1), idx(1,2), idx(2,2)];
  const s: GliderState = { ...state, cells: (() => {
    const c = new Array(CELL_COUNT).fill(false);
    for (const i of block) c[i] = true;
    return c;
  })() };

  const next = gliderBehavior.onTick(s, { bpm: 120, emit: () => {} });
  for (const i of block) assert.equal(next.cells[i], true, `block cell ${i} should survive`);
  assert.equal(next.cells.filter(Boolean).length, 4);
});

test("glider spawns when tickCounter matches spawnInterval", () => {
  const state = gliderBehavior.init({ spawnInterval: 3 });
  const s: GliderState = { ...state, cells: new Array(CELL_COUNT).fill(false), tickCounter: 0 };

  // tick 2 (counter becomes 3) should trigger spawn
  const tick1 = gliderBehavior.onTick(s, { bpm: 120, emit: () => {} });
  assert.equal(tick1.tickCounter, 1);
  
  const tick2 = gliderBehavior.onTick(tick1, { bpm: 120, emit: () => {} });
  assert.equal(tick2.tickCounter, 2);

  const tick3 = gliderBehavior.onTick(tick2, { bpm: 120, emit: () => {} });
  assert.equal(tick3.tickCounter, 3);
  const aliveCount = tick3.cells.filter(Boolean).length;
  assert.ok(aliveCount > 0, "glider should spawn when interval is reached");
});

test("spawnInterval 0 disables spawning", () => {
  const state = gliderBehavior.init({ spawnInterval: 0 });
  const s: GliderState = { ...state, cells: new Array(CELL_COUNT).fill(false), tickCounter: 0 };

  // Run many ticks with spawnInterval=0 — no cells should appear
  let current = s as GliderState;
  const initialCount = current.cells.filter(Boolean).length;
  for (let i = 0; i < 10; i++) {
    current = gliderBehavior.onTick(current, { bpm: 120, emit: () => {} });
  }
  assert.equal(current.cells.filter(Boolean).length, initialCount, "no cells should spawn with interval 0");
});

test("onInput is no-op", () => {
  const state = gliderBehavior.init({});
  const input: DeviceInput = { type: "grid_press", x: 0, y: 0 };
  const next = gliderBehavior.onInput(state, input, { bpm: 120, emit: () => {} });
  assert.equal(next, state);
});

test("renderModel returns triggerTypes for activate, stable, deactivate", () => {
  const state = gliderBehavior.init({ spawnInterval: 0 });
  const s: GliderState = { ...state, cells: (() => {
    const c = new Array(CELL_COUNT).fill(false);
    for (const i of GLIDER_CELLS) c[i] = true;
    return c;
  })() };

  const next = gliderBehavior.onTick(s, { bpm: 120, emit: () => {} });
  const model = gliderBehavior.renderModel(next);
  assert.equal(model.triggerTypes.length, CELL_COUNT);
  assert.equal(model.name, "Glider");
  const totalTriggers = model.triggerTypes.filter(t => t !== "none").length;
  assert.ok(totalTriggers > 0, "some cells should have trigger types");
});

test("configMenu returns expected items", () => {
  const state = gliderBehavior.init({});
  const menu = gliderBehavior.configMenu!(state);
  assert.equal(menu.length, 2);
  assert.equal(menu[0].key, "spawnInterval");
  assert.equal(menu[1].key, "spawnGlider");
  assert.equal(menu[1].type, "action");
});

import test from "node:test";
import assert from "node:assert/strict";
import { GRID_DOMAIN, GRID_WIDTH, GRID_HEIGHT, type DeviceInput } from "@cellsymphony/device-contracts";
import { keysBehavior, type KeysState } from "../src/index";

const CELL_COUNT = GRID_WIDTH * GRID_HEIGHT;

function idx(x: number, y: number): number {
  return GRID_DOMAIN.indexOf({ x, y });
}

test("init creates empty grid with immediate quantize by default", () => {
  const state = keysBehavior.init({});
  assert.equal(state.cells.length, CELL_COUNT);
  assert.ok(state.cells.every((c) => c === false));
  assert.equal(state.quantize, "immediate");
});

test("init respects quantize config", () => {
  const state = keysBehavior.init({ quantize: "step" });
  assert.equal(state.quantize, "step");
});

test("grid_press in immediate mode activates cell", () => {
  const state = keysBehavior.init({});
  const input: DeviceInput = { type: "grid_press", x: 2, y: 3 };
  const next = keysBehavior.onInput(state, input, { bpm: 120, emit: () => {} });
  assert.equal(next.cells[idx(2, 3)], true);
  assert.equal(next.triggerTypes[idx(2, 3)], "activate");
  assert.equal(next.heldCells[idx(2, 3)], true);
});

test("grid_release in immediate mode deactivates cell", () => {
  let state = keysBehavior.init({});
  state = keysBehavior.onInput(state, { type: "grid_press", x: 2, y: 3 }, { bpm: 120, emit: () => {} });
  const next = keysBehavior.onInput(state, { type: "grid_release", x: 2, y: 3 }, { bpm: 120, emit: () => {} });
  assert.equal(next.cells[idx(2, 3)], false);
  assert.equal(next.triggerTypes[idx(2, 3)], "deactivate");
  assert.equal(next.heldCells[idx(2, 3)], false);
});

test("grid_press in step mode only updates heldCells", () => {
  const state = keysBehavior.init({ quantize: "step" });
  const input: DeviceInput = { type: "grid_press", x: 2, y: 3 };
  const next = keysBehavior.onInput(state, input, { bpm: 120, emit: () => {} });
  assert.equal(next.cells[idx(2, 3)], false, "cells should not change");
  assert.equal(next.heldCells[idx(2, 3)], true, "heldCells should update");
});

test("grid_release in step mode only updates heldCells", () => {
  let state = keysBehavior.init({ quantize: "step" });
  state = keysBehavior.onInput(state, { type: "grid_press", x: 2, y: 3 }, { bpm: 120, emit: () => {} });
  const next = keysBehavior.onInput(state, { type: "grid_release", x: 2, y: 3 }, { bpm: 120, emit: () => {} });
  assert.equal(next.heldCells[idx(2, 3)], false);
  assert.equal(next.cells[idx(2, 3)], false, "cells should not change on release in step mode");
});

test("step mode onTick applies heldCells to cells", () => {
  let state = keysBehavior.init({ quantize: "step" });
  state = keysBehavior.onInput(state, { type: "grid_press", x: 2, y: 3 }, { bpm: 120, emit: () => {} });
  state = keysBehavior.onInput(state, { type: "grid_press", x: 5, y: 7 }, { bpm: 120, emit: () => {} });
  const ticked = keysBehavior.onTick(state, { bpm: 120, emit: () => {} });
  assert.equal(ticked.cells[idx(2, 3)], true, "press target should activate");
  assert.equal(ticked.cells[idx(5, 7)], true, "second press target should activate");
  assert.equal(ticked.triggerTypes[idx(2, 3)], "activate");
});

test("step mode onTick deactivates released cells", () => {
  let state = keysBehavior.init({ quantize: "step" });
  state = keysBehavior.onInput(state, { type: "grid_press", x: 2, y: 3 }, { bpm: 120, emit: () => {} });
  state = keysBehavior.onInput(state, { type: "grid_press", x: 5, y: 7 }, { bpm: 120, emit: () => {} });
  state = keysBehavior.onTick(state, { bpm: 120, emit: () => {} });
  state = keysBehavior.onInput(state, { type: "grid_release", x: 2, y: 3 }, { bpm: 120, emit: () => {} });
  const ticked = keysBehavior.onTick(state, { bpm: 120, emit: () => {} });
  assert.equal(ticked.cells[idx(2, 3)], false, "released cell should deactivate");
  assert.equal(ticked.cells[idx(5, 7)], true, "still-held cell should stay active");
  assert.equal(ticked.triggerTypes[idx(2, 3)], "deactivate");
});

test("immediate mode onTick sets stable for alive cells", () => {
  let state = keysBehavior.init({});
  state = keysBehavior.onInput(state, { type: "grid_press", x: 2, y: 3 }, { bpm: 120, emit: () => {} });
  const ticked = keysBehavior.onTick(state, { bpm: 120, emit: () => {} });
  assert.equal(ticked.triggerTypes[idx(2, 3)], "stable");
});

test("onInput ignores non-grid input types", () => {
  const state = keysBehavior.init({});
  const input: DeviceInput = { type: "encoder_turn", delta: 1 };
  const next = keysBehavior.onInput(state, input, { bpm: 120, emit: () => {} });
  assert.equal(next, state);
});

test("onInput rejects out-of-bounds coordinates", () => {
  const state = keysBehavior.init({});
  const press: DeviceInput = { type: "grid_press", x: GRID_WIDTH, y: 0 };
  const next = keysBehavior.onInput(state, press, { bpm: 120, emit: () => {} });
  assert.equal(next, state);
});

test("renderModel shows name and status", () => {
  const immediate = keysBehavior.init({});
  const modelI = keysBehavior.renderModel(immediate);
  assert.equal(modelI.name, "Keys");
  assert.equal(modelI.statusLine, "Immediate");

  const step = keysBehavior.init({ quantize: "step" });
  const modelS = keysBehavior.renderModel(step);
  assert.equal(modelS.statusLine, "Quantized");
});

test("has interpretInputTransitions", () => {
  assert.equal(keysBehavior.interpretInputTransitions, true);
});

test("configMenu returns quantize option", () => {
  const state = keysBehavior.init({});
  const menu = keysBehavior.configMenu!(state);
  assert.equal(menu.length, 1);
  assert.equal(menu[0].key, "quantize");
  assert.equal(menu[0].type, "enum");
  assert.deepEqual(menu[0].options, ["immediate", "step"]);
});

test("serialize/deserialize round-trip", () => {
  const state = keysBehavior.init({ quantize: "step" });
  state.cells[3] = true;
  const raw = keysBehavior.serialize(state);
  const restored = keysBehavior.deserialize(raw);
  assert.equal(restored.quantize, "step");
  assert.equal(restored.cells[3], true);
});

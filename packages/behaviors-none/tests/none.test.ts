import test from "node:test";
import assert from "node:assert/strict";
import { GRID_DOMAIN, GRID_WIDTH, GRID_HEIGHT, type DeviceInput } from "@cellsymphony/device-contracts";
import { noneBehavior } from "../src/index";

const CELL_COUNT = GRID_WIDTH * GRID_HEIGHT;

test("init creates empty grid", () => {
  const state = noneBehavior.init({});
  assert.equal(state.cells.length, CELL_COUNT);
  assert.ok(state.cells.every((c) => c === false));
});

test("onInput ignores grid_press", () => {
  const state = noneBehavior.init({});
  const input: DeviceInput = { type: "grid_press", x: 3, y: 4 };
  const next = noneBehavior.onInput(state, input, { bpm: 120, emit: () => {} });
  assert.equal(next, state);
});

test("onInput ignores grid_release", () => {
  const state = noneBehavior.init({});
  const input: DeviceInput = { type: "grid_release", x: 3, y: 4 };
  const next = noneBehavior.onInput(state, input, { bpm: 120, emit: () => {} });
  assert.equal(next, state);
});

test("onInput ignores encoder_turn", () => {
  const state = noneBehavior.init({});
  const input: DeviceInput = { type: "encoder_turn", delta: 1 };
  const next = noneBehavior.onInput(state, input, { bpm: 120, emit: () => {} });
  assert.equal(next, state);
});

test("onTick returns same state", () => {
  const state = noneBehavior.init({});
  const next = noneBehavior.onTick(state, { bpm: 120, emit: () => {} });
  assert.equal(next, state);
});

test("renderModel returns None/Idle with empty cells", () => {
  const state = noneBehavior.init({});
  const model = noneBehavior.renderModel(state);
  assert.equal(model.name, "None");
  assert.equal(model.statusLine, "Idle");
  assert.ok(model.cells.every((c) => c === false));
});

test("serialize/deserialize round-trip", () => {
  const state = noneBehavior.init({});
  const raw = noneBehavior.serialize(state);
  const restored = noneBehavior.deserialize(raw);
  assert.deepEqual(restored, state);
});

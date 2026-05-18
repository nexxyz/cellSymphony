import test from "node:test";
import assert from "node:assert/strict";
import type { BehaviorEngine } from "@cellsymphony/behavior-api";
import { GRID_HEIGHT, GRID_WIDTH, type DeviceInput } from "@cellsymphony/device-contracts";
import { lifeBehavior } from "@cellsymphony/behaviors-life";
import {
  applyConfigPayload,
  createInitialState,
  extractConfigPayload,
  routeInput,
  tick,
  toSimulatorFrame,
  type PlatformEffect,
  type PlatformState
} from "../src/index";

const CELL_COUNT = GRID_WIDTH * GRID_HEIGHT;

type MockState = { cells: boolean[]; tickCount: number };

const mockBehavior: BehaviorEngine<MockState, unknown> = {
  id: "mock",
  init: () => ({
    cells: Array.from({ length: CELL_COUNT }, (_, i) => i === 0 || i === GRID_WIDTH),
    tickCount: 0
  }),
  onInput: (state) => state,
  onTick: (state) => {
    const next = state.cells.slice();
    next[0] = !next[0];
    return { cells: next, tickCount: state.tickCount + 1 };
  },
  renderModel: (state) => ({
    name: "Mock",
    statusLine: "ok",
    cells: state.cells
  }),
  serialize: (state) => state,
  deserialize: (data) => data as MockState
};

function makeState() {
  const s = createInitialState(mockBehavior);
  s.system.oledMode = "normal";
  return s;
}

function turn(state: PlatformState<MockState>, delta: -1 | 1): { state: PlatformState<MockState>; effects: PlatformEffect[] } {
  return routeInput(state, { type: "encoder_turn", delta } as DeviceInput, mockBehavior);
}

function press(state: PlatformState<MockState>): { state: PlatformState<MockState>; effects: PlatformEffect[] } {
  return routeInput(state, { type: "encoder_press" } as DeviceInput, mockBehavior);
}

function selectLabel(state: PlatformState<MockState>, label: string): PlatformState<MockState> {
  for (let i = 0; i < 80; i += 1) {
    const frame = toSimulatorFrame(state, mockBehavior);
    const selected = frame.display.lines.find((l) => l.startsWith("@@")) ?? "";
    if (selected.includes(label)) return state;
    const r = turn(state, 1);
    state = r.state;
  }
  throw new Error(`failed to select label: ${label}`);
}

// ─── Aux Encoder Binding ──────────────────────────────────────────

test("aux encoder bind while editing param", () => {
  let state = makeState();

  // Navigate to Master Vol and start editing
  state = selectLabel(state, "System");
  state = press(state).state;
  state = selectLabel(state, "Audio");
  state = press(state).state;
  state = press(state).state; // enter edit mode for Master Vol

  // Now shift+press an aux encoder to bind
  state.system.shiftHeld = true;
  const r = routeInput(state, { type: "encoder_press", id: "aux1" } as DeviceInput, mockBehavior);
  state = r.state;

  assert.ok(state.system.auxBindings["aux1"], "aux1 should be bound");
  assert.equal(state.system.auxBindings["aux1"]!.turn!.key, "masterVolume");
  assert.equal(state.system.auxBindings["aux1"]!.press, null);
});

test("aux encoder unbind when pressing same param again", () => {
  let state = makeState();

  state = selectLabel(state, "System");
  state = press(state).state;
  state = selectLabel(state, "Audio");
  state = press(state).state;
  state = press(state).state;

  // Bind with shift+press
  state.system.shiftHeld = true;
  state = routeInput(state, { type: "encoder_press", id: "aux1" } as DeviceInput, mockBehavior).state;
  assert.ok(state.system.auxBindings["aux1"], "should be bound");

  // Unbind (same param, same aux encoder, shift+press again)
  state.system.shiftHeld = true;
  state = routeInput(state, { type: "encoder_press", id: "aux1" } as DeviceInput, mockBehavior).state;
  assert.ok(state.system.confirm, "should open unbind confirm");
  state = routeInput(state, { type: "encoder_press", id: "main" } as DeviceInput, mockBehavior).state;
  assert.equal(state.system.auxBindings["aux1"], null, "should be unbound");
});

test("aux encoder shift+press unbinds bound param when nothing bindable", () => {
  let state = makeState();
  state.system.auxBindings["aux1"] = { turn: { key: "masterVolume", label: "Master Vol", kind: "number", min: 0, max: 100, step: 1 }, press: null };
  state.system.shiftHeld = true;

  const r = routeInput(state, { type: "encoder_press", id: "aux1" } as DeviceInput, mockBehavior);
  state = r.state;

  assert.ok(state.system.confirm, "should open unbind confirm");
  state = routeInput(state, { type: "encoder_press", id: "main" } as DeviceInput, mockBehavior).state;
  assert.equal(state.system.auxBindings["aux1"], null, "should be unbound");
});

test("aux encoder shift+press on unbound does nothing else harmful", () => {
  let state = makeState();
  state.system.shiftHeld = true;

  const r = routeInput(state, { type: "encoder_press", id: "aux1" } as DeviceInput, mockBehavior);
  state = r.state;

  assert.equal(state.system.auxBindings["aux1"] ?? null, null, "should remain unbound");
  assert.equal(state.system.toast?.message, "S1: No binding");
});

test("aux encoder turn adjusts bound param", () => {
  let state = makeState();
  state.system.auxBindings["aux1"] = { turn: { key: "masterVolume", label: "Master Vol", kind: "number", min: 0, max: 100, step: 1 }, press: null };
  state.runtimeConfig.masterVolume = 50;

  const r = routeInput(state, { type: "encoder_turn", id: "aux1", delta: 1 } as DeviceInput, mockBehavior);
  state = r.state;

  assert.equal(state.runtimeConfig.masterVolume, 51);
  assert.equal(state.system.toast?.message, "T1: Master Vol: Vol: 51%");
});

test("aux encoder turn adjusts bound behaviorConfig param", () => {
  let state = createInitialState(lifeBehavior);
  state.system.oledMode = "normal";
  state.runtimeConfig.activeBehavior = "life";
  state.runtimeConfig.behaviorConfig = { life: { randomCellsPerTick: 5, randomTickInterval: 2 } } as any;
  state.system.auxBindings["aux1"] = { turn: { key: "behaviorConfig.life.randomCellsPerTick", label: "Spawn Count", kind: "number", min: 0, max: 20, step: 1 }, press: null };

  const r = routeInput(state, { type: "encoder_turn", id: "aux1", delta: 1 } as DeviceInput, mockBehavior);
  state = r.state;

  assert.equal((state.runtimeConfig.behaviorConfig as any).life?.randomCellsPerTick, 6);
  assert.equal(state.system.toast?.message, "T1: Spawn Count: 6");
});

test("aux encoder press triggers bound behavior action", () => {
  let state = createInitialState(lifeBehavior);
  state.system.oledMode = "normal";
  state.runtimeConfig.activeBehavior = "life";
  state.system.auxBindings["aux1"] = { turn: null, press: { actionType: "spawnRandom", label: "Spawn Random" } };

  const before = state.behaviorState.cells.filter(Boolean).length;
  const r = routeInput(state, { type: "encoder_press", id: "aux1" } as DeviceInput, lifeBehavior);
  state = r.state;
  const after = state.behaviorState.cells.filter(Boolean).length;

  assert.ok(after > before, "bound behavior action should change behavior state");
  assert.equal(state.system.toast?.message, "S1: Spawn Random");
});

test("spawn action label shows shared marker in menu", () => {
  let state = createInitialState(lifeBehavior);
  state.system.oledMode = "normal";
  state.runtimeConfig.activeBehavior = "life";

  state = selectLabel(state, "L1: Life");
  state = press(state).state;
  state = selectLabel(state, "Spawn Random");

  const frame = toSimulatorFrame(state, mockBehavior);
  const selected = frame.display.lines.find((l) => l.startsWith("@@")) ?? "";
  assert.ok(selected.includes("!Spawn Random [S]"));
});

test("binding spawn action stores shared route", () => {
  let state = createInitialState(lifeBehavior);
  state.system.oledMode = "normal";
  state.runtimeConfig.activeBehavior = "life";

  state = selectLabel(state, "L1: Life");
  state = press(state).state;
  state = selectLabel(state, "Spawn Random");
  state.system.shiftHeld = true;
  state = routeInput(state, { type: "encoder_press", id: "aux1" } as DeviceInput, mockBehavior).state;

  assert.equal(state.system.auxBindings["aux1"]?.press?.routeKey, "trigger.life.spawn_now");
  assert.equal(state.system.auxBindings["aux1"]?.press?.label, "Spawn Now");
});

test("shared spawn route shows N/A toast in sequencer", () => {
  let state = makeState();
  state.runtimeConfig.activeBehavior = "sequencer";
  state.system.auxBindings["aux1"] = {
    turn: null,
    press: { actionType: "spawnRandom", routeKey: "trigger.life.spawn_now", label: "Spawn Now" }
  };

  state = routeInput(state, { type: "encoder_press", id: "aux1" } as DeviceInput, mockBehavior).state;
  assert.equal(state.system.toast?.message, "S1: N/A (Spawn Now)");
});

test("aux encoder turn bool binding clamps in both directions", () => {
  let state = makeState();
  state.runtimeConfig.midi.enabled = false;
  state.system.auxBindings["aux1"] = { turn: { key: "midi.enabled", label: "MIDI Enabled", kind: "bool" }, press: null };

  state = routeInput(state, { type: "encoder_turn", id: "aux1", delta: -1 } as DeviceInput, mockBehavior).state;
  assert.equal(state.runtimeConfig.midi.enabled, false);
  assert.equal(state.system.toast?.message, "T1: MIDI Enabled: Off");

  state = routeInput(state, { type: "encoder_turn", id: "aux1", delta: 1 } as DeviceInput, mockBehavior).state;
  assert.equal(state.runtimeConfig.midi.enabled, true);
  assert.equal(state.system.toast?.message, "T1: MIDI Enabled: On");

  state = routeInput(state, { type: "encoder_turn", id: "aux1", delta: 1 } as DeviceInput, mockBehavior).state;
  assert.equal(state.runtimeConfig.midi.enabled, true);
});

test("aux encoder turn enum binding clamps and does not wrap", () => {
  let state = makeState();
  state.runtimeConfig.scanMode = "immediate";
  state.system.auxBindings["aux1"] = { turn: { key: "scanMode", label: "Scan Mode", kind: "enum", options: ["immediate", "scanning"] }, press: null };

  state = routeInput(state, { type: "encoder_turn", id: "aux1", delta: -1 } as DeviceInput, mockBehavior).state;
  assert.equal(state.runtimeConfig.scanMode, "immediate");

  state = routeInput(state, { type: "encoder_turn", id: "aux1", delta: 1 } as DeviceInput, mockBehavior).state;
  assert.equal(state.runtimeConfig.scanMode, "scanning");

  state = routeInput(state, { type: "encoder_turn", id: "aux1", delta: 1 } as DeviceInput, mockBehavior).state;
  assert.equal(state.runtimeConfig.scanMode, "scanning");
});

test("aux press spawn action remaps on behavior switch", () => {
  let state = createInitialState(lifeBehavior);
  state.system.oledMode = "normal";
  state.runtimeConfig.activeBehavior = "life";
  state.activeBehavior = "life";
  state.system.auxBindings["aux1"] = { turn: null, press: { actionType: "spawnRandom", label: "Spawn Random" } };

  state = selectLabel(state, "L1: Life");
  state = press(state).state;
  state = selectLabel(state, "Behavior");
  state = press(state).state;
  state = turn(state, 1).state;

  assert.equal(state.runtimeConfig.activeBehavior, "brain");
  assert.equal(state.system.auxBindings["aux1"]?.press?.actionType, "seedRandom");
  assert.equal(state.system.auxBindings["aux1"]?.press?.label, "Seed Random");
});

test("aux press spawn action clears on switch to sequencer", () => {
  let state = createInitialState(lifeBehavior);
  state.system.oledMode = "normal";
  state.runtimeConfig.activeBehavior = "life";
  state.activeBehavior = "life";
  state.system.auxBindings["aux1"] = { turn: null, press: { actionType: "spawnRandom", label: "Spawn Random" } };

  state = selectLabel(state, "L1: Life");
  state = press(state).state;
  state = selectLabel(state, "Behavior");
  state = press(state).state;
  state = turn(state, -1).state;

  assert.equal(state.runtimeConfig.activeBehavior, "sequencer");
  assert.equal(state.system.auxBindings["aux1"], null);
});

test("aux encoder press shows no binding toast when unbound", () => {
  let state = makeState();
  state = routeInput(state, { type: "encoder_press", id: "aux1" } as DeviceInput, mockBehavior).state;
  assert.equal(state.system.toast?.message, "S1: No binding");
});

test("aux encoder turn shows no binding toast when unbound", () => {
  let state = makeState();
  state = routeInput(state, { type: "encoder_turn", id: "aux1", delta: 1 } as DeviceInput, mockBehavior).state;
  assert.equal(state.system.toast?.message, "T1: No binding");
});

test("aux toast updates and extends while already visible", () => {
  let state = makeState();
  state.runtimeConfig.masterVolume = 50;
  state.system.auxBindings["aux1"] = { turn: { key: "masterVolume", label: "Master Vol", kind: "number", min: 0, max: 100, step: 1 }, press: null };

  state = routeInput(state, { type: "encoder_turn", id: "aux1", delta: 1 } as DeviceInput, mockBehavior).state;
  const firstUntil = state.system.toast!.untilMs;

  state = routeInput(state, { type: "encoder_turn", id: "aux1", delta: 1 } as DeviceInput, mockBehavior).state;
  const secondUntil = state.system.toast!.untilMs;

  assert.equal(state.system.toast?.message, "T1: Master Vol: Vol: 52%");
  assert.ok(secondUntil > firstUntil, "toast lifetime should extend on update");
});

test("aux unbind confirm supports Click and Turn choices", () => {
  let state = makeState();
  state.system.shiftHeld = true;
  state.system.auxBindings["aux1"] = {
    turn: { key: "masterVolume", label: "Master Vol", kind: "number", min: 0, max: 100, step: 1 },
    press: { actionType: "spawnRandom", label: "Spawn Random" }
  };

  state = routeInput(state, { type: "encoder_press", id: "aux1" } as DeviceInput, mockBehavior).state;
  state = routeInput(state, { type: "encoder_turn", id: "main", delta: 1 } as DeviceInput, mockBehavior).state;
  state = routeInput(state, { type: "encoder_press", id: "main" } as DeviceInput, mockBehavior).state;
  assert.equal(state.system.auxBindings["aux1"]?.press, null);
  assert.ok(state.system.auxBindings["aux1"]?.turn);

  state.system.shiftHeld = true;
  state = routeInput(state, { type: "encoder_press", id: "aux1" } as DeviceInput, mockBehavior).state;
  state = routeInput(state, { type: "encoder_turn", id: "main", delta: 1 } as DeviceInput, mockBehavior).state;
  state = routeInput(state, { type: "encoder_turn", id: "main", delta: 1 } as DeviceInput, mockBehavior).state;
  state = routeInput(state, { type: "encoder_press", id: "main" } as DeviceInput, mockBehavior).state;
  assert.equal(state.system.auxBindings["aux1"], null);
});

test("aux unbind confirm cancel keeps binding", () => {
  let state = makeState();
  state.system.shiftHeld = true;
  state.system.auxBindings["aux1"] = { turn: { key: "masterVolume", label: "Master Vol", kind: "number", min: 0, max: 100, step: 1 }, press: null };

  state = routeInput(state, { type: "encoder_press", id: "aux1" } as DeviceInput, mockBehavior).state;
  state = routeInput(state, { type: "encoder_turn", id: "main", delta: 1 } as DeviceInput, mockBehavior).state;
  state = routeInput(state, { type: "encoder_turn", id: "main", delta: 1 } as DeviceInput, mockBehavior).state;
  state = routeInput(state, { type: "encoder_turn", id: "main", delta: 1 } as DeviceInput, mockBehavior).state;
  state = routeInput(state, { type: "encoder_press", id: "main" } as DeviceInput, mockBehavior).state;
  assert.ok(state.system.auxBindings["aux1"]);
});

// ─── Shift+Back Grid Clear ────────────────────────────────────────

test("shift+back clears grid and shows toast", () => {
  let state = makeState();
  state.system.shiftHeld = true;
  state.runtimeConfig.activeBehavior = "life";

  const r = routeInput(state, { type: "button_a", pressed: true } as DeviceInput, mockBehavior);
  state = r.state;

  assert.ok(state.system.toast, "should show toast");
  assert.equal(state.system.toast!.message, "Grid cleared");
  // Behavior state should be re-initialized (all cells false for life behavior)
  // Since we're using mockBehavior here, just verify no error
});

test("shift+back with life behavior reinitializes cells", () => {
  let state = createInitialState(lifeBehavior);
  state.system.oledMode = "normal";
  state.system.shiftHeld = true;
  state.runtimeConfig.activeBehavior = "life";

  // Set some cells on
  const bs = state.behaviorState;
  bs.cells[0] = true;
  bs.cells[10] = true;
  bs.cells[20] = true;

  const r = routeInput(state, { type: "button_a", pressed: true } as DeviceInput, lifeBehavior);
  state = r.state;

  const aliveCount = state.behaviorState.cells.filter(Boolean).length;
  assert.equal(aliveCount, 0, "all cells should be cleared");
  assert.ok(state.system.toast, "should show toast");
});

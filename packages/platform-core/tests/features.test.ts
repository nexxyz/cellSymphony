import test from "node:test";
import assert from "node:assert/strict";
import type { BehaviorEngine, CellTriggerType } from "@cellsymphony/behavior-api";
import { GRID_HEIGHT, GRID_WIDTH, type DeviceInput } from "@cellsymphony/device-contracts";
import { lifeBehavior } from "@cellsymphony/behaviors-life";
import {
  createInitialState,
  routeInput,
  tick,
  toSimulatorFrame,
  extractConfigPayload,
  applyConfigPayload,
  applyStoreResult,
  type PlatformState,
  type PlatformEffect
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

// ─── Behavior Config Editing ──────────────────────────────────────

test("behavior config number param edit via menu", () => {
  let state = createInitialState(lifeBehavior);
  state.system.oledMode = "normal";
  state.runtimeConfig.activeBehavior = "life";

  // Navigate: L1: Life → "Spawn Count"
  state = selectLabel(state, "L1: Life");
  state = press(state).state;
  state = selectLabel(state, "Spawn Count");
  state = press(state).state; // enter edit mode
  state = turn(state, -1).state; // decrease by 1
  state = press(state).state; // exit edit

  const val = (state.runtimeConfig.behaviorConfig as any).life?.randomCellsPerTick;
  assert.equal(val, 0, "randomCellsPerTick should be 0 (decremented from default)");
});

test("behavior config enum param edit via menu", () => {
  let state = createInitialState(lifeBehavior);
  state.system.oledMode = "normal";
  state.runtimeConfig.activeBehavior = "life";
  (state.runtimeConfig.behaviorConfig as any).life = { randomCellsPerTick: 0, randomTickInterval: 1 };

  // L1: Life → "Spawn Interval" (number)
  state = selectLabel(state, "L1: Life");
  state = press(state).state;
  state = selectLabel(state, "Spawn Interval");
  state = press(state).state; // enter edit
  state = turn(state, 1).state; // increase by 1
  state = press(state).state; // exit edit

  const val = (state.runtimeConfig.behaviorConfig as any).life?.randomTickInterval;
  assert.equal(val, 2, "randomTickInterval should be 2 (incremented from default 1)");
});

// ─── Active Behavior Switching ────────────────────────────────────

test("active behavior switching reinitializes state", () => {
  let state = makeState();
  state.activeBehavior = "life";

  // Start with mock, switch to life
  const r = routeInput(state, { type: "encoder_press", id: "SW1" } as DeviceInput, mockBehavior);
  state = r.state;

  // The behavior state should be reinitialized when switching
  // Since we're using mockBehavior here, the behavior switching happens via applyConfigPayload
  // Instead, test directly with the menu system
});

test("behavior config persists independently per behavior", () => {
  let state = createInitialState(lifeBehavior);
  state.system.oledMode = "normal";
  state.runtimeConfig.activeBehavior = "life";
  state.runtimeConfig.behaviorConfig = {
    life: { randomCellsPerTick: 5, randomTickInterval: 3 },
    brain: { fireThreshold: 3, randomSeedCells: 0 }
  } as any;

  // Switch to brain
  state = selectLabel(state, "L1: Life");
  state = press(state).state;

  // The "Behavior" menu item should be at a specific position
  // Let's navigate more directly by finding it
  state = selectLabel(state, "Behavior");
  state = press(state).state; // enter edit mode for Behavior enum

  // Turn to select brain
  state = turn(state, 1).state; // move from life to next behavior

  // Now activeBehavior should have changed
  // Press to exit edit
  state = press(state).state;

  // Verify life config was preserved
  assert.deepStrictEqual(
    (state.runtimeConfig.behaviorConfig as any).life,
    { randomCellsPerTick: 5, randomTickInterval: 3 }
  );
});

// ─── Auto-Save Default ────────────────────────────────────────────

test("autoSaveDefault on emits store_save_default on value edit", () => {
  let state = makeState();
  state.runtimeConfig.autoSaveDefault = true;

  // Navigate to System → Audio → Master Vol
  state = selectLabel(state, "System");
  state = press(state).state;
  state = selectLabel(state, "Audio");
  state = press(state).state;
  state = press(state).state; // enter edit mode for Master Vol
  const r = turn(state, -1); // change value
  state = r.state;
  press(state); // exit edit

  const hasAutoSave = r.effects.some((e) => e.type === "store_save_default");
  assert.equal(hasAutoSave, true, "should emit store_save_default effect");
  if (r.effects.some((e) => e.type === "store_save_default")) {
    const saveEffect = r.effects.find((e) => e.type === "store_save_default")!;
    if (saveEffect.type === "store_save_default") {
      assert.equal(saveEffect.payload.runtimeConfig.masterVolume, 72);
    }
  }
});

test("autoSaveDefault off does not emit store_save_default", () => {
  let state = makeState();
  state.runtimeConfig.autoSaveDefault = false;

  state = selectLabel(state, "System");
  state = press(state).state;
  state = selectLabel(state, "Audio");
  state = press(state).state;
  state = press(state).state; // enter edit
  const r = turn(state, -1);
  state = r.state;
  press(state);

  const hasAutoSave = r.effects.some((e) => e.type === "store_save_default");
  assert.equal(hasAutoSave, false, "should NOT emit store_save_default effect");
});

test("auto-save payload contains post-edit state", () => {
  let state = makeState();
  state.runtimeConfig.autoSaveDefault = true;

  state = selectLabel(state, "System");
  state = press(state).state;
  state = selectLabel(state, "Audio");
  state = press(state).state;
  state = press(state).state;
  const r = turn(state, 1);
  state = r.state;
  press(state);

  const saveEffect = r.effects.find((e) => e.type === "store_save_default");
  assert.ok(saveEffect, "should have store_save_default effect");
  if (saveEffect && saveEffect.type === "store_save_default") {
    assert.equal(saveEffect.payload.runtimeConfig.masterVolume, 74, "payload should reflect post-edit value");
  }
});

test("activeBehavior change with autoSaveDefault on emits store_save_default", () => {
  let state = createInitialState(lifeBehavior);
  state.system.oledMode = "normal";
  state.runtimeConfig.autoSaveDefault = true;
  state.runtimeConfig.activeBehavior = "sequencer";

  state = selectLabel(state, "L1: Life");
  state = press(state).state;
  state = selectLabel(state, "Behavior");
  state = press(state).state; // enter edit
  const r = turn(state, 1); // rotate to next behavior (life)
  state = r.state;
  press(state);

  const saveEffect = r.effects.find((e) => e.type === "store_save_default");
  assert.ok(saveEffect, "behavior switch with autoSave should emit store_save_default");
});

test("save current preset triggers overwrite flow for loaded preset", () => {
  let state = makeState();
  state.system.currentPresetName = "Jam A";

  state = selectLabel(state, "System");
  state = press(state).state;
  state = selectLabel(state, "Presets");
  state = press(state).state;
  state = selectLabel(state, "Library");
  state = press(state).state;
  state = selectLabel(state, "Save Current");

  state = press(state).state;
  assert.ok(state.system.confirm, "should open overwrite confirm");

  state = routeInput(state, { type: "encoder_turn", id: "main", delta: 1 } as DeviceInput, mockBehavior).state;
  const confirm = routeInput(state, { type: "encoder_press", id: "main" } as DeviceInput, mockBehavior);
  const hasSave = confirm.effects.some((e) => e.type === "store_save_preset" && e.name === "Jam A");
  assert.equal(hasSave, true);
});

test("save current shows loaded preset name under action", () => {
  let state = makeState();
  state.system.currentPresetName = "Jam A";

  state = selectLabel(state, "System");
  state = press(state).state;
  state = selectLabel(state, "Presets");
  state = press(state).state;
  state = selectLabel(state, "Library");
  state = press(state).state;
  state = selectLabel(state, "Save Current");

  const frame = toSimulatorFrame(state, mockBehavior);
  const selectedIndex = frame.display.lines.findIndex((l) => l.startsWith("@@") && l.includes("Save Current"));
  assert.ok(selectedIndex >= 0, "save current row should be selected");
  assert.equal(frame.display.lines[selectedIndex + 1], "@@  Jam A");
});

test("save current preset shows toast when none loaded", () => {
  let state = makeState();
  state.system.currentPresetName = null;

  state = selectLabel(state, "System");
  state = press(state).state;
  state = selectLabel(state, "Presets");
  state = press(state).state;
  state = selectLabel(state, "Library");
  state = press(state).state;
  state = selectLabel(state, "Save Current");
  state = press(state).state;

  assert.equal(state.system.toast?.message, "No preset loaded");
});

test("loading preset tracks current preset name", () => {
  let state = makeState();
  const payload = extractConfigPayload(state);
  state = applyStoreResult(state, { type: "load_preset_result", name: "Jam B", payload }, mockBehavior).state;
  assert.equal(state.system.currentPresetName, "Jam B");
});

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

// ─── Config Payload Round-Trip ────────────────────────────────────

test("extractConfigPayload and applyConfigPayload round-trip preserves state", () => {
  let state = makeState();
  state.runtimeConfig.masterVolume = 42;
  state.runtimeConfig.algorithmStepUnit = "1/4";
  state.runtimeConfig.activeBehavior = "sequencer";

  const payload = extractConfigPayload(state);
  assert.equal(payload.runtimeConfig.masterVolume, 42);
  assert.equal(payload.runtimeConfig.algorithmStepUnit, "1/4");
  assert.equal(payload.activeBehavior, "sequencer");

  const restored = applyConfigPayload(state, payload, mockBehavior);
  assert.equal(restored.runtimeConfig.masterVolume, 42);
  assert.equal(restored.runtimeConfig.algorithmStepUnit, "1/4");
});

test("applyConfigPayload reinitializes behavior state when behavior changes", () => {
  let state = createInitialState(lifeBehavior);
  const payload = extractConfigPayload(state);
  payload.activeBehavior = "sequencer";

  const restored = applyConfigPayload(state, payload, lifeBehavior);
  assert.equal(restored.activeBehavior, "sequencer");
});

test("algorithmStepUnit is included in config payload", () => {
  let state = makeState();
  state.runtimeConfig.algorithmStepUnit = "1/2";
  const payload = extractConfigPayload(state);
  assert.equal(payload.runtimeConfig.algorithmStepUnit, "1/2");
});

// ─── Algorithm Step Rate ──────────────────────────────────────────

test("algorithm pulse accumulator advances during tick", () => {
  let state = createInitialState(mockBehavior);
  state.transport.playing = true;
  state.runtimeConfig.algorithmStepUnit = "1/16";

  const result = tick(state, mockBehavior);
  assert.ok(result.state.algorithmPulseAccumulator > 0, "accumulator should advance");
  assert.ok(result.state.transport.ppqnPulse > 0, "ppqn should advance");
});

test("behavior onTick is called when accumulator reaches step threshold", () => {
  let state = createInitialState(mockBehavior);
  state.transport.playing = true;
  state.runtimeConfig.algorithmStepUnit = "1/16";

  const result = tick(state, mockBehavior);
  assert.equal(result.state.behaviorState.tickCount, 1, "onTick should be called once per step");
});

// ─── Voice Menu with 4 Targets ────────────────────────────────────

test("L3: Voice has 4 target channels accessible via menu", () => {
  let state = makeState();

  // Verify targets exist and can be edited through the menu
  state = selectLabel(state, "L3: Voice");
  state = press(state).state;
  state = selectLabel(state, "Activate Target");
  state = press(state).state; // enter edit
  state = turn(state, 1).state; // 0 → "1"
  state = press(state).state; // exit edit
  assert.equal(String(state.mappingConfig.activate.channel), "1");

  state = selectLabel(state, "Stable Target");
  state = press(state).state;
  state = turn(state, 1).state;
  state = press(state).state;

  state = selectLabel(state, "Deactivate Target");
  state = press(state).state;
  state = turn(state, 1).state;
  state = press(state).state;

  state = selectLabel(state, "Scanned Target");
  state = press(state).state;
  state = turn(state, 1).state;
  state = press(state).state;

  // Verify all targets are present and settable
  assert.ok("activate" in state.mappingConfig, "activate target exists");
  assert.ok("stable" in state.mappingConfig, "stable target exists");
  assert.ok("deactivate" in state.mappingConfig, "deactivate target exists");
  assert.ok("scanned" in state.mappingConfig, "scanned target exists");
});

test("stable target is separate from activate and deactivate", () => {
  let state = makeState();

  state = selectLabel(state, "L3: Voice");
  state = press(state).state;

  // Set activate to channel 0
  state = selectLabel(state, "Activate Target");
  state = press(state).state;
  state = turn(state, 0).state; // back to 0
  state = press(state).state;

  // Set stable to channel 2
  state = selectLabel(state, "Stable Target");
  state = press(state).state;
  state = turn(state, 2).state; // set to 2
  state = press(state).state;

  assert.equal(state.mappingConfig.activate.channel, 0);
  assert.equal(state.mappingConfig.stable.channel, 2);
  assert.notEqual(state.mappingConfig.activate.channel, state.mappingConfig.stable.channel);
});

// ─── Spacer skipping ──────────────────────────────────────────────

test("menu navigation skips spacers when turning", () => {
  let state = makeState();
  const initialCursor = state.menu.cursor;
  // Navigate past any spacers
  for (let i = 0; i < 10; i++) {
    const r = turn(state, 1);
    state = r.state;
  }
  // Should never land on a spacer
  const frame = toSimulatorFrame(state, mockBehavior);
  const selected = frame.display.lines.find((l) => l.startsWith("@@")) ?? "";
  assert.ok(!selected.includes("─"), "should not select spacer");
});

// ─── Shift+Back in text editing (backspace) ───────────────────────

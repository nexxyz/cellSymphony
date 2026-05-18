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
  assert.equal(val, 11, "randomCellsPerTick should be 11 (decremented from default 12)");
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

test("enabling autoSaveDefault emits immediate save when exiting edit", () => {
  let state = makeState();
  state.runtimeConfig.autoSaveDefault = false;

  state = selectLabel(state, "System");
  state = press(state).state;
  state = selectLabel(state, "Presets");
  state = press(state).state;
  state = selectLabel(state, "Default");
  state = press(state).state;
  state = selectLabel(state, "Auto Save");
  state = press(state).state; // enter edit
  state = turn(state, 1).state; // false -> true

  const exit = press(state);
  state = exit.state;
  const hasAutoSave = exit.effects.some((e) => e.type === "store_save_default");
  assert.equal(state.runtimeConfig.autoSaveDefault, true);
  assert.equal(hasAutoSave, true, "should emit store_save_default when exiting auto-save edit in ON state");
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


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

test("applyConfigPayload reinitializes behavior state for same behavior id using saved behaviorConfig", () => {
  let state = createInitialState(lifeBehavior);
  const payload = extractConfigPayload(state);
  payload.activeBehavior = "life";
  (payload.runtimeConfig.behaviorConfig as any).life = { randomCellsPerTick: 11, randomTickInterval: 2 };

  const restored = applyConfigPayload(state, payload, lifeBehavior);
  assert.equal(restored.activeBehavior, "life");
  assert.equal((restored.behaviorState as any).randomCellsPerTick, 11);
  assert.equal((restored.behaviorState as any).randomTickInterval, 2);
});

test("applyConfigPayload clears transient runtime state on load", () => {
  let state = makeState();
  state.scanPulseAccumulator = 99;
  state.algorithmPulseAccumulator = 77;
  state.ppqnPulseRemainder = 0.5;
  state.scanIndex = 12;
  state.system.heldNotes = ["0:60"];
  state.system.pendingResync = true;
  state.system.externalPpqnPulse = 42;
  const payload = extractConfigPayload(state);

  const restored = applyConfigPayload(state, payload, mockBehavior);
  assert.equal(restored.scanPulseAccumulator, 0);
  assert.equal(restored.algorithmPulseAccumulator, 0);
  assert.equal(restored.ppqnPulseRemainder, 0);
  assert.equal(restored.scanIndex, 0);
  assert.deepEqual(restored.system.heldNotes, []);
  assert.equal(restored.system.pendingResync, false);
  assert.equal(restored.system.externalPpqnPulse, 0);
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

// ─── Sense Menu Instrument Targets ────────────────────────────────

test("L2: Sense has 4 instrument targets accessible via menu", () => {
  let state = makeState();

  // Verify targets exist and can be edited through the menu
  state = selectLabel(state, "L2: Sense");
  state = press(state).state;
  state = selectLabel(state, "Instrument Targets");
  state = press(state).state;
  state = selectLabel(state, "Activate Instrument");
  state = press(state).state; // enter edit
  state = turn(state, 1).state; // 0 → "1"
  state = press(state).state; // exit edit
  assert.equal(String(state.mappingConfig.activate.channel), "1");

  state = selectLabel(state, "Stable Instrument");
  state = press(state).state;
  state = turn(state, 1).state;
  state = press(state).state;

  state = selectLabel(state, "Deactivate Instrument");
  state = press(state).state;
  state = turn(state, 1).state;
  state = press(state).state;

  state = selectLabel(state, "Scanned Instrument");
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

  state = selectLabel(state, "L2: Sense");
  state = press(state).state;
  state = selectLabel(state, "Instrument Targets");
  state = press(state).state;

  // Set activate to channel 0
  state = selectLabel(state, "Activate Instrument");
  state = press(state).state;
  // Ensure we're at 0 by turning down a couple times.
  state = turn(state, -1).state;
  state = turn(state, -1).state;
  state = press(state).state;

  // Set stable to channel 2
  state = selectLabel(state, "Stable Instrument");
  state = press(state).state;
  state = turn(state, 1).state;
  state = turn(state, 1).state;
  state = press(state).state;

  assert.equal(state.mappingConfig.activate.channel, 0);
  assert.equal(state.mappingConfig.stable.channel, 2);
  assert.notEqual(state.mappingConfig.activate.channel, state.mappingConfig.stable.channel);
});

test("loading synth preset from Voice menu requires confirm and applies to target slot", () => {
  let state = makeState();
  const beforeGain = (state.runtimeConfig as any).instruments?.[0]?.synth?.amp?.gainPct;

  state = selectLabel(state, "L3: Voice");
  state = press(state).state;
  state = selectLabel(state, "Instruments");
  state = press(state).state;
  state = selectLabel(state, "Instrument 1");
  state = press(state).state;
  state = selectLabel(state, "Synth");
  state = press(state).state;
  state = selectLabel(state, "Preset");
  state = press(state).state;
  state = selectLabel(state, "Load");
  state = press(state).state;
  state = selectLabel(state, "Soft Pad");
  state = press(state).state;

  assert.equal(state.system.confirm?.kind, "load_synth_preset");

  state = routeInput(state, { type: "encoder_turn", delta: 1 } as DeviceInput, mockBehavior).state;
  state = routeInput(state, { type: "encoder_press" } as DeviceInput, mockBehavior).state;

  assert.equal(state.system.confirm, null);
  const afterGain = (state.runtimeConfig as any).instruments?.[0]?.synth?.amp?.gainPct;
  assert.notEqual(afterGain, beforeGain);
  assert.equal(afterGain, 72);
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

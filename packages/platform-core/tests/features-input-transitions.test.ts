import test from "node:test";
import assert from "node:assert/strict";
import type { BehaviorEngine } from "@cellsymphony/behavior-api";
import { type DeviceInput } from "@cellsymphony/device-contracts";
import {
  createInitialState,
  PLATFORM_CAPS,
  routeInput,
  type PlatformEffect,
  type PlatformState
} from "../src/index";

const CELL_COUNT = PLATFORM_CAPS.gridWidth * PLATFORM_CAPS.gridHeight;

type InputTestState = { cells: boolean[]; triggerTypes: import("@cellsymphony/behavior-api").CellTriggerType[] };

const interpretingBehavior: BehaviorEngine<InputTestState, unknown> = {
  id: "interpreting",
  interpretInputTransitions: true,
  init: () => ({
    cells: new Array(CELL_COUNT).fill(false),
    triggerTypes: new Array(CELL_COUNT).fill("none")
  }),
  onInput: (state, input) => {
    if (input.type !== "grid_press" && input.type !== "grid_release") return state;
    const cells = state.cells.slice();
    const tt = ([] as import("@cellsymphony/behavior-api").CellTriggerType[]).concat(state.triggerTypes);
    const idx = input.y * PLATFORM_CAPS.gridWidth + input.x;
    if (input.type === "grid_press") {
      cells[idx] = true;
      tt[idx] = "activate";
    } else {
      cells[idx] = false;
      tt[idx] = "deactivate";
    }
    return { cells, triggerTypes: tt };
  },
  onTick: (state) => state,
  renderModel: (state) => ({
    name: "Interpreting",
    statusLine: "Test",
    cells: state.cells,
    triggerTypes: state.triggerTypes
  }),
  serialize: (state) => state,
  deserialize: (data) => data as InputTestState
};

const nonInterpretingBehavior: BehaviorEngine<InputTestState, unknown> = {
  ...interpretingBehavior,
  id: "non-interpreting",
  interpretInputTransitions: false
};

function makeState(behavior: BehaviorEngine<InputTestState, unknown>): PlatformState<InputTestState> {
  const s = createInitialState(behavior);
  s.system.oledMode = "normal";
  return s;
}

test("interpreting behavior produces musical events on grid_press", () => {
  const state = makeState(interpretingBehavior);
  const result = routeInput(state, { type: "grid_press", x: 2, y: 3 } as DeviceInput, interpretingBehavior);
  const events = result.events;
  assert.ok(events.length > 0, "should produce at least one event");
  const noteOn = events.find((e) => e.type === "note_on");
  assert.ok(noteOn, "expected a note_on event from grid_press activate transition");
});

test("interpreting behavior produces note_off musical events on grid_release", () => {
  let state = makeState(interpretingBehavior);
  state = routeInput(state, { type: "grid_press", x: 2, y: 3 } as DeviceInput, interpretingBehavior).state;
  const result = routeInput(state, { type: "grid_release", x: 2, y: 3 } as DeviceInput, interpretingBehavior);
  const events = result.events;
  assert.ok(events.length > 0, "should produce at least one event");
  const noteOff = events.find((e) => e.type === "note_off");
  assert.ok(noteOff, "expected a note_off event from grid_release deactivate transition");
});

test("non-interpreting behavior does not produce events on grid_press", () => {
  const state = makeState(nonInterpretingBehavior);
  const result = routeInput(state, { type: "grid_press", x: 2, y: 3 } as DeviceInput, nonInterpretingBehavior);
  assert.equal(result.events.length, 0, "non-interpreting behavior should not produce events on input");
});

test("grid_release does not break existing input routing", () => {
  const state = makeState(interpretingBehavior);
  const result1 = routeInput(state, { type: "grid_release", x: 2, y: 3 } as DeviceInput, interpretingBehavior);
  assert.ok(result1, "should return a result");
  assert.ok(result1.state, "should return a state");
});

test("interpreting behavior events respect eventEnabled=false", () => {
  let state = makeState(interpretingBehavior);
  state.runtimeConfig.eventEnabled = false;
  const result = routeInput(state, { type: "grid_press", x: 2, y: 3 } as DeviceInput, interpretingBehavior);
  assert.equal(result.events.filter(e => e.type === "note_on").length, 0, "should not produce note_on when eventEnabled is false");
});

test("interpreting behavior fires events while paused with inputEventsWhilePaused=true (default)", () => {
  const state = makeState(interpretingBehavior);
  assert.equal(state.transport.playing, false, "transport starts stopped");
  assert.equal(state.runtimeConfig.inputEventsWhilePaused, true, "default is true");
  const result = routeInput(state, { type: "grid_press", x: 2, y: 4 } as DeviceInput, interpretingBehavior);
  assert.ok(result.events.filter(e => e.type === "note_on").length > 0, "should produce note_on while paused when inputEventsWhilePaused is true");
});

test("interpreting behavior suppresses events while paused when inputEventsWhilePaused=false", () => {
  let state = makeState(interpretingBehavior);
  state.transport.playing = false;
  state.runtimeConfig.inputEventsWhilePaused = false;
  const result = routeInput(state, { type: "grid_press", x: 2, y: 5 } as DeviceInput, interpretingBehavior);
  assert.equal(result.events.filter(e => e.type === "note_on").length, 0, "should not produce note_on while paused when inputEventsWhilePaused is false");
});

test("interpreting behavior fires events while playing regardless of inputEventsWhilePaused", () => {
  let state = makeState(interpretingBehavior);
  state.transport.playing = true;
  state.runtimeConfig.inputEventsWhilePaused = false;
  const result = routeInput(state, { type: "grid_press", x: 2, y: 6 } as DeviceInput, interpretingBehavior);
  assert.ok(result.events.filter(e => e.type === "note_on").length > 0, "should produce note_on while playing even when inputEventsWhilePaused is false");
});

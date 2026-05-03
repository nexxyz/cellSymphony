import test from "node:test";
import assert from "node:assert/strict";

import type { BehaviorEngine } from "@cellsymphony/behavior-api";
import type { DeviceInput } from "@cellsymphony/device-contracts";
import { GRID_HEIGHT, GRID_WIDTH } from "@cellsymphony/device-contracts";
import { interpretGrid, type GridSnapshot } from "@cellsymphony/interpretation-core";
import { loadDefaultMappingConfig, mapIntentsToMusicalEvents } from "@cellsymphony/mapping-core";
import { createInitialState, OLED_TEXT_COLUMNS, routeInput, tick, toOledLines, toSimulatorFrame } from "../src/index";

type MockState = {
  cells: boolean[];
  tickCount: number;
};

const CELL_COUNT = GRID_WIDTH * GRID_HEIGHT;

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

test("interpretation supports event and state trigger paths", () => {
  const previous: GridSnapshot = { width: 2, height: 2, cells: [false, false, false, true] };
  const next: GridSnapshot = { width: 2, height: 2, cells: [true, false, false, false] };

  const intents = interpretGrid(previous, next, 0, {
    id: "test",
    event: { enabled: true, parity: "none" },
    state: { enabled: true, tick: { mode: "scan_column_active" } },
    x: { mode: "scale_step", step: 1 },
    y: { mode: "scale_step", step: 3 }
  });

  assert.equal(intents.length, 3);
  assert.deepEqual(intents.map((i) => i.kind).sort(), ["birth", "death", "state_on"]);
});

test("mapping routes trigger kinds to configured targets", () => {
  const mapping = loadDefaultMappingConfig();
  const events = mapIntentsToMusicalEvents(
    [
      { x: 0, y: 0, degree: 0, kind: "birth" },
      { x: 1, y: 0, degree: 1, kind: "death" },
      { x: 2, y: 0, degree: 2, kind: "state_on" }
    ],
    mapping
  );

  assert.equal(events.length, 3);
  assert.equal(events[0].type, "note_on");
  assert.equal(events[1].type, "note_on");
  assert.equal(events[2].type, "note_on");
  if (events[0].type === "note_on" && events[1].type === "note_on" && events[2].type === "note_on") {
    assert.equal(events[0].channel, mapping.birth.channel);
    assert.equal(events[1].channel, mapping.death.channel);
    assert.equal(events[2].channel, mapping.state.channel);
  }
});

test("menu navigation edits runtime config through hardware-parity inputs", () => {
  let state = createInitialState(mockBehavior);

  const input = (i: DeviceInput) => {
    state = routeInput(state, i, mockBehavior).state;
  };

  input({ type: "encoder_turn", delta: 1 });
  input({ type: "encoder_press" });
  input({ type: "encoder_press" });
  input({ type: "encoder_turn", delta: -1 });
  input({ type: "encoder_press" });

  assert.equal(state.runtimeConfig.masterVolume, 72);
  const frame = toSimulatorFrame(state, mockBehavior);
  assert.equal(frame.display.editing, false);
});

test("scan mode advances cursor using PPQN timing", () => {
  let state = createInitialState(mockBehavior);
  state.transport.playing = true;
  state.runtimeConfig.scanMode = "scanning";
  state.runtimeConfig.scanAxis = "columns";
  state.runtimeConfig.scanDirection = "forward";
  state.runtimeConfig.scanUnit = "1/16";

  state = tick(state, mockBehavior).state;

  assert.equal(state.scanIndex, 1);
});

test("aux encoder inputs are reserved and do not navigate menu", () => {
  let state = createInitialState(mockBehavior);
  state = routeInput(state, { type: "encoder_turn", delta: 1, id: "aux1" }, mockBehavior).state;
  assert.equal(state.menu.cursor, 0);

  state = routeInput(state, { type: "encoder_press", id: "aux2" }, mockBehavior).state;
  assert.deepEqual(state.menu.stack, []);
});

test("OLED formatter clamps display lines and width", () => {
  const lines = toOledLines({
    page: "Transport",
    title: "Cell Symphony Super Long Header",
    editing: false,
    lines: ["line one", "line two", "line three", "line four"]
  });

  assert.equal(lines.length, 4);
  assert.equal(lines[0].length, OLED_TEXT_COLUMNS);
  assert.equal(lines[3], "line three");
});

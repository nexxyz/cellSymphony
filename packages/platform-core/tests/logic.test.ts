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

test("scanning mode emits notes only when scan index advances", () => {
  let state = createInitialState(mockBehavior);
  state.transport.playing = true;
  state.runtimeConfig.scanMode = "scanning";
  state.runtimeConfig.scanAxis = "columns";
  state.runtimeConfig.scanDirection = "forward";
  state.runtimeConfig.scanUnit = "1/1";
  state.runtimeConfig.populationMode = "grid";

  const first = tick(state, mockBehavior);
  assert.equal(first.state.scanIndex, 0);
  assert.equal(first.events.some((e) => e.type === "note_on"), false);

  const second = tick(first.state, mockBehavior);
  assert.equal(second.state.scanIndex, 0);
  assert.equal(second.events.some((e) => e.type === "note_on"), false);
});

test("grid brightness scales rendered LED intensity", () => {
  let state = createInitialState(mockBehavior);
  state.runtimeConfig.gridBrightness = 20;
  const dim = toSimulatorFrame(state, mockBehavior);
  state.runtimeConfig.gridBrightness = 100;
  const bright = toSimulatorFrame(state, mockBehavior);
  const dimTotal = dim.leds.cells.reduce((sum, c) => sum + c.r + c.g + c.b, 0);
  const brightTotal = bright.leds.cells.reduce((sum, c) => sum + c.r + c.g + c.b, 0);
  assert.ok(brightTotal > dimTotal);
});

test("velocity modulation mode changes output velocity", () => {
  let state = createInitialState(mockBehavior);
  state.transport.playing = true;
  state.runtimeConfig.populationMode = "conway";
  state.runtimeConfig.conwayStepUnit = "1/16";
  state.runtimeConfig.eventParity = "none";
  state.runtimeConfig.x.velocity.enabled = true;
  state.runtimeConfig.x.velocity.from = 20;
  state.runtimeConfig.x.velocity.to = 100;
  const result = tick(state, mockBehavior);
  const note = result.events.find((e) => e.type === "note_on");
  assert.ok(note && note.type === "note_on");
  if (note && note.type === "note_on") {
    assert.ok(note.velocity >= 20 && note.velocity <= 100);
  }
});

test("filter modulation mode emits cutoff/resonance CC", () => {
  let state = createInitialState(mockBehavior);
  state.transport.playing = true;
  state.runtimeConfig.populationMode = "conway";
  state.runtimeConfig.conwayStepUnit = "1/16";
  state.runtimeConfig.eventParity = "none";
  state.runtimeConfig.x.filterCutoff.enabled = true;
  state.runtimeConfig.y.filterResonance.enabled = true;
  const result = tick(state, mockBehavior);
  const hasCutoff = result.events.some((e) => e.type === "cc" && e.controller === 74);
  const hasResonance = result.events.some((e) => e.type === "cc" && e.controller === 71);
  assert.equal(hasCutoff, true);
  assert.equal(hasResonance, true);

  const firstNote = result.events.findIndex((e) => e.type === "note_on");
  const firstCutoff = result.events.findIndex((e) => e.type === "cc" && e.controller === 74);
  assert.ok(firstCutoff !== -1 && firstNote !== -1 && firstCutoff < firstNote);

  const note = result.events.find((e) => e.type === "note_on");
  const cc = result.events.find((e) => e.type === "cc" && e.controller === 74);
  if (note && note.type === "note_on" && cc && cc.type === "cc") {
    assert.equal(cc.channel, note.channel);
  }
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

  assert.equal(lines.length, 5);
  assert.equal(lines[0].length, OLED_TEXT_COLUMNS);
  assert.equal(lines[lines.length - 1], "line four");
});

test("edit marker uses compact star prefix", () => {
  let state = createInitialState(mockBehavior);
  state = routeInput(state, { type: "encoder_turn", delta: 1 }, mockBehavior).state;
  state = routeInput(state, { type: "encoder_press" }, mockBehavior).state;
  state = routeInput(state, { type: "encoder_press" }, mockBehavior).state;
  const frame = toSimulatorFrame(state, mockBehavior);
  const hasStarEdit = frame.display.lines.some((line) => line.includes("*Vol:"));
  assert.equal(hasStarEdit, true);
});

test("modulation mode labels are user-facing", () => {
  let state = createInitialState(mockBehavior);
  state.runtimeConfig.x.filterCutoff.enabled = true;
  const frame = toSimulatorFrame(state, mockBehavior);
  const rendered = frame.display.lines.join(" ");
  assert.equal(rendered.includes("filter_cutoff"), false);
});

test("additive pitch uses shared starting/lowest/highest", () => {
  let state = createInitialState(mockBehavior);
  state.transport.playing = true;
  state.runtimeConfig.populationMode = "conway";
  state.runtimeConfig.conwayStepUnit = "1/16";
  state.runtimeConfig.eventParity = "none";
  state.runtimeConfig.pitch.startingNote = 60;
  state.runtimeConfig.pitch.lowestNote = 48;
  state.runtimeConfig.pitch.highestNote = 84;
  state.runtimeConfig.pitch.outOfRange = "clamp";
  state.runtimeConfig.x.pitch.enabled = true;
  state.runtimeConfig.x.pitch.steps = 1;
  state.runtimeConfig.y.pitch.enabled = true;
  state.runtimeConfig.y.pitch.steps = 8;

  const result = tick(state, mockBehavior);
  const note = result.events.find((e) => e.type === "note_on");
  assert.ok(note && note.type === "note_on");
  if (note && note.type === "note_on") {
    assert.ok(note.note >= 48 && note.note <= 84);
  }
});

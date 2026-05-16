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

  assert.deepEqual(intents.map((i) => i.kind).sort(), ["activate", "deactivate", "scanned"]);
});

test("mapping routes trigger kinds to configured targets", () => {
  const mapping = loadDefaultMappingConfig();
  const events = mapIntentsToMusicalEvents(
    [
      { x: 0, y: 0, degree: 0, kind: "activate" },
      { x: 1, y: 0, degree: 1, kind: "deactivate" },
      { x: 2, y: 0, degree: 2, kind: "scanned" }
    ],
    mapping
  );

  assert.equal(events.length, 3);
  assert.equal(events[0].type, "note_on");
  assert.equal(events[1].type, "note_on");
  assert.equal(events[2].type, "note_on");
  if (events[0].type === "note_on" && events[1].type === "note_on" && events[2].type === "note_on") {
    assert.equal(events[0].channel, mapping.activate.channel);
    assert.equal(events[1].channel, mapping.deactivate.channel);
    assert.equal(events[2].channel, mapping.scanned.channel);
  }
});

test("menu navigation edits runtime config through hardware-parity inputs", () => {
  let state = createInitialState(mockBehavior);
  state.system.oledMode = "normal";

  const turn = (delta: number) => {
    state = routeInput(state, { type: "encoder_turn", delta }, mockBehavior).state;
  };

  const press = () => {
    state = routeInput(state, { type: "encoder_press" }, mockBehavior).state;
  };

  const selectLabel = (label: string) => {
    for (let i = 0; i < 80; i += 1) {
      const frame = toSimulatorFrame(state, mockBehavior);
      const selected = frame.display.lines.find((l) => l.startsWith("@@> ")) ?? "";
      if (selected.includes(label)) return;
      turn(1);
    }
    assert.fail(`failed to select label: ${label}`);
  };

  // System -> Audio -> Master Vol
  selectLabel("System");
  press();
  selectLabel("Audio");
  press();
  press();
  turn(-1);
  press();

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
  state.runtimeConfig.algorithmStepUnit = "1/16";
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
  state.runtimeConfig.algorithmStepUnit = "1/16";
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
  state.system.oledMode = "normal";
  state = routeInput(state, { type: "encoder_turn", delta: 1, id: "aux1" }, mockBehavior).state;
  assert.equal(state.menu.cursor, 0);

  state = routeInput(state, { type: "encoder_press", id: "aux2" }, mockBehavior).state;
  assert.deepEqual(state.menu.stack, []);
});

test("OLED formatter clamps display lines and width", () => {
  const result = toOledLines({
    page: "Transport",
    title: "Cell Symphony Super Long Header",
    editing: false,
    lines: ["line one", "line two", "line three", "line four"]
  });

  assert.equal(result.lines.length, 5);
  assert.equal(result.lines[0].length, OLED_TEXT_COLUMNS);
  assert.equal(result.lines[result.lines.length - 1], "line four");
});

test("OLED formatter does not truncate selected marker lines that fit visually", () => {
  const result = toOledLines({
    page: "System/MIDI",
    title: "System/MIDI",
    editing: false,
    lines: ["@@> Respond Start/Stop", "@@> !Spawn Random [S]"]
  });

  assert.equal(result.lines[1], "@@> Respond Start/Stop");
  assert.equal(result.lines[2], "@@> !Spawn Random [S]");
});

test("OLED formatter still truncates truly long selected lines", () => {
  const result = toOledLines({
    page: "System/MIDI",
    title: "System/MIDI",
    editing: false,
    lines: ["@@> This selection label is definitely too long"]
  });

  assert.equal(result.lines[1].startsWith("@@"), true);
  assert.equal(result.lines[1].slice(2).length, OLED_TEXT_COLUMNS);
  assert.equal(result.lines[1].slice(2).endsWith("..."), true);
});

test("edit marker uses compact star prefix", () => {
  let state = createInitialState(mockBehavior);
  state.system.oledMode = "normal";

  const turn = (delta: number) => {
    state = routeInput(state, { type: "encoder_turn", delta }, mockBehavior).state;
  };

  const press = () => {
    state = routeInput(state, { type: "encoder_press" }, mockBehavior).state;
  };

  const selectLabel = (label: string) => {
    for (let i = 0; i < 80; i += 1) {
      const frame = toSimulatorFrame(state, mockBehavior);
      const selected = frame.display.lines.find((l) => l.startsWith("@@> ")) ?? "";
      if (selected.includes(label)) return;
      turn(1);
    }
    assert.fail(`failed to select label: ${label}`);
  };

  selectLabel("System");
  press();
  selectLabel("Audio");
  press();
  // Master Vol
  press();
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
  state.runtimeConfig.algorithmStepUnit = "1/16";
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

test("default note mapping range is C2 to C6 with C3 start", () => {
  const state = createInitialState(mockBehavior);
  assert.equal(state.runtimeConfig.pitch.lowestNote, 36);
  assert.equal(state.runtimeConfig.pitch.startingNote, 48);
  assert.equal(state.runtimeConfig.pitch.highestNote, 84);
});

test("config save default requires confirmation before emitting effect", () => {
  let state = createInitialState(mockBehavior);
  state.system.oledMode = "normal";

  const turn = (delta: number) => {
    state = routeInput(state, { type: "encoder_turn", delta }, mockBehavior).state;
  };

  const press = (): { effects: any[] } => {
    const r = routeInput(state, { type: "encoder_press" }, mockBehavior);
    state = r.state;
    return r as any;
  };

  const selectLabel = (label: string) => {
    for (let i = 0; i < 80; i += 1) {
      const frame = toSimulatorFrame(state, mockBehavior);
      const selected = frame.display.lines.find((l) => l.startsWith("@@> ")) ?? "";
      if (selected.includes(label)) return;
      turn(1);
    }
    assert.fail(`failed to select label: ${label}`);
  };

  selectLabel("System");
  press();
  selectLabel("Presets");
  press();
  selectLabel("Default");
  press();

  // Cursor 0 should be Save Default.
  const before = press();
  assert.equal(before.effects.length, 0);
  assert.ok(state.system.confirm);

  // Choose Yes and confirm.
  turn(1);
  const confirmed = press();
  assert.ok(confirmed.effects.some((e) => e.type === "store_save_default"));
});

test("entering MIDI Out/In menu requests port lists", () => {
  let state = createInitialState(mockBehavior);
  state.system.oledMode = "normal";

  const turn = (delta: number) => {
    state = routeInput(state, { type: "encoder_turn", delta }, mockBehavior).state;
  };

  const press = (): { effects: any[] } => {
    const r = routeInput(state, { type: "encoder_press" }, mockBehavior);
    state = r.state;
    return r as any;
  };

  const selectLabel = (label: string) => {
    for (let i = 0; i < 80; i += 1) {
      const frame = toSimulatorFrame(state, mockBehavior);
      const selected = frame.display.lines.find((l) => l.startsWith("@@> ")) ?? "";
      if (selected.includes(label)) return;
      turn(1);
    }
    assert.fail(`failed to select label: ${label}`);
  };

  // System -> MIDI -> MIDI Out
  selectLabel("System");
  press();
  selectLabel("MIDI");
  press();
  selectLabel("MIDI Out");
  const out = press();
  assert.ok(out.effects.some((e) => e.type === "midi_list_outputs_request"));

  // Back to MIDI group and enter MIDI In
  state = routeInput(state, { type: "button_a" }, mockBehavior).state;
  selectLabel("MIDI In");
  const inn = press();
  assert.ok(inn.effects.some((e) => e.type === "midi_list_inputs_request"));
});

test("shift+back deletes character when editing draft name", () => {
  let state = createInitialState(mockBehavior);
  state.system.oledMode = "normal";

  const turn = (delta: number) => {
    state = routeInput(state, { type: "encoder_turn", delta }, mockBehavior).state;
  };

  const press = () => {
    state = routeInput(state, { type: "encoder_press" }, mockBehavior).state;
  };

  const selectLabel = (label: string) => {
    for (let i = 0; i < 80; i += 1) {
      const frame = toSimulatorFrame(state, mockBehavior);
      const selected = frame.display.lines.find((l) => l.startsWith("@@> ")) ?? "";
      if (selected.includes(label)) return;
      turn(1);
    }
    assert.fail(`failed to select label: ${label}`);
  };

  selectLabel("System");
  press();
  selectLabel("Presets");
  press();
  selectLabel("Library");
  press();
  selectLabel("Save As");
  press();
  selectLabel("Name");
  press(); // enter editing

  state.system.draftName = "AB";
  state.system.nameCursor = 2;

  // Hold shift then press back.
  state = routeInput(state, { type: "button_shift", pressed: true }, mockBehavior).state;
  state = routeInput(state, { type: "button_a" }, mockBehavior).state;
  assert.equal(state.system.draftName, "A");
});

test("external MIDI Start resets engine and clears pending resync", () => {
  let state = createInitialState(mockBehavior);
  state.system.oledMode = "normal";
  state.runtimeConfig.midi.syncMode = "external";
  state.runtimeConfig.midi.clockInEnabled = true;
  state.runtimeConfig.midi.respondToStartStop = true;

  state.transport.playing = false;
  state.transport.ppqnPulse = 123;
  state.transport.tick = 77;
  state.scanIndex = 5;
  state.system.externalPpqnPulse = 999;
  state.system.pendingResync = true;

  state = routeInput(state, { type: "midi_start" }, mockBehavior).state;
  assert.equal(state.transport.playing, true);
  assert.equal(state.transport.ppqnPulse, 0);
  assert.equal(state.transport.tick, 0);
  assert.equal(state.scanIndex, 0);
  assert.equal(state.system.externalPpqnPulse, 0);
  assert.equal(state.system.pendingResync, false);
});

test("external MIDI Continue resumes without resetting position", () => {
  let state = createInitialState(mockBehavior);
  state.system.oledMode = "normal";
  state.runtimeConfig.midi.syncMode = "external";
  state.runtimeConfig.midi.clockInEnabled = true;
  state.runtimeConfig.midi.respondToStartStop = true;

  state.transport.playing = false;
  state.transport.ppqnPulse = 55;
  state.transport.tick = 10;
  state.scanIndex = 3;
  state.system.externalPpqnPulse = 222;
  state.system.pendingResync = true;

  state = routeInput(state, { type: "midi_continue" }, mockBehavior).state;
  assert.equal(state.transport.playing, true);
  assert.equal(state.transport.ppqnPulse, 55);
  assert.equal(state.transport.tick, 10);
  assert.equal(state.scanIndex, 3);
  assert.equal(state.system.externalPpqnPulse, 222);
  assert.equal(state.system.pendingResync, true);
});

test("external MIDI Start does nothing while pausedByUser is set", () => {
  let state = createInitialState(mockBehavior);
  state.system.oledMode = "normal";
  state.runtimeConfig.midi.syncMode = "external";
  state.runtimeConfig.midi.clockInEnabled = true;
  state.runtimeConfig.midi.respondToStartStop = true;

  state.transport.playing = false;
  state.transport.ppqnPulse = 44;
  state.scanIndex = 2;
  state.system.externalPpqnPulse = 88;
  state.system.pendingResync = true;
  state.system.pausedByUser = true;

  state = routeInput(state, { type: "midi_start" }, mockBehavior).state;
  assert.equal(state.transport.playing, false);
  assert.equal(state.transport.ppqnPulse, 44);
  assert.equal(state.scanIndex, 2);
  assert.equal(state.system.externalPpqnPulse, 88);
  assert.equal(state.system.pendingResync, true);
});

test("external MIDI clock advances external position even when locally paused", () => {
  let state = createInitialState(mockBehavior);
  state.system.oledMode = "normal";
  state.runtimeConfig.midi.syncMode = "external";
  state.runtimeConfig.midi.clockInEnabled = true;
  state.transport.playing = false;
  state.system.externalPpqnPulse = 0;

  const result = routeInput(state, { type: "midi_clock", pulses: 24 }, mockBehavior);
  assert.equal(result.events.length, 0);
  assert.equal(result.state.system.externalPpqnPulse, 24);
});

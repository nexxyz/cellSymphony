import test from "node:test";
import assert from "node:assert/strict";

import type { BehaviorEngine } from "@cellsymphony/behavior-api";
import type { DeviceInput } from "@cellsymphony/device-contracts";
import { GRID_HEIGHT, GRID_WIDTH } from "@cellsymphony/device-contracts";
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
      const selected = frame.display.lines.find((l) => l.startsWith("@@")) ?? "";
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
  state.runtimeConfig.pitch.startingNote = 60;
  state.runtimeConfig.pitch.lowestNote = 48;
  state.runtimeConfig.pitch.highestNote = 84;
  state.runtimeConfig.pitch.outOfRange = "clamp";
  state.mappingConfig.deactivate.action = "note_on";
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

test("default note mapping range is C2 to D5 with C4 start", () => {
  const state = createInitialState(mockBehavior);
  assert.equal(state.runtimeConfig.pitch.lowestNote, 36);
  assert.equal(state.runtimeConfig.pitch.startingNote, 60);
  assert.equal(state.runtimeConfig.pitch.highestNote, 74);
});

test("default axis pitch steps are x=0 and y=1", () => {
  const state = createInitialState(mockBehavior);
  assert.equal(state.runtimeConfig.x.pitch.steps, 0);
  assert.equal(state.runtimeConfig.y.pitch.steps, 1);
});

test("default State Notes is on for all parts", () => {
  const state = createInitialState(mockBehavior) as any;
  const parts = Array.isArray(state.runtimeConfig.parts) ? state.runtimeConfig.parts : [];
  assert.equal(parts.length, 8);
  for (const part of parts) {
    assert.equal(part?.l2?.stateEnabled, true);
  }
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
      const selected = frame.display.lines.find((l) => l.startsWith("@@")) ?? "";
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
  const saveEffect = confirmed.effects.find((e) => e.type === "store_save_default");
  assert.ok(saveEffect);
  assert.equal(saveEffect?.type === "store_save_default" ? saveEffect.mode : undefined, "immediate");
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
      const selected = frame.display.lines.find((l) => l.startsWith("@@")) ?? "";
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
      const selected = frame.display.lines.find((l) => l.startsWith("@@")) ?? "";
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

test("Fn+left-column grid press selects active part", () => {
  let state = createInitialState(mockBehavior);
  state.system.oledMode = "normal";
  state = routeInput(state, { type: "button_fn", pressed: true }, mockBehavior).state;
  state = routeInput(state, { type: "grid_press", x: 0, y: 3 }, mockBehavior).state;
  assert.equal((state.runtimeConfig as any).activePartIndex, 3);
  assert.equal(state.system.toast?.message, "Part 4");
});

test("Fn+Shift+Enter opens contextual help popup", () => {
  let state = createInitialState(mockBehavior);
  state.system.oledMode = "normal";

  state = routeInput(state, { type: "button_shift", pressed: true }, mockBehavior).state;
  state = routeInput(state, { type: "button_fn", pressed: true }, mockBehavior).state;
  state = routeInput(state, { type: "encoder_press", id: "main" }, mockBehavior).state;

  assert.equal(state.system.confirm?.kind, "help_info");
  assert.equal(state.system.confirm?.options[0], "Close");
  assert.equal(state.system.confirm?.scroll, 0);
});

test("help popup turn scrolls and enter closes without executing menu action", () => {
  let state = createInitialState(mockBehavior);
  state.system.oledMode = "normal";
  state.menu.cursor = 5; // System at root

  state = routeInput(state, { type: "button_shift", pressed: true }, mockBehavior).state;
  state = routeInput(state, { type: "button_fn", pressed: true }, mockBehavior).state;
  state = routeInput(state, { type: "encoder_press", id: "main" }, mockBehavior).state;

  assert.equal(state.system.confirm?.kind, "help_info");
  if (state.system.confirm?.action.kind === "help_info") {
    state.system.confirm = {
      ...state.system.confirm,
      action: { ...state.system.confirm.action, lines: ["l1", "l2", "l3", "l4", "l5", "l6", "l7", "l8"] },
      scroll: 0
    };
  }

  state = routeInput(state, { type: "encoder_turn", id: "main", delta: 1 }, mockBehavior).state;
  assert.equal(state.system.confirm?.scroll, 1);

  state = routeInput(state, { type: "encoder_turn", id: "main", delta: -1 }, mockBehavior).state;
  assert.equal(state.system.confirm?.scroll, 0);

  for (let i = 0; i < 20; i += 1) {
    state = routeInput(state, { type: "encoder_turn", id: "main", delta: 1 }, mockBehavior).state;
  }
  assert.ok((state.system.confirm?.scroll ?? 0) > 0, "scroll should advance with turns");

  for (let i = 0; i < 20; i += 1) {
    state = routeInput(state, { type: "encoder_turn", id: "main", delta: -1 }, mockBehavior).state;
  }
  assert.equal(state.system.confirm?.scroll, 0, "scroll should clamp at top");

  state = routeInput(state, { type: "encoder_press", id: "main" }, mockBehavior).state;
  assert.equal(state.system.confirm, null);
  assert.equal(state.menu.stack.length, 0);
});

test("modifier releases are applied while help popup is open", () => {
  let state = createInitialState(mockBehavior);
  state.system.oledMode = "normal";

  state = routeInput(state, { type: "button_shift", pressed: true }, mockBehavior).state;
  state = routeInput(state, { type: "button_fn", pressed: true }, mockBehavior).state;
  state = routeInput(state, { type: "encoder_press", id: "main" }, mockBehavior).state;
  assert.equal(state.system.confirm?.kind, "help_info");

  state = routeInput(state, { type: "button_fn", pressed: false }, mockBehavior).state;
  state = routeInput(state, { type: "button_shift", pressed: false }, mockBehavior).state;
  assert.equal(state.system.fnHeld, false);
  assert.equal(state.system.shiftHeld, false);

  state = routeInput(state, { type: "button_a", pressed: true }, mockBehavior).state;
  assert.equal(state.system.confirm, null);
  assert.equal(state.system.fnHeld, false);
  assert.equal(state.system.shiftHeld, false);
});

test("startup splash close shows help hint toast", () => {
  let state = createInitialState(mockBehavior);
  state.system.oledMode = "splash";
  state.system.oledSplashText = "Starting up";
  state.system.oledSplashUntilMs = Date.now() - 1;

  state = tick(state, mockBehavior, 0).state;

  assert.equal(state.system.oledMode, "normal");
  assert.equal(state.system.toast?.message, "Help=Sh+Fn+Enter");
});

test("sample assign mode cycles high-medium-low-off when velocity levels are on", () => {
  let state = createInitialState(mockBehavior) as any;
  state.system.oledMode = "normal";
  state.runtimeConfig.instruments[0].type = "sample";
  state.runtimeConfig.instruments[0].sample.selectedSlot = 2;
  state.runtimeConfig.instruments[0].sample.velocityLevelsEnabled = true;
  state.system.sampleAssign = { instrumentSlot: 0, sampleSlot: 2 };

  const press = () => {
    state = routeInput(state, { type: "grid_press", x: 1, y: 1 } as DeviceInput, mockBehavior).state;
    return state.runtimeConfig.instruments[0].sample.assignments.find((a: any) => a.x === 1 && a.y === 1);
  };

  const a1 = press();
  assert.equal(a1.level, "high");
  const a2 = press();
  assert.equal(a2.level, "medium");
  const a3 = press();
  assert.equal(a3.level, "low");
  press();
  const a4 = state.runtimeConfig.instruments[0].sample.assignments.find((a: any) => a.x === 1 && a.y === 1);
  assert.equal(a4, undefined);
});

test("sample assign mode supports shift row and shift double-press column", () => {
  let state = createInitialState(mockBehavior) as any;
  state.system.oledMode = "normal";
  state.runtimeConfig.instruments[0].type = "sample";
  state.runtimeConfig.instruments[0].sample.selectedSlot = 1;
  state.runtimeConfig.instruments[0].sample.velocityLevelsEnabled = false;
  state.system.sampleAssign = { instrumentSlot: 0, sampleSlot: 1 };

  state = routeInput(state, { type: "button_shift", pressed: true } as DeviceInput, mockBehavior).state;
  state = routeInput(state, { type: "grid_press", x: 2, y: 3 } as DeviceInput, mockBehavior).state;
  const rowAssigned = state.runtimeConfig.instruments[0].sample.assignments.filter((a: any) => a.y === 3 && a.sampleSlot === 1);
  assert.equal(rowAssigned.length, GRID_WIDTH);

  state = routeInput(state, { type: "grid_press", x: 2, y: 3 } as DeviceInput, mockBehavior).state;
  const colAssigned = state.runtimeConfig.instruments[0].sample.assignments.filter((a: any) => a.x === 2);
  assert.equal(colAssigned.length, 0);
});

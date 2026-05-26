import test from "node:test";
import assert from "node:assert/strict";

import type { BehaviorEngine } from "@cellsymphony/behavior-api";
import type { DeviceInput } from "@cellsymphony/device-contracts";
import { GRID_DOMAIN, GRID_HEIGHT, GRID_WIDTH } from "@cellsymphony/device-contracts";
import { keysBehavior } from "@cellsymphony/behaviors-keys";
import { createInitialState, OLED_TEXT_COLUMNS, routeInput, tick, toOledLines, toSimulatorFrame } from "../src/index";
import { pitchFromIntent } from "../src/musicTransforms";
import { cellsToLeds } from "../src/runtimeHelpers";

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
  selectLabel("Sound");
  press();
  // Master Vol
  press();
  const frame = toSimulatorFrame(state, mockBehavior);
  const hasStarEdit = frame.display.lines.some((line) => line.includes("*Vol:"));
  assert.equal(hasStarEdit, true);
});

test("OLED renders audio load indicator colors", () => {
  const state = createInitialState(mockBehavior);
  state.system.oledMode = "normal";

  const yellow = toSimulatorFrame(state, mockBehavior, { audioLoad: { ratio: 0.7, voiceSteal: false } }).oled!;
  const red = toSimulatorFrame(state, mockBehavior, { audioLoad: { ratio: 0.9, voiceSteal: false } }).oled!;
  const idle = toSimulatorFrame(state, mockBehavior, { audioLoad: { ratio: 0.1, voiceSteal: false } }).oled!;

  assert.equal(pixel565(yellow.pixels, 123, 5), 0xffe0);
  assert.equal(pixel565(red.pixels, 123, 5), 0xf800);
  assert.notEqual(pixel565(idle.pixels, 123, 5), 0xffe0);
  assert.notEqual(pixel565(idle.pixels, 123, 5), 0xf800);
});

test("simulator frame exposes behavior grid interaction semantics", () => {
  const paintState = createInitialState(mockBehavior);
  const keysState = createInitialState(keysBehavior);

  assert.equal(toSimulatorFrame(paintState, mockBehavior).gridInteraction, "paint");
  assert.equal(toSimulatorFrame(keysState, keysBehavior).gridInteraction, "momentary");
});

test("Fn+rightmost grid column jumps to Touch layer", () => {
  let state = createInitialState(mockBehavior);
  state.system.oledMode = "normal";

  state = routeInput(state, { type: "button_fn", pressed: true }, mockBehavior).state;
  state = routeInput(state, { type: "grid_press", x: GRID_WIDTH - 1, y: 0 }, mockBehavior).state;

  assert.equal(state.system.touchMode, "mix");
  assert.deepEqual(state.menu.stack, [3]);
  assert.equal(toSimulatorFrame(state, mockBehavior).display.page, "L4: Touch");

  state = routeInput(state, { type: "grid_press", x: GRID_WIDTH - 1, y: 0 }, mockBehavior).state;
  assert.equal(state.system.touchMode, "none");
});

test("Fn grid overlay shows part and Touch page options", () => {
  const state = createInitialState(mockBehavior);
  state.system.oledMode = "normal";
  state.system.fnHeld = true;
  state.system.touchMode = "pan";

  const cells = toSimulatorFrame(state, mockBehavior).leds.cells;
  const activePart = cells[GRID_DOMAIN.toDisplayIndex({ x: 0, y: 0 })]!;
  const selectedPage = cells[GRID_DOMAIN.toDisplayIndex({ x: GRID_WIDTH - 1, y: 1 })]!;
  const inactivePage = cells[GRID_DOMAIN.toDisplayIndex({ x: GRID_WIDTH - 1, y: 0 })]!;

  assert.ok(activePart.g > activePart.r && activePart.g > activePart.b);
  assert.ok(selectedPage.g > inactivePage.g && selectedPage.b > inactivePage.b);
});

test("Touch grid updates mixer volume and pan", () => {
  let state = createInitialState(mockBehavior);
  state.system.oledMode = "normal";
  state.system.touchMode = "mix";

  state = routeInput(state, { type: "grid_press", x: 1, y: 0 }, mockBehavior).state;
  assert.equal(state.runtimeConfig.instruments[1]?.mixer?.volume, 0);

  state = routeInput(state, { type: "grid_press", x: GRID_WIDTH - 1, y: 1 }, mockBehavior).state;
  assert.equal(state.system.touchMode, "pan");

  state = routeInput(state, { type: "grid_press", x: 2, y: 1 }, mockBehavior).state;
  assert.equal(state.runtimeConfig.instruments[1]?.mixer?.panPos, 2);
});

test("Touch mix LEDs show direct and FX-routed volume markers", () => {
  const state = createInitialState(mockBehavior);
  state.system.oledMode = "normal";
  state.system.touchMode = "mix";
  state.runtimeConfig.instruments[0]!.mixer = { route: "direct", volume: 100, panPos: 4 };
  state.runtimeConfig.instruments[1]!.mixer = { route: "fx_bus_1", volume: 0, panPos: 4 };

  const cells = toSimulatorFrame(state, mockBehavior).leds.cells;
  const direct = cells[GRID_DOMAIN.toDisplayIndex({ x: 0, y: GRID_HEIGHT - 1 })]!;
  const fx = cells[GRID_DOMAIN.toDisplayIndex({ x: 1, y: 0 })]!;

  assert.ok(direct.g > direct.r && direct.g > direct.b);
  assert.ok(fx.r > fx.g && fx.b > fx.g);
});

test("Touch FX assignment stores selected effect config on grid cell", () => {
  let state = createInitialState(mockBehavior);
  state.system.oledMode = "normal";
  state.system.fxAssignMode = { config: { fxType: "filter_sweep", params: { cutoffPct: 25, resonancePct: 80 } } };

  const result = routeInput(state, { type: "grid_press", x: 2, y: 3 }, mockBehavior);
  state = result.state;

  assert.deepEqual((state.runtimeConfig as any).touchFx.assignments, [
    { x: 2, y: 3, config: { fxType: "filter_sweep", params: { cutoffPct: 25, resonancePct: 80 } } }
  ]);
  assert.equal(result.effects.length, 0);
});

test("Touch FX press and release emit momentary effects", () => {
  let state = createInitialState(mockBehavior);
  state.system.oledMode = "normal";
  state.system.touchMode = "fx";
  (state.runtimeConfig as any).touchFx.assignments = [
    { x: 1, y: 2, config: { fxType: "stutter", params: { rateHz: 12, depthPct: 90 } } }
  ];

  const press = routeInput(state, { type: "grid_press", x: 1, y: 2 }, mockBehavior);
  assert.equal(press.state.system.activeFx.length, 1);
  assert.deepEqual(press.effects, [
    { type: "fx_momentary_activate", fxType: "stutter", params: { rateHz: 12, depthPct: 90 }, cellX: 1, cellY: 2 }
  ]);

  const release = routeInput(press.state, { type: "grid_release", x: 1, y: 2 }, mockBehavior);
  assert.equal(release.state.system.activeFx.length, 0);
  assert.deepEqual(release.effects, [{ type: "fx_momentary_deactivate", cellX: 1, cellY: 2 }]);
});

test("Touch FX enforces concurrency limit and same-type replacement", () => {
  let state = createInitialState(mockBehavior);
  state.system.oledMode = "normal";
  state.system.touchMode = "fx";
  (state.runtimeConfig as any).touchFx.maxConcurrent = 1;
  (state.runtimeConfig as any).touchFx.assignments = [
    { x: 0, y: 0, config: { fxType: "stutter", params: { rateHz: 6 } } },
    { x: 1, y: 0, config: { fxType: "freeze", params: { decayMs: 900 } } },
    { x: 2, y: 0, config: { fxType: "stutter", params: { rateHz: 16 } } }
  ];

  const first = routeInput(state, { type: "grid_press", x: 0, y: 0 }, mockBehavior);
  const blocked = routeInput(first.state, { type: "grid_press", x: 1, y: 0 }, mockBehavior);
  assert.equal(blocked.state.system.activeFx.length, 1);
  assert.deepEqual(blocked.effects, []);

  const replaced = routeInput(blocked.state, { type: "grid_press", x: 2, y: 0 }, mockBehavior);
  assert.equal(replaced.state.system.activeFx.length, 1);
  assert.equal(replaced.state.system.activeFx[0]?.cellX, 2);
  assert.deepEqual(replaced.effects, [
    { type: "fx_momentary_deactivate", cellX: 0, cellY: 0 },
    { type: "fx_momentary_activate", fxType: "stutter", params: { rateHz: 16 }, cellX: 2, cellY: 0 }
  ]);
});

test("Touch FX LEDs show assigned, active, and limit states", () => {
  let state = createInitialState(mockBehavior);
  state.system.oledMode = "normal";
  state.system.touchMode = "fx";
  (state.runtimeConfig as any).touchFx.maxConcurrent = 1;
  (state.runtimeConfig as any).touchFx.assignments = [
    { x: 0, y: 0, config: { fxType: "stutter", params: {} } },
    { x: 1, y: 0, config: { fxType: "freeze", params: {} } }
  ];
  state = routeInput(state, { type: "grid_press", x: 0, y: 0 }, mockBehavior).state;

  const cells = toSimulatorFrame(state, mockBehavior).leds.cells;
  const active = cells[GRID_DOMAIN.toDisplayIndex({ x: 0, y: 0 })]!;
  const limited = cells[GRID_DOMAIN.toDisplayIndex({ x: 1, y: 0 })]!;
  const empty = cells[GRID_DOMAIN.toDisplayIndex({ x: 2, y: 0 })]!;

  assert.ok(active.r > 100 && active.g > 80 && active.b < 20);
  assert.ok(Math.abs(limited.r - limited.g) <= 1 && Math.abs(limited.g - limited.b) <= 1);
  assert.ok(empty.b > empty.r && empty.b > empty.g);
});

test("sectioned row scan cursor starts from the top section", () => {
  const leds = cellsToLeds(
    Array.from({ length: GRID_WIDTH * GRID_HEIGHT }, () => false),
    undefined,
    { axis: "rows", index: 0, sections: "2" },
    1
  );

  const top = leds[GRID_DOMAIN.toDisplayIndex({ x: 0, y: GRID_HEIGHT - 1 })]!;
  const bottom = leds[GRID_DOMAIN.toDisplayIndex({ x: 0, y: 0 })]!;

  assert.ok(top.r > bottom.r);
});

function pixel565(pixels: Uint8Array, x: number, y: number): number {
  const offset = (y * 128 + x) * 2;
  return ((pixels[offset] ?? 0) << 8) | (pixels[offset + 1] ?? 0);
}

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

test("section restart makes pitch mapping local to scan section", () => {
  const state = createInitialState(mockBehavior) as any;
  const cfg = state.runtimeConfig;
  cfg.scanMode = "scanning";
  cfg.scanAxis = "rows";
  cfg.scanSections = "2";
  cfg.x.pitch.enabled = false;
  cfg.y.pitch.enabled = true;
  cfg.y.pitch.steps = 1;
  cfg.y.pitch.restartEachSection = false;

  const absolute = pitchFromIntent({ x: 0, y: 4 }, cfg, 60);
  cfg.y.pitch.restartEachSection = true;
  const firstSection = pitchFromIntent({ x: 0, y: 0 }, cfg, 60);
  const secondSection = pitchFromIntent({ x: 0, y: 4 }, cfg, 60);

  assert.notEqual(absolute, firstSection);
  assert.equal(secondSection, firstSection);
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

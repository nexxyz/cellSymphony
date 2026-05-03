import type { BehaviorEngine } from "@cellsymphony/behavior-api";
import {
  GRID_HEIGHT,
  GRID_WIDTH,
  PAGES,
  type DeviceInput,
  type DisplayFrame,
  type LedCell,
  type PageId,
  type SimulatorFrame,
  type TransportFrame
} from "@cellsymphony/device-contracts";
import {
  interpretGrid,
  type AxisStrategy,
  type GridSnapshot,
  type InterpretationProfile,
  type TickStrategy
} from "@cellsymphony/interpretation-core";
import { loadDefaultMappingConfig, mapIntentsToMusicalEvents, type MappingConfig } from "@cellsymphony/mapping-core";
import type { MusicalEvent } from "@cellsymphony/musical-events";

type ScanMode = "immediate" | "scanning";
type ScanAxis = "rows" | "columns";
type Direction = "forward" | "reverse";
type NoteUnit = "1/16" | "1/8" | "1/4" | "1/2" | "1/1";
type ModMode = "scale_steps" | "filter_cutoff" | "filter_resonance" | "velocity";
type Curve = "linear" | "curve";

type AxisModConfig = {
  mode: ModMode;
  enabled: boolean;
  direction: Direction;
  scaleSteps: number;
  min: number;
  max: number;
  gridOffset: number;
  curve: Curve;
};

type RuntimeConfig = {
  populationMode: "grid" | "conway";
  masterVolume: number;
  scanMode: ScanMode;
  scanAxis: ScanAxis;
  scanUnit: NoteUnit;
  scanDirection: Direction;
  conwayStepUnit: NoteUnit;
  eventEnabled: boolean;
  eventParity: "none" | "birth_even_death_odd";
  stateEnabled: boolean;
  x: AxisModConfig;
  y: AxisModConfig;
};

type MenuNode =
  | { kind: "group"; label: string; children: MenuNode[]; visible?: (c: RuntimeConfig) => boolean }
  | { kind: "enum"; label: string; key: string; options: string[]; visible?: (c: RuntimeConfig) => boolean }
  | { kind: "number"; label: string; key: string; min: number; max: number; step: number; visible?: (c: RuntimeConfig) => boolean }
  | { kind: "bool"; label: string; key: string; visible?: (c: RuntimeConfig) => boolean };

type MenuState = {
  stack: number[];
  cursor: number;
  editing: boolean;
};

export type PlatformState<TState> = {
  transport: TransportFrame;
  behaviorState: TState;
  activeBehavior: string;
  mappingConfig: MappingConfig;
  runtimeConfig: RuntimeConfig;
  menu: MenuState;
  scanIndex: number;
  scanPulseAccumulator: number;
  conwayPulseAccumulator: number;
  ppqnPulseRemainder: number;
};

export const OLED_WIDTH = 128;
export const OLED_HEIGHT = 128;
export const OLED_TEXT_COLUMNS = 20;
export const OLED_TEXT_LINES = 4;

export function createInitialState<TState>(behavior: BehaviorEngine<TState, unknown>): PlatformState<TState> {
  return {
    transport: { playing: false, bpm: 120, tick: 0, ppqnPulse: 0 },
    behaviorState: behavior.init({}),
    activeBehavior: behavior.id,
    mappingConfig: loadDefaultMappingConfig(),
    runtimeConfig: {
      populationMode: "conway",
      masterVolume: 73,
      scanMode: "immediate",
      scanAxis: "columns",
      scanUnit: "1/8",
      scanDirection: "forward",
      conwayStepUnit: "1/8",
      eventEnabled: true,
      eventParity: "birth_even_death_odd",
      stateEnabled: true,
      x: { mode: "scale_steps", enabled: true, direction: "forward", scaleSteps: 1, min: 100, max: 100, gridOffset: 0, curve: "linear" },
      y: { mode: "scale_steps", enabled: true, direction: "forward", scaleSteps: 3, min: 100, max: 100, gridOffset: 0, curve: "linear" }
    },
    menu: { stack: [], cursor: 0, editing: false },
    scanIndex: 0,
    scanPulseAccumulator: 0,
    conwayPulseAccumulator: 0,
    ppqnPulseRemainder: 0
  };
}

export function routeInput<TState>(state: PlatformState<TState>, input: DeviceInput, behavior: BehaviorEngine<TState, unknown>): { state: PlatformState<TState>; events: MusicalEvent[] } {
  const events: MusicalEvent[] = [];
  let nextState = { ...state };

  if (input.type === "button_s") {
    nextState.transport = { ...nextState.transport, playing: !nextState.transport.playing };
  } else if (input.type === "button_a") {
    nextState.menu = backMenu(nextState.menu);
  } else if (input.type === "encoder_press" && isMainEncoderInput(input.id)) {
    nextState = pressMenu(nextState);
  } else if (input.type === "encoder_turn" && isMainEncoderInput(input.id)) {
    nextState = turnMenu(nextState, input.delta);
  }

  nextState.behaviorState = behavior.onInput(nextState.behaviorState, input, {
    bpm: nextState.transport.bpm,
    emit: (event) => events.push(event)
  });
  return { state: nextState, events };
}

export function tick<TState>(state: PlatformState<TState>, behavior: BehaviorEngine<TState, unknown>): { state: PlatformState<TState>; events: MusicalEvent[] } {
  const events: MusicalEvent[] = [];
  let next = { ...state };
  if (next.transport.playing) {
    const pulsesPerFrame = pulsesPerSecond(next.transport.bpm) * FRAME_SECONDS;
    next.scanPulseAccumulator += pulsesPerFrame;
    next.conwayPulseAccumulator += pulsesPerFrame;
    next.ppqnPulseRemainder += pulsesPerFrame;
    const wholePulses = Math.floor(next.ppqnPulseRemainder);
    if (wholePulses > 0) {
      next.ppqnPulseRemainder -= wholePulses;
      next.transport = { ...next.transport, ppqnPulse: next.transport.ppqnPulse + wholePulses };
    }

    if (next.runtimeConfig.scanMode === "scanning") {
      const scanStepPulses = noteUnitToPulses(next.runtimeConfig.scanUnit);
      while (next.scanPulseAccumulator >= scanStepPulses) {
        next.scanPulseAccumulator -= scanStepPulses;
        next.scanIndex = advanceScanIndex(
          next.scanIndex,
          next.runtimeConfig.scanDirection,
          next.runtimeConfig.scanAxis === "columns" ? GRID_WIDTH : GRID_HEIGHT
        );
      }
    }

    const beforeGrid = toGridSnapshot(behavior.renderModel(next.behaviorState));
    if (next.runtimeConfig.populationMode === "conway") {
      const conwayStepPulses = noteUnitToPulses(next.runtimeConfig.conwayStepUnit);
      while (next.conwayPulseAccumulator >= conwayStepPulses) {
        next.conwayPulseAccumulator -= conwayStepPulses;
        next.behaviorState = behavior.onTick(next.behaviorState, { bpm: next.transport.bpm, emit: () => {} });
      }
    }
    const afterGrid = toGridSnapshot(behavior.renderModel(next.behaviorState));
    const profile = profileFromConfig(next.runtimeConfig);
    const interpretationTick = next.runtimeConfig.scanMode === "scanning" ? next.scanIndex : next.transport.tick;
    const intents = interpretGrid(beforeGrid, afterGrid, interpretationTick, profile);
    const mapped = mapIntentsToMusicalEvents(intents, withScaleSteps(next.mappingConfig, next.runtimeConfig));
    events.push(...dedupeSimultaneousNotes(mapped));
    next.transport = { ...next.transport, tick: next.transport.tick + 1 };
  }
  return { state: next, events };
}

export function toSimulatorFrame<TState>(state: PlatformState<TState>, behavior: BehaviorEngine<TState, unknown>): SimulatorFrame {
  const model = behavior.renderModel(state.behaviorState);
  const menuView = currentMenuView(state);
  const scanCursor = state.runtimeConfig.scanMode === "scanning" ? { axis: state.runtimeConfig.scanAxis, index: state.scanIndex } : null;
  return {
    display: {
      page: PAGES[0] as PageId,
      title: menuView.path,
      editing: state.menu.editing,
      lines: menuView.lines
    },
    leds: { width: GRID_WIDTH, height: GRID_HEIGHT, cells: cellsToLeds(model.cells, scanCursor) },
    transport: state.transport,
    activeBehavior: model.name
  };
}

function pulsesPerSecond(bpm: number): number {
  return (bpm / 60) * PPQN;
}

function noteUnitToPulses(unit: NoteUnit): number {
  switch (unit) {
    case "1/16":
      return 6;
    case "1/8":
      return 12;
    case "1/4":
      return 24;
    case "1/2":
      return 48;
    case "1/1":
      return 96;
  }
}

function advanceScanIndex(current: number, direction: Direction, size: number): number {
  const delta = direction === "reverse" ? -1 : 1;
  return mod(current + delta, size);
}

function withScaleSteps(mapping: MappingConfig, cfg: RuntimeConfig): MappingConfig {
  return { ...mapping, rowStepDegrees: cfg.y.scaleSteps, columnStepDegrees: cfg.x.scaleSteps };
}

function profileFromConfig(cfg: RuntimeConfig): InterpretationProfile {
  const tick: TickStrategy = cfg.scanMode === "immediate"
    ? { mode: "whole_grid_transitions", parity: cfg.eventParity }
    : { mode: cfg.scanAxis === "columns" ? "scan_column_active" : "scan_row_active" };
  const axisX: AxisStrategy = cfg.x.mode === "scale_steps" ? { mode: "scale_step", step: cfg.x.scaleSteps } : { mode: "timing_only" };
  const axisY: AxisStrategy = cfg.y.mode === "scale_steps" ? { mode: "scale_step", step: cfg.y.scaleSteps } : { mode: "timing_only" };
  return {
    id: "menu_profile",
    event: { enabled: cfg.eventEnabled, parity: cfg.eventParity },
    state: { enabled: cfg.stateEnabled, tick },
    x: axisX,
    y: axisY
  };
}

function menuTree(): MenuNode {
  return {
    kind: "group",
    label: "Root",
    children: [
      {
        kind: "group",
        label: "Transport",
        children: [
          { kind: "enum", label: "Play/Stop", key: "transport.playing", options: ["false", "true"] },
          { kind: "number", label: "BPM", key: "transport.bpm", min: 40, max: 240, step: 1 },
          { kind: "enum", label: "Time Sig", key: "timeSig", options: ["4/4"] }
        ]
      },
      {
        kind: "group",
        label: "Audio",
        children: [{ kind: "number", label: "Master Vol", key: "masterVolume", min: 0, max: 100, step: 1 }]
      },
      {
        kind: "group",
        label: "Population",
        children: [
          { kind: "enum", label: "Mode", key: "populationMode", options: ["grid", "conway"] },
          { kind: "enum", label: "Conway Step", key: "conwayStepUnit", options: ["1/16", "1/8", "1/4", "1/2", "1/1"], visible: (c) => c.populationMode === "conway" }
        ]
      },
      {
        kind: "group",
        label: "Interpretation",
        children: [
          { kind: "enum", label: "Scan Mode", key: "scanMode", options: ["immediate", "scanning"] },
          { kind: "enum", label: "Scan Axis", key: "scanAxis", options: ["rows", "columns"], visible: (c) => c.scanMode === "scanning" },
          { kind: "enum", label: "Scan Unit", key: "scanUnit", options: ["1/16", "1/8", "1/4", "1/2", "1/1"], visible: (c) => c.scanMode === "scanning" },
          { kind: "enum", label: "Scan Dir", key: "scanDirection", options: ["forward", "reverse"], visible: (c) => c.scanMode === "scanning" },
          { kind: "bool", label: "Event On", key: "eventEnabled" },
          { kind: "enum", label: "Event Filter", key: "eventParity", options: ["none", "birth_even_death_odd"] },
          { kind: "bool", label: "State On", key: "stateEnabled" },
          axisGroup("X Axis", "x", 1),
          axisGroup("Y Axis", "y", 3)
        ]
      },
      {
        kind: "group",
        label: "Mapping",
        children: [
          axisGroup("X Axis", "x", 1),
          axisGroup("Y Axis", "y", 3),
          { kind: "enum", label: "Birth Target", key: "mapping.birth.channel", options: ["0", "1", "2", "3"] },
          { kind: "enum", label: "Death Target", key: "mapping.death.channel", options: ["0", "1", "2", "3"] },
          { kind: "enum", label: "State Target", key: "mapping.state.channel", options: ["0", "1", "2", "3"] },
          { kind: "enum", label: "Range Mode", key: "mapping.rangeMode", options: ["clamp", "wrap"] },
          { kind: "number", label: "Base Note", key: "mapping.baseMidiNote", min: 0, max: 127, step: 1 }
        ]
      },
      {
        kind: "group",
        label: "System",
        children: [
          { kind: "number", label: "Brightness", key: "displayBrightness", min: 10, max: 100, step: 5 },
          { kind: "enum", label: "About", key: "about", options: ["CellSymphony v0.1"] }
        ]
      }
    ]
  };
}

function axisGroup(label: string, prefix: "x" | "y", _defaultStep: number): MenuNode {
  return {
    kind: "group",
    label,
    children: [
      { kind: "enum", label: "Mode", key: `${prefix}.mode`, options: ["scale_steps", "filter_cutoff", "filter_resonance", "velocity"] },
      { kind: "bool", label: "On", key: `${prefix}.enabled` },
      { kind: "enum", label: "Dir", key: `${prefix}.direction`, options: ["forward", "reverse"] },
      { kind: "number", label: "Scale Steps", key: `${prefix}.scaleSteps`, min: 0, max: 16, step: 1 },
      { kind: "number", label: "Min", key: `${prefix}.min`, min: 0, max: 100, step: 1 },
      { kind: "number", label: "Max", key: `${prefix}.max`, min: 0, max: 100, step: 1 },
      { kind: "number", label: "Grid Offset", key: `${prefix}.gridOffset`, min: -16, max: 16, step: 1 },
      { kind: "enum", label: "Curve", key: `${prefix}.curve`, options: ["linear", "curve"] }
    ]
  };
}

function currentMenuView<TState>(state: PlatformState<TState>): { path: string; lines: string[] } {
  const { runtimeConfig: cfg, menu } = state;
  const { siblings, path } = locate(menuTree(), cfg, menu);
  if (!siblings.length) return { path, lines: ["", "", ""] };
  const cursor = clamp(menu.cursor, 0, siblings.length - 1);
  const start = clamp(cursor - 1, 0, Math.max(0, siblings.length - 3));
  const windowRows = siblings.slice(start, start + 3);
  const lines = windowRows.map((item, index) => {
    const rowIndex = start + index;
    const selected = rowIndex === cursor;
    const marker = selected ? ">" : " ";
    const label = item.kind === "group" ? `${item.label} ->` : item.label;
    const value = item.kind === "group" ? "" : ` ${formatDisplayValue(item.key, readAnyValue(state, item.key))}`;
    return `${marker} ${label}${value}`.trimEnd();
  });
  while (lines.length < 3) lines.push("");
  return { path, lines };
}

function locate(root: MenuNode, cfg: RuntimeConfig, menu: MenuState): { node: MenuNode; siblings: MenuNode[]; path: string } {
  let node = root;
  const labels: string[] = [];
  for (const idx of menu.stack) {
    const kids = visibleChildren(node, cfg);
    const next = kids[idx] ?? kids[0];
    if (!next || next.kind !== "group") break;
    labels.push(next.label);
    node = next;
  }
  return { node, siblings: visibleChildren(node, cfg), path: labels.join("/") || "Menu" };
}

function visibleChildren(node: MenuNode, cfg: RuntimeConfig): MenuNode[] {
  if (node.kind !== "group") return [];
  return node.children.filter((n) => (n.visible ? n.visible(cfg) : true));
}

function backMenu(menu: MenuState): MenuState {
  if (menu.editing) return { ...menu, editing: false };
  if (menu.stack.length === 0) return menu;
  return { ...menu, stack: menu.stack.slice(0, -1), cursor: 0 };
}

function pressMenu<TState>(state: PlatformState<TState>): PlatformState<TState> {
  const view = locate(menuTree(), state.runtimeConfig, state.menu);
  const selected = view.siblings[state.menu.cursor];
  if (!selected) return state;
  if (selected.kind === "group") {
    return { ...state, menu: { ...state.menu, stack: [...state.menu.stack, state.menu.cursor], cursor: 0 } };
  }
  if (selected.kind === "enum" && selected.key === "transport.playing") {
    return { ...state, transport: { ...state.transport, playing: !state.transport.playing } };
  }
  if (selected.kind === "bool") {
    return { ...state, runtimeConfig: writeValue(state.runtimeConfig, selected.key, !readValue(state.runtimeConfig, selected.key)) };
  }
  return { ...state, menu: { ...state.menu, editing: !state.menu.editing } };
}

function turnMenu<TState>(state: PlatformState<TState>, delta: -1 | 1): PlatformState<TState> {
  const view = locate(menuTree(), state.runtimeConfig, state.menu);
  if (!state.menu.editing) {
    const max = Math.max(0, view.siblings.length - 1);
    return { ...state, menu: { ...state.menu, cursor: clamp(state.menu.cursor + delta, 0, max) } };
  }
  const selected = view.siblings[state.menu.cursor];
  if (!selected || selected.kind === "group" || selected.kind === "bool") return state;
  const current = readAnyValue(state, selected.key);
  if (selected.kind === "number") {
    const nextValue = clamp(Number(current) + delta * selected.step, selected.min, selected.max);
    return writeAnyValue(state, selected.key, nextValue);
  }
  const idx = selected.options.indexOf(String(current));
  const nextIdx = clamp(idx + delta, 0, selected.options.length - 1);
  const raw = selected.options[nextIdx];
  if (selected.key === "transport.playing") {
    return { ...state, transport: { ...state.transport, playing: raw === "true" } };
  }
  return writeAnyValue(state, selected.key, raw);
}

function readAnyValue<TState>(state: PlatformState<TState>, key: string): unknown {
  if (key.startsWith("transport.")) return readNestedValue(state.transport, key.slice("transport.".length));
  if (key.startsWith("mapping.")) return readNestedValue(state.mappingConfig, key.slice("mapping.".length));
  if (key === "displayBrightness") return 100;
  if (key === "about") return "CellSymphony v0.1";
  if (key === "timeSig") return "4/4";
  return readValue(state.runtimeConfig, key);
}

function writeAnyValue<TState>(state: PlatformState<TState>, key: string, value: unknown): PlatformState<TState> {
  if (key.startsWith("transport.")) {
    const transport = writeNestedValue(state.transport, key.slice("transport.".length), value) as TransportFrame;
    return { ...state, transport };
  }
  if (key.startsWith("mapping.")) {
    const mappingConfig = writeNestedValue(state.mappingConfig, key.slice("mapping.".length), value) as MappingConfig;
    return { ...state, mappingConfig };
  }
  if (key === "displayBrightness" || key === "about" || key === "timeSig") return state;
  return { ...state, runtimeConfig: writeValue(state.runtimeConfig, key, value) };
}

function readNestedValue(root: unknown, key: string): unknown {
  const parts = key.split(".");
  let cur: any = root;
  for (const p of parts) cur = cur[p];
  return cur;
}

function writeNestedValue(root: unknown, key: string, value: unknown): unknown {
  const parts = key.split(".");
  const next: any = structuredClone(root);
  let cur: any = next;
  for (let i = 0; i < parts.length - 1; i += 1) cur = cur[parts[i]];
  cur[parts[parts.length - 1]] = typeof cur[parts[parts.length - 1]] === "number" ? Number(value) : value;
  return next;
}

function readValue(cfg: RuntimeConfig, key: string): unknown {
  const parts = key.split(".");
  let cur: any = cfg;
  for (const p of parts) cur = cur[p];
  return cur;
}

function writeValue(cfg: RuntimeConfig, key: string, value: unknown): RuntimeConfig {
  const parts = key.split(".");
  const next: any = structuredClone(cfg);
  let cur: any = next;
  for (let i = 0; i < parts.length - 1; i += 1) cur = cur[parts[i]];
  cur[parts[parts.length - 1]] = value;
  return next;
}

function dedupeSimultaneousNotes(events: MusicalEvent[]): MusicalEvent[] {
  const out: MusicalEvent[] = [];
  const seen = new Map<string, number>();
  for (const event of events) {
    if (event.type !== "note_on") {
      out.push(event);
      continue;
    }
    const key = `${event.channel}:${event.note}`;
    const idx = seen.get(key);
    if (idx === undefined) {
      seen.set(key, out.length);
      out.push(event);
      continue;
    }
    const existing = out[idx];
    if (existing.type === "note_on") {
      out[idx] = { ...existing, velocity: Math.max(existing.velocity, event.velocity), durationMs: Math.max(existing.durationMs ?? 0, event.durationMs ?? 0) };
    }
  }
  return out;
}

function toGridSnapshot(model: { cells: boolean[] }): GridSnapshot {
  return { width: GRID_WIDTH, height: GRID_HEIGHT, cells: model.cells };
}

function cellsToLeds(cells: boolean[], scanCursor: { axis: ScanAxis; index: number } | null): LedCell[] {
  return cells.map((alive, i) => {
    const x = i % GRID_WIDTH;
    const y = Math.floor(i / GRID_WIDTH);
    const inCursor =
      scanCursor !== null &&
      ((scanCursor.axis === "columns" && x === scanCursor.index) ||
        (scanCursor.axis === "rows" && y === scanCursor.index));

    if (!inCursor) {
      return alive ? { r: 0, g: 255, b: 120 } : { r: 15, g: 15, b: 22 };
    }

    if (alive) {
      return { r: 90, g: 160, b: 120 };
    }
    return { r: 70, g: 70, b: 76 };
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mod(value: number, base: number): number {
  return ((value % base) + base) % base;
}

const PPQN = 24;
const FRAME_SECONDS = 0.15;

export function toDisplayFrame(page: PageId, line1: string, editing: boolean): DisplayFrame {
  return { page, title: "Cell Symphony", editing, lines: [line1, "A:Back Space:Play"] };
}

export function toOledLines(display: DisplayFrame): string[] {
  const title = fitOledText(display.title);
  const body = display.lines.slice(0, OLED_TEXT_LINES - 1).map(fitOledText);
  while (body.length < OLED_TEXT_LINES - 1) {
    body.push("");
  }
  return [title, ...body];
}

function fitOledText(text: string): string {
  if (text.length <= OLED_TEXT_COLUMNS) return text;
  if (OLED_TEXT_COLUMNS <= 3) return text.slice(0, OLED_TEXT_COLUMNS);
  return `${text.slice(0, OLED_TEXT_COLUMNS - 3)}...`;
}

function isMainEncoderInput(id: "main" | "aux1" | "aux2" | "aux3" | "aux4" | undefined): boolean {
  return id === undefined || id === "main";
}

function formatDisplayValue(key: string, value: unknown): string {
  if (key === "masterVolume") return `Vol: ${value}%`;
  if (key === "populationMode") return value === "grid" ? "Sequencer" : "Conway";
  if (key === "scanMode") return value === "immediate" ? "Immediate" : "Scanning";
  if (key === "scanAxis") return value === "columns" ? "Cols" : "Rows";
  if (key === "scanDirection") return value === "forward" ? "Fwd" : "Rev";
  if (key === "transport.playing") return value === true || value === "true" ? "Play" : "Stop";
  if (key === "eventParity") return value === "none" ? "All" : "Odd/Even";
  if (typeof value === "boolean") return value ? "On" : "Off";
  return String(value);
}

export function emergencyBrake<TState>(state: PlatformState<TState>): { state: PlatformState<TState>; events: MusicalEvent[] } {
  const size = state.runtimeConfig.scanAxis === "columns" ? GRID_WIDTH : GRID_HEIGHT;
  const origin = state.runtimeConfig.scanDirection === "forward" ? 0 : size - 1;
  const events: MusicalEvent[] = [];
  for (let channel = 0; channel < 16; channel += 1) {
    events.push({ type: "cc", channel, controller: 120, value: 0 });
    events.push({ type: "cc", channel, controller: 123, value: 0 });
  }
  return {
    state: {
      ...state,
      transport: { ...state.transport, playing: false, ppqnPulse: 0 },
      scanIndex: origin,
      scanPulseAccumulator: 0,
      conwayPulseAccumulator: 0,
      ppqnPulseRemainder: 0
    },
    events
  };
}

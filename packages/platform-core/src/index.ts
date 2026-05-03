import type { BehaviorEngine } from "@cellsymphony/behavior-api";
import {
  GRID_HEIGHT,
  GRID_WIDTH,
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
type Curve = "linear" | "curve";
type ScaleId = "chromatic" | "major" | "natural_minor" | "dorian" | "mixolydian" | "major_pentatonic" | "minor_pentatonic" | "harmonic_minor";
type RootName = "C" | "C#" | "D" | "D#" | "E" | "F" | "F#" | "G" | "G#" | "A" | "A#" | "B";

type OutOfRangeMode = "clamp" | "wrap";

type PitchSettings = {
  startingNote: number;
  lowestNote: number;
  highestNote: number;
  outOfRange: OutOfRangeMode;
  scale: ScaleId;
  root: RootName;
};

type PitchLaneConfig = {
  enabled: boolean;
  steps: number;
};

type ValueLaneConfig = {
  enabled: boolean;
  from: number;
  to: number;
  gridOffset: number;
  curve: Curve;
};

type AxisModConfig = {
  pitch: PitchLaneConfig;
  velocity: ValueLaneConfig;
  filterCutoff: ValueLaneConfig;
  filterResonance: ValueLaneConfig;
};

type RuntimeConfig = {
  populationMode: "grid" | "conway";
  masterVolume: number;
  displayBrightness: number;
  gridBrightness: number;
  buttonBrightness: number;
  scanMode: ScanMode;
  scanAxis: ScanAxis;
  scanUnit: NoteUnit;
  scanDirection: Direction;
  conwayStepUnit: NoteUnit;
  eventEnabled: boolean;
  eventParity: "none" | "birth_even_death_odd";
  stateEnabled: boolean;
  pitch: PitchSettings;
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
export const OLED_TEXT_LINES = 8;

export function createInitialState<TState>(behavior: BehaviorEngine<TState, unknown>): PlatformState<TState> {
  return {
    transport: { playing: false, bpm: 120, tick: 0, ppqnPulse: 0 },
    behaviorState: behavior.init({}),
    activeBehavior: behavior.id,
    mappingConfig: loadDefaultMappingConfig(),
    runtimeConfig: {
      populationMode: "conway",
      masterVolume: 73,
      displayBrightness: 75,
      gridBrightness: 75,
      buttonBrightness: 75,
      scanMode: "immediate",
      scanAxis: "columns",
      scanUnit: "1/8",
      scanDirection: "forward",
      conwayStepUnit: "1/8",
      eventEnabled: true,
      eventParity: "birth_even_death_odd",
      stateEnabled: true,
      pitch: { startingNote: 48, lowestNote: 36, highestNote: 84, outOfRange: "clamp", scale: "major_pentatonic", root: "C" },
      x: {
        pitch: { enabled: true, steps: 1 },
        velocity: { enabled: false, from: 20, to: 100, gridOffset: 0, curve: "linear" },
        filterCutoff: { enabled: false, from: 20, to: 127, gridOffset: 0, curve: "linear" },
        filterResonance: { enabled: false, from: 10, to: 90, gridOffset: 0, curve: "linear" }
      },
      y: {
        pitch: { enabled: true, steps: 8 },
        velocity: { enabled: false, from: 20, to: 100, gridOffset: 0, curve: "linear" },
        filterCutoff: { enabled: false, from: 20, to: 127, gridOffset: 0, curve: "linear" },
        filterResonance: { enabled: false, from: 10, to: 90, gridOffset: 0, curve: "linear" }
      }
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

export function tick<TState>(
  state: PlatformState<TState>,
  behavior: BehaviorEngine<TState, unknown>,
  elapsedSeconds: number = FRAME_SECONDS
): { state: PlatformState<TState>; events: MusicalEvent[] } {
  const events: MusicalEvent[] = [];
  let next = { ...state };
  if (next.transport.playing) {
    const elapsedPulses = pulsesPerSecond(next.transport.bpm) * elapsedSeconds;
    next.scanPulseAccumulator += elapsedPulses;
    next.conwayPulseAccumulator += elapsedPulses;
    next.ppqnPulseRemainder += elapsedPulses;
    const wholePulses = Math.floor(next.ppqnPulseRemainder);
    if (wholePulses > 0) {
      next.ppqnPulseRemainder -= wholePulses;
      next.transport = { ...next.transport, ppqnPulse: next.transport.ppqnPulse + wholePulses };
    }

    let scanAdvanced = false;
    if (next.runtimeConfig.scanMode === "scanning") {
      const scanStepPulses = noteUnitToPulses(next.runtimeConfig.scanUnit);
      while (next.scanPulseAccumulator >= scanStepPulses) {
        next.scanPulseAccumulator -= scanStepPulses;
        next.scanIndex = advanceScanIndex(
          next.scanIndex,
          next.runtimeConfig.scanDirection,
          next.runtimeConfig.scanAxis === "columns" ? GRID_WIDTH : GRID_HEIGHT
        );
        scanAdvanced = true;
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
    const shouldInterpret = next.runtimeConfig.scanMode === "immediate" || scanAdvanced;
    if (shouldInterpret) {
      const profile = profileFromConfig(next.runtimeConfig);
      const interpretationTick = next.runtimeConfig.scanMode === "scanning" ? next.scanIndex : next.transport.tick;
      const intents = interpretGrid(beforeGrid, afterGrid, interpretationTick, profile);
      const mapped = mapIntentsToMusicalEvents(intents, withScaleSteps(next.mappingConfig, next.runtimeConfig));
      const modulated = applyModulation(intents, mapped, next.runtimeConfig);
      events.push(...dedupeSimultaneousNotes(modulated));
    }
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
      page: menuView.path,
      title: menuView.path,
      editing: state.menu.editing,
      lines: menuView.lines
    },
    leds: { width: GRID_WIDTH, height: GRID_HEIGHT, cells: cellsToLeds(model.cells, scanCursor, state.runtimeConfig.gridBrightness / 100) },
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
  return {
    ...mapping,
    rowStepDegrees: cfg.y.pitch.enabled ? Math.abs(cfg.y.pitch.steps) : 0,
    columnStepDegrees: cfg.x.pitch.enabled ? Math.abs(cfg.x.pitch.steps) : 0
  };
}

function profileFromConfig(cfg: RuntimeConfig): InterpretationProfile {
  const tick: TickStrategy = cfg.scanMode === "immediate"
    ? { mode: "whole_grid_transitions", parity: cfg.eventParity }
    : { mode: cfg.scanAxis === "columns" ? "scan_column_active" : "scan_row_active" };
  const axisX: AxisStrategy = cfg.x.pitch.enabled ? { mode: "scale_step", step: Math.abs(cfg.x.pitch.steps) } : { mode: "timing_only" };
  const axisY: AxisStrategy = cfg.y.pitch.enabled ? { mode: "scale_step", step: Math.abs(cfg.y.pitch.steps) } : { mode: "timing_only" };
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
          { kind: "enum", label: "Play/Pause", key: "transport.playing", options: ["false", "true"] },
          { kind: "number", label: "BPM", key: "transport.bpm", min: 40, max: 240, step: 1 }
        ]
      },
      {
        kind: "group",
        label: "Audio",
        children: [{ kind: "number", label: "Master Vol", key: "masterVolume", min: 0, max: 100, step: 1 }]
      },
      {
        kind: "group",
        label: "Engine",
        children: [
          { kind: "enum", label: "Population Mode", key: "populationMode", options: ["grid", "conway"] },
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
          { kind: "enum", label: "Scan Direction", key: "scanDirection", options: ["forward", "reverse"], visible: (c) => c.scanMode === "scanning" },
          { kind: "bool", label: "Event Triggers", key: "eventEnabled" },
          { kind: "enum", label: "Event Pattern", key: "eventParity", options: ["none", "birth_even_death_odd"] },
          { kind: "bool", label: "State Notes", key: "stateEnabled" },
          axisGroup("X Axis", "x", 1),
          axisGroup("Y Axis", "y", 8)
        ]
      },
      {
        kind: "group",
        label: "Mapping",
        children: [
          {
            kind: "group",
            label: "Note Mapping",
            children: [
              { kind: "number", label: "Starting Note", key: "pitch.startingNote", min: 0, max: 127, step: 1 },
              { kind: "number", label: "Lowest Note", key: "pitch.lowestNote", min: 0, max: 127, step: 1 },
              { kind: "number", label: "Highest Note", key: "pitch.highestNote", min: 0, max: 127, step: 1 },
              { kind: "enum", label: "Out of Range", key: "pitch.outOfRange", options: ["clamp", "wrap"] },
              { kind: "enum", label: "Scale", key: "pitch.scale", options: ["chromatic", "major", "natural_minor", "dorian", "mixolydian", "major_pentatonic", "minor_pentatonic", "harmonic_minor"] },
              { kind: "enum", label: "Root", key: "pitch.root", options: ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] }
            ]
          },
          { kind: "enum", label: "Birth Target", key: "mapping.birth.channel", options: ["0", "1", "2", "3"] },
          { kind: "enum", label: "Death Target", key: "mapping.death.channel", options: ["0", "1", "2", "3"] },
          { kind: "enum", label: "State Target", key: "mapping.state.channel", options: ["0", "1", "2", "3"] },
          axisGroup("X Axis", "x", 1),
          axisGroup("Y Axis", "y", 3)
        ]
      },
      {
        kind: "group",
        label: "System",
        children: [
          { kind: "number", label: "Display Brightness", key: "displayBrightness", min: 10, max: 100, step: 5 },
          { kind: "number", label: "Grid Brightness", key: "gridBrightness", min: 10, max: 100, step: 5 },
          { kind: "number", label: "Button Brightness", key: "buttonBrightness", min: 10, max: 100, step: 5 }
        ]
      }
    ]
  };
}

function axisGroup(label: string, prefix: "x" | "y", _defaultStep: number): MenuNode {
  const offsetLimit = prefix === "x" ? GRID_WIDTH - 1 : GRID_HEIGHT - 1;
  return {
    kind: "group",
    label,
    children: [
      {
        kind: "group",
        label: "Pitch Steps",
        children: [
          { kind: "bool", label: "Enabled", key: `${prefix}.pitch.enabled` },
          { kind: "number", label: "Steps", key: `${prefix}.pitch.steps`, min: -16, max: 16, step: 1, visible: (c) => readValue(c, `${prefix}.pitch.enabled`) === true }
        ]
      },
      laneGroup("Velocity", `${prefix}.velocity`, offsetLimit),
      laneGroup("Filter Cutoff", `${prefix}.filterCutoff`, offsetLimit),
      laneGroup("Filter Resonance", `${prefix}.filterResonance`, offsetLimit)
    ]
  };
}

function laneGroup(label: string, prefix: string, offsetLimit: number): MenuNode {
  return {
    kind: "group",
    label,
    children: [
      { kind: "bool", label: "Enabled", key: `${prefix}.enabled` },
      { kind: "number", label: "From", key: `${prefix}.from`, min: 0, max: 127, step: 1, visible: (c) => readValue(c, `${prefix}.enabled`) === true },
      { kind: "number", label: "To", key: `${prefix}.to`, min: 0, max: 127, step: 1, visible: (c) => readValue(c, `${prefix}.enabled`) === true },
      { kind: "number", label: "Grid Offset", key: `${prefix}.gridOffset`, min: -offsetLimit, max: offsetLimit, step: 1, visible: (c) => readValue(c, `${prefix}.enabled`) === true },
      { kind: "enum", label: "Curve", key: `${prefix}.curve`, options: ["linear", "curve"], visible: (c) => readValue(c, `${prefix}.enabled`) === true }
    ]
  };
}

function currentMenuView<TState>(state: PlatformState<TState>): { path: string; lines: string[] } {
  const { runtimeConfig: cfg, menu } = state;
  const { siblings, path } = locate(menuTree(), cfg, menu);
  const shortPath = abbreviatePath(path);
  if (!siblings.length) return { path: shortPath, lines: [] };
  const cursor = clamp(menu.cursor, 0, siblings.length - 1);
  const bodyBudget = Math.max(1, OLED_TEXT_LINES - 1);
  let start = cursor;
  let end = cursor + 1;
  let rowCount = formatMenuItemLines(siblings[cursor], state, true, menu.editing).length;

  while (rowCount < bodyBudget && (start > 0 || end < siblings.length)) {
    let grew = false;
    if (start > 0) {
      const prevRows = formatMenuItemLines(siblings[start - 1], state, false, false).length;
      if (rowCount + prevRows <= bodyBudget || end >= siblings.length) {
        start -= 1;
        rowCount += prevRows;
        grew = true;
      }
    }
    if (rowCount >= bodyBudget) break;
    if (end < siblings.length) {
      const nextRows = formatMenuItemLines(siblings[end], state, false, false).length;
      if (rowCount + nextRows <= bodyBudget || start === 0) {
        end += 1;
        rowCount += nextRows;
        grew = true;
      }
    }
    if (!grew) break;
  }

  const lines: string[] = [];
  for (let i = start; i < end; i += 1) {
    lines.push(...formatMenuItemLines(siblings[i], state, i === cursor, i === cursor && menu.editing));
  }
  return { path: shortPath, lines: lines.slice(0, bodyBudget) };
}

function abbreviatePath(path: string): string {
  const map: Record<string, string> = {
    Transport: "TRN",
    Audio: "AUD",
    Engine: "ENG",
    Interpretation: "INT",
    Mapping: "MAP",
    System: "SYS"
  };
  if (!path || path === "Menu") return "MENU";
  return path
    .split("/")
    .map((part) => map[part] ?? part)
    .join("/");
}

function formatMenuItemLines<TState>(item: MenuNode, state: PlatformState<TState>, selected: boolean, editing: boolean): string[] {
  const selectedPrefix = "@@";
  const mark = selected ? selectedPrefix : "";
  if (item.kind === "group") {
    return [`${mark}> ${item.label}`];
  }
  const value = formatDisplayValue(item.key, readAnyValue(state, item.key));
  if (selected) {
    return [`${mark}> ${item.label}:`, `${mark}${editing ? " *" : "  "}${value}`];
  }
  return [`  ${item.label}`];
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

function cellsToLeds(cells: boolean[], scanCursor: { axis: ScanAxis; index: number } | null, brightness: number): LedCell[] {
  const b = clamp(brightness, 0.1, 1);
  return cells.map((alive, i) => {
    const x = i % GRID_WIDTH;
    const y = Math.floor(i / GRID_WIDTH);
    const inCursor =
      scanCursor !== null &&
      ((scanCursor.axis === "columns" && x === scanCursor.index) ||
        (scanCursor.axis === "rows" && y === scanCursor.index));

    if (!inCursor) {
      return alive ? scaleLed({ r: 0, g: 255, b: 120 }, b) : scaleLed({ r: 15, g: 15, b: 22 }, b);
    }

    if (alive) {
      return scaleLed({ r: 90, g: 160, b: 120 }, b);
    }
    return scaleLed({ r: 70, g: 70, b: 76 }, b);
  });
}

function scaleLed(cell: LedCell, brightness: number): LedCell {
  return {
    r: Math.round(cell.r * brightness),
    g: Math.round(cell.g * brightness),
    b: Math.round(cell.b * brightness)
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mod(value: number, base: number): number {
  return ((value % base) + base) % base;
}

const PPQN = 24;
const FRAME_SECONDS = 0.15;

export function toOledLines(display: DisplayFrame): string[] {
  const title = fitOledText(display.title);
  const body = display.lines.filter((line) => line.trim().length > 0).slice(0, OLED_TEXT_LINES - 1).map(fitOledText);
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
  if (key === "displayBrightness") return `OLED ${value}%`;
  if (key === "gridBrightness") return `Grid ${value}%`;
  if (key === "buttonBrightness") return `Btn ${value}%`;
  if (key === "populationMode") return value === "grid" ? "Sequencer" : "Conway";
  if (key === "scanMode") return value === "immediate" ? "Immediate" : "Scanning";
  if (key === "scanAxis") return value === "columns" ? "Cols" : "Rows";
  if (key === "scanDirection") return value === "forward" ? "Fwd" : "Rev";
  if (key === "pitch.startingNote" || key === "pitch.lowestNote" || key === "pitch.highestNote") {
    return formatNoteWithMidi(Number(value));
  }
  if (key === "pitch.outOfRange") return value === "wrap" ? "Wrap" : "Clamp";
  if (key === "pitch.scale") return formatScaleName(String(value));
  if (key === "pitch.root") return String(value);
  if (key === "transport.playing") return value === true || value === "true" ? "Play" : "Stop";
  if (key === "eventParity") return value === "none" ? "All" : "Odd/Even";
  if (typeof value === "boolean") return value ? "On" : "Off";
  return String(value);
}

function applyModulation(intents: { x: number; y: number; degree: number; kind: any }[], events: MusicalEvent[], cfg: RuntimeConfig): MusicalEvent[] {
  const out: MusicalEvent[] = [];
  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    const intent = intents[i] ?? intents[intents.length - 1];
    if (!intent) {
      out.push(event);
      continue;
    }
    const targetChannel = event.type === "note_on" ? event.channel : 0;
    const ccs = ccFromIntent(intent, cfg, targetChannel);
    out.push(...ccs);
    if (event.type === "note_on") {
      const note = pitchFromIntent(intent, cfg, event.note);
      const vel = velocityFromIntent(intent, cfg);
      if (vel !== null) {
        out.push({ ...event, note, velocity: vel });
        continue;
      }
      out.push({ ...event, note });
      continue;
    }
    out.push(event);
  }
  return out;
}

function pitchFromIntent(intent: { x: number; y: number }, cfg: RuntimeConfig, fallbackNote: number): number {
  const xNorm = normalizedAxis(intent.x, GRID_WIDTH, 0);
  const yNorm = normalizedAxis(intent.y, GRID_HEIGHT, 0);
  const xPos = Math.round(xNorm * (GRID_WIDTH - 1));
  const yPos = Math.round(yNorm * (GRID_HEIGHT - 1));
  const xDelta = cfg.x.pitch.enabled ? xPos * cfg.x.pitch.steps : 0;
  const yDelta = cfg.y.pitch.enabled ? yPos * cfg.y.pitch.steps : 0;
  if (!cfg.x.pitch.enabled && !cfg.y.pitch.enabled) return fallbackNote;
  const low = Math.min(cfg.pitch.lowestNote, cfg.pitch.highestNote);
  const high = Math.max(cfg.pitch.lowestNote, cfg.pitch.highestNote);
  const scaleNotes = buildScaleNotes(cfg.pitch.scale, cfg.pitch.root, low, high);
  if (scaleNotes.length === 0) return clamp(fallbackNote, low, high);
  const startIndex = nearestScaleIndex(scaleNotes, cfg.pitch.startingNote);
  let targetIndex = startIndex + xDelta + yDelta;
  if (cfg.pitch.outOfRange === "clamp") {
    targetIndex = clamp(targetIndex, 0, scaleNotes.length - 1);
  } else {
    targetIndex = mod(targetIndex, scaleNotes.length);
  }
  return scaleNotes[targetIndex] ?? clamp(fallbackNote, low, high);
}

function velocityFromIntent(intent: { x: number; y: number }, cfg: RuntimeConfig): number | null {
  const vals: number[] = [];
  if (cfg.x.velocity.enabled) vals.push(valueFromAxis(intent.x, GRID_WIDTH, cfg.x.velocity));
  if (cfg.y.velocity.enabled) vals.push(valueFromAxis(intent.y, GRID_HEIGHT, cfg.y.velocity));
  if (vals.length === 0) return null;
  return clamp(Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), 1, 127);
}

function ccFromIntent(intent: { x: number; y: number }, cfg: RuntimeConfig, channel: number): MusicalEvent[] {
  const events: MusicalEvent[] = [];
  const pushCc = (controller: number, source: number, min: number, max: number) => {
    const scaled = clamp(Math.round(min + source * (max - min)), 0, 127);
    events.push({ type: "cc", channel: clamp(channel, 0, 15), controller, value: scaled });
  };
  if (cfg.x.filterCutoff.enabled) pushCc(74, normalizedAxis(intent.x, GRID_WIDTH, cfg.x.filterCutoff.gridOffset), cfg.x.filterCutoff.from, cfg.x.filterCutoff.to);
  if (cfg.y.filterCutoff.enabled) pushCc(74, normalizedAxis(intent.y, GRID_HEIGHT, cfg.y.filterCutoff.gridOffset), cfg.y.filterCutoff.from, cfg.y.filterCutoff.to);
  if (cfg.x.filterResonance.enabled) pushCc(71, normalizedAxis(intent.x, GRID_WIDTH, cfg.x.filterResonance.gridOffset), cfg.x.filterResonance.from, cfg.x.filterResonance.to);
  if (cfg.y.filterResonance.enabled) pushCc(71, normalizedAxis(intent.y, GRID_HEIGHT, cfg.y.filterResonance.gridOffset), cfg.y.filterResonance.from, cfg.y.filterResonance.to);
  return events;
}

function valueFromAxis(index: number, size: number, lane: ValueLaneConfig): number {
  const norm = normalizedAxis(index, size, lane.gridOffset);
  return lane.from + norm * (lane.to - lane.from);
}

function normalizedAxis(index: number, size: number, gridOffset: number): number {
  const shifted = mod(index + gridOffset, size);
  return shifted / Math.max(1, size - 1);
}

function formatNoteWithMidi(note: number): string {
  const n = clamp(Math.round(note), 0, 127);
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const name = names[n % 12];
  const octave = Math.floor(n / 12) - 1;
  return `${name}${octave} (${n})`;
}

function formatScaleName(scale: string): string {
  const map: Record<string, string> = {
    chromatic: "Chromatic",
    major: "Major",
    natural_minor: "Natural Minor",
    dorian: "Dorian",
    mixolydian: "Mixolydian",
    major_pentatonic: "Maj Pentatonic",
    minor_pentatonic: "Min Pentatonic",
    harmonic_minor: "Harm Minor"
  };
  return map[scale] ?? scale;
}

function buildScaleNotes(scale: ScaleId, root: RootName, low: number, high: number): number[] {
  const intervals = scaleIntervals(scale);
  const rootPc = rootPitchClass(root);
  const notes: number[] = [];
  for (let n = clamp(low, 0, 127); n <= clamp(high, 0, 127); n += 1) {
    const pc = mod(n - rootPc, 12);
    if (intervals.includes(pc)) notes.push(n);
  }
  return notes;
}

function nearestScaleIndex(notes: number[], target: number): number {
  let bestIdx = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < notes.length; i += 1) {
    const d = Math.abs(notes[i] - target);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function rootPitchClass(root: RootName): number {
  const map: Record<RootName, number> = {
    C: 0,
    "C#": 1,
    D: 2,
    "D#": 3,
    E: 4,
    F: 5,
    "F#": 6,
    G: 7,
    "G#": 8,
    A: 9,
    "A#": 10,
    B: 11
  };
  return map[root];
}

function scaleIntervals(scale: ScaleId): number[] {
  switch (scale) {
    case "chromatic":
      return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    case "major":
      return [0, 2, 4, 5, 7, 9, 11];
    case "natural_minor":
      return [0, 2, 3, 5, 7, 8, 10];
    case "dorian":
      return [0, 2, 3, 5, 7, 9, 10];
    case "mixolydian":
      return [0, 2, 4, 5, 7, 9, 10];
    case "major_pentatonic":
      return [0, 2, 4, 7, 9];
    case "minor_pentatonic":
      return [0, 3, 5, 7, 10];
    case "harmonic_minor":
      return [0, 2, 3, 5, 7, 8, 11];
  }
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

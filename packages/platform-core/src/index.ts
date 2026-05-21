import { type BehaviorEngine, getBehavior, registerBehavior } from "@cellsymphony/behavior-api";
import { sequencerBehavior } from "@cellsymphony/behaviors-sequencer";
import { brainBehavior } from "@cellsymphony/behaviors-brain";
import { lifeBehavior } from "@cellsymphony/behaviors-life";
import { antBehavior } from "@cellsymphony/behaviors-ant";
import { bounceBehavior } from "@cellsymphony/behaviors-bounce";
import { shapesBehavior } from "@cellsymphony/behaviors-pulse";
import { raindropsBehavior } from "@cellsymphony/behaviors-raindrops";
import { dlaBehavior } from "@cellsymphony/behaviors-dla";
import { gliderBehavior } from "@cellsymphony/behaviors-glider";
import {
  GRID_HEIGHT,
  GRID_WIDTH,
  type DeviceInput,
  type DisplayFrame,
  type PageId,
  type SimulatorFrame,
  type TransportFrame
} from "@cellsymphony/device-contracts";
import { type MappingConfig } from "@cellsymphony/mapping-core";
import type { MusicalEvent } from "@cellsymphony/musical-events";
import { resolveMenuHelp, type HelpTarget } from "./menuHelp";
import { menuHelpTargetFromNode } from "./menuHelpTargets";
import {
  getSectionColorFromPath,
  isSpawnActionType,
  spawnActionTypeForBehavior
} from "./menuPresentation";
import { applyGlobalSound, pitchFromIntent } from "./musicTransforms";
import { axisGroup, midiInputNodes, midiOutputNodes, presetListNodes, presetRenameNodes, sampleBrowserNodes } from "./menuNodes";
import { currentMenuView as renderCurrentMenuView, locate, visibleChildren } from "./menuView";
import { pressMenuInput, turnMenuInput } from "./menuInput";
import { applyAuxUnbindChoice, assignAuxEncoder, pressAuxEncoder, turnAuxEncoder } from "./auxInput";
import { handleMenuAction } from "./actions";
import { getSynthPreset } from "./synthPresets";
export { GRID_DOMAIN, createGridDomain, type GridCell, type GridDomain } from "./gridDomain";
export { PLATFORM_CAPS } from "./platformCaps";
import {
  factoryPayload,
  formatTimestamp,
  readAnyValue,
  reinitBehaviorState,
  textEditTurn,
  writeAnyValue
} from "./stateHelpers";
import { applyExternalClockPulses, tickTransport } from "./transportRuntime";
import { buildMenuTree } from "./menuTree";
import { routeInputWithDeps } from "./inputRouter";
import { createInitialPlatformState } from "./initialState";
import {
  applyConfigPayload as applyConfigPayloadRuntime,
  applyStoreResult as applyStoreResultRuntime,
  extractConfigPayload as extractConfigPayloadRuntime
} from "./storeRuntime";
import { clampPartIndex, PLATFORM_CAPS } from "./platformCaps";
import {
  clamp,
  fitOledMenuLine as fitOledMenuLineToColumns,
  fitOledText as fitOledTextToColumns,
  fitOledTextToWidth,
  formatDisplayValue,
  readValue,
  wrapOledText,
  writeValue
} from "./coreUtils";

// Register available behaviors
registerBehavior(sequencerBehavior);
registerBehavior(lifeBehavior);
registerBehavior(brainBehavior);
registerBehavior(antBehavior);
registerBehavior(bounceBehavior);
registerBehavior(shapesBehavior);
registerBehavior(raindropsBehavior);
registerBehavior(dlaBehavior);
registerBehavior(gliderBehavior);

function resolveBehavior(activeId: string): BehaviorEngine<any, any> {
  return getBehavior(activeId) ?? sequencerBehavior;
}

import { buildSimulatorFrame } from "./simulatorFrameBuilder";
import { emergencyBrakeState } from "./transportSafety";

import {
  OLED_HEIGHT,
  OLED_TEXT_COLUMNS,
  OLED_TEXT_LINES,
  OLED_WIDTH,
  type ActionSpec,
  type AuxBinding,
  type ConfigPayload,
  type ConfirmKind,
  type ConfirmState,
  type Direction,
  type MenuNode,
  type MenuState,
  type MidiPortInfo,
  type NoteUnit,
  type PendingAction,
  type PlatformEffect,
  type PlatformState,
  type RuntimeConfig,
  type ScanAxis,
  type StoreResult,
  type SystemState
} from "./platformTypes";
export {
  OLED_HEIGHT,
  OLED_TEXT_COLUMNS,
  OLED_TEXT_LINES,
  OLED_WIDTH
} from "./platformTypes";
export type {
  ActionSpec,
  ConfigPayload,
  MenuNode,
  PlatformEffect,
  PlatformState,
  RuntimeConfig,
  StoreResult
} from "./platformTypes";

export function createInitialState<TState>(behavior: BehaviorEngine<TState, unknown>): PlatformState<TState> {
  return createInitialPlatformState(behavior);
}

export function routeInput<TState>(
  state: PlatformState<TState>,
  input: DeviceInput,
  behavior: BehaviorEngine<TState, unknown>
): { state: PlatformState<TState>; events: MusicalEvent[]; effects: PlatformEffect[] } {
  const routed = routeInputWithDeps(state, input, behavior, {
    isMainEncoderInput,
    applyAuxUnbindChoice,
    writeAnyValue,
    backMenu,
    applyExternalClockPulses,
    locate,
    menuTree,
    resolveBehavior,
    readAnyValue,
    openContextHelp,
    pressMenu,
    turnMenu,
    assignAuxEncoder,
    pressAuxEncoder,
    turnAuxEncoder,
    reinitBehaviorState: (s, k) => reinitBehaviorState(s, k, resolveBehavior),
    autoSaveEffect,
    formatDisplayValue,
    isSpawnActionType,
    spawnActionTypeForBehavior,
    executeConfirmed
  });
  const active = clampPartIndex((routed.state.runtimeConfig as any).activePartIndex ?? 0);
  const partStates = Array.isArray((routed.state as any).partStates) ? ([...((routed.state as any).partStates as any[])] as any[]) : [];
  while (partStates.length < PLATFORM_CAPS.partCount) partStates.push(routed.state.behaviorState);
  partStates[active] = routed.state.behaviorState;
  return { ...routed, state: { ...routed.state, partStates } };
}

function executeConfirmed<TState>(
  state: PlatformState<TState>,
  action: PendingAction,
  effects: PlatformEffect[],
  behavior: BehaviorEngine<TState, unknown>
): PlatformState<TState> {
  if (action.kind === "factory_load") {
    const factoryBehavior = resolveBehavior("life") as BehaviorEngine<TState, unknown>;
    const factory = factoryPayload(factoryBehavior, createInitialState, extractConfigPayload);
    const next = applyConfigPayload(state, factory, factoryBehavior);
    return { ...next, system: { ...next.system, currentPresetName: null } };
  }
  if (action.kind === "default_load") {
    effects.push({ type: "store_load_default" });
    return state;
  }
  if (action.kind === "default_save") {
    effects.push({ type: "store_save_default", payload: extractConfigPayload(state) });
    return state;
  }
  if (action.kind === "preset_load") {
    effects.push({ type: "store_load_preset", name: action.name });
    return state;
  }
  if (action.kind === "preset_delete") {
    effects.push({ type: "store_delete_preset", name: action.name });
    return state;
  }
  if (action.kind === "preset_save") {
    effects.push({ type: "store_save_preset", name: action.name, payload: extractConfigPayload(state) });
    return state;
  }
  if (action.kind === "preset_rename") {
    effects.push({ type: "store_load_preset", name: action.from });
    return { ...state, system: { ...state.system, pendingRename: { from: action.from, to: action.to } } };
  }
  if (action.kind === "midi_panic") {
    effects.push({ type: "midi_panic" });
    return state;
  }
  if (action.kind === "synth_preset_load") {
    const preset = getSynthPreset(action.presetId as any);
    if (!preset) return state;
    const instruments = Array.isArray(state.runtimeConfig.instruments) ? state.runtimeConfig.instruments.slice() : [];
    const slot = Math.max(0, Math.min(PLATFORM_CAPS.instrumentCount - 1, action.slot | 0));
    const current = instruments[slot];
    if (!current) return state;
    instruments[slot] = { ...current, synth: structuredClone(preset.synth) };
    const next = {
      ...state,
      runtimeConfig: { ...state.runtimeConfig, instruments },
      system: { ...state.system, toast: { message: `Loaded synth: ${preset.label}`, untilMs: Date.now() + 2000 } }
    };
    if (next.runtimeConfig.autoSaveDefault) {
      effects.push({ type: "store_save_default", payload: extractConfigPayload(next) });
    }
    return next;
  }
  if (action.kind === "text_dirty_exit") {
    // Save path for a text exit prompt.
    // Clear edit session and exit editing, then optionally run configured action.
    let next: PlatformState<TState> = {
      ...state,
      system: { ...state.system, textEdit: null },
      menu: { ...state.menu, editing: false }
    };
    if (action.saveAction) {
      next = handleAction(next, action.saveAction, effects);
    }
    if (action.backAfter) {
      next = { ...next, menu: backMenu(next.menu) };
    }
    return next;
  }
  return state;
}

function textBackspace<TState>(state: PlatformState<TState>, key: string): PlatformState<TState> {
  const raw = String(readAnyValue(state, key) ?? "");
  const cursor = clamp(state.system.nameCursor, 0, raw.length);
  if (cursor <= 0) return state;
  const next = raw.slice(0, cursor - 1) + raw.slice(cursor);
  return {
    ...state,
    system: { ...state.system, draftName: next, nameCursor: cursor - 1 }
  };
}

export function tick<TState>(
  state: PlatformState<TState>,
  behavior: BehaviorEngine<TState, unknown>,
  elapsedSeconds: number = FRAME_SECONDS
): { state: PlatformState<TState>; events: MusicalEvent[]; effects: PlatformEffect[] } {
  const events: MusicalEvent[] = [];
  const effects: PlatformEffect[] = [];
  let next = { ...state };
  const nowMs = Date.now();

  // OLED sleep/splash timing.
  {
    const sleepMs = Math.max(0, Math.floor(next.runtimeConfig.screenSleepSeconds * 1000));
    if (next.system.oledMode === "normal" && sleepMs > 0 && nowMs - next.system.lastInteractionMs >= sleepMs) {
      next.system = {
        ...next.system,
        oledMode: "splash",
        oledSplashText: "Going to sleep",
        oledSplashUntilMs: nowMs + 3000
      };
    } else if (next.system.oledMode === "splash" && nowMs >= next.system.oledSplashUntilMs) {
      // Startup splash returns to normal; sleep splash turns OLED off.
      const nextMode = next.system.oledSplashText === "Starting up" ? "normal" : "off";
      next.system = {
        ...next.system,
        oledMode: nextMode,
        toast:
          nextMode === "normal"
            ? { message: "Help=Sh+Fn+Enter", untilMs: nowMs + 2500 }
            : next.system.toast
      };
    }
  }

  // Transport flash decay.
  if (next.system.transportFlashUntilMs > 0 && nowMs > next.system.transportFlashUntilMs) {
    next.system = { ...next.system, transportFlashUntilMs: 0, transportFlash: "none" };
  }

  const advanced = tickTransport(next, behavior, elapsedSeconds);
  next = advanced.state;
  events.push(...advanced.events);

  if (events.some((e) => e.type === "note_on")) {
    next.system = { ...next.system, eventBlipUntilMs: nowMs + 100 };
  }
  return { state: next, events, effects };
}

export function extractConfigPayload<TState>(state: PlatformState<TState>): ConfigPayload {
  return extractConfigPayloadRuntime(state);
}

export function applyConfigPayload<TState>(
  state: PlatformState<TState>,
  payload: ConfigPayload,
  behavior: BehaviorEngine<TState, unknown>
): PlatformState<TState> {
  return applyConfigPayloadRuntime(state, payload, behavior, {
    resolveBehavior,
    factoryPayload: (b) => factoryPayload(b, createInitialState, extractConfigPayload)
  });
}

export function applyStoreResult<TState>(
  state: PlatformState<TState>,
  result: StoreResult,
  behavior: BehaviorEngine<TState, unknown>
): { state: PlatformState<TState>; effects: PlatformEffect[] } {
  return applyStoreResultRuntime(state, result, behavior, {
    resolveBehavior,
    factoryPayload: (b) => factoryPayload(b, createInitialState, extractConfigPayload)
  });
}

export function toSimulatorFrame<TState>(state: PlatformState<TState>, behavior: BehaviorEngine<TState, unknown>): SimulatorFrame {
  const activePart = clampPartIndex((state.runtimeConfig as any).activePartIndex ?? 0);
  const part = (state.runtimeConfig as any).parts?.[activePart];
  const activeBehaviorId = String(part?.l1?.behaviorId ?? state.runtimeConfig.activeBehavior);
  const engine = (resolveBehavior(activeBehaviorId) as BehaviorEngine<any, unknown>) ?? behavior;
  const partStates = Array.isArray((state as any).partStates) ? ((state as any).partStates as any[]) : [];
  const model = engine.renderModel((partStates[activePart] ?? state.behaviorState) as any);
  const menuView = currentMenuView(state);
  const scanMode = part?.l2?.scanMode ?? state.runtimeConfig.scanMode;
  const scanAxis = part?.l2?.scanAxis ?? state.runtimeConfig.scanAxis;
  const scanIndex = ((state as any).partScanIndex?.[activePart] ?? state.scanIndex) as number;
  const scanCursor = scanMode === "scanning" ? { axis: scanAxis, index: scanIndex } : null;
  return buildSimulatorFrame({ state, activePart, engine, model, menuView, scanCursor, toOledLines });
}

function menuTree<TState>(state: PlatformState<TState>): MenuNode {
  return buildMenuTree(state, {
    resolveBehavior,
    axisGroup,
    presetListNodes,
    presetRenameNodes,
    midiOutputNodes,
    midiInputNodes,
    sampleBrowserNodes
  });
}

function currentMenuView<TState>(state: PlatformState<TState>): { path: string; lines: string[]; colors: number[] } {
  return renderCurrentMenuView({
    state,
    menuTree,
    fitOledText: (text: string) => fitOledTextToColumns(text, OLED_TEXT_COLUMNS),
    readAnyValue,
    formatDisplayValue,
    oledTextLines: OLED_TEXT_LINES
  });
}

function openContextHelp<TState>(state: PlatformState<TState>): PlatformState<TState> {
  const view = locate(menuTree(state), state, state.menu);
  const selected = view.siblings[state.menu.cursor];
  if (!selected || selected.kind === "spacer") return state;
  const target = menuHelpTargetFromNode(view.path, selected);
  const help = resolveMenuHelp(target);
  const lines = wrapOledText(help.detail, OLED_TEXT_COLUMNS);
  return {
    ...state,
    system: {
      ...state.system,
      confirm: {
        kind: "help_info",
        action: { kind: "help_info", title: help.title, lines },
        cursor: 0,
        options: ["Close"],
        scroll: 0
      }
    }
  };
}


function backMenu(menu: MenuState): MenuState {
  if (menu.editing) return { ...menu, editing: false };
  if (menu.stack.length === 0) return menu;
  return { ...menu, stack: menu.stack.slice(0, -1), cursor: 0 };
}

function pressMenu<TState>(state: PlatformState<TState>, effects: PlatformEffect[]): PlatformState<TState> {
  return pressMenuInput(state, effects, {
    menuTree,
    handleAction,
    readAnyValue,
    formatTimestamp,
    extractConfigPayload
  });
}

function turnMenu<TState>(state: PlatformState<TState>, delta: -1 | 1, effects: PlatformEffect[]): PlatformState<TState> {
  return turnMenuInput(state, delta, effects, {
    menuTree,
    readAnyValue,
    writeAnyValue,
    reinitBehaviorState: (nextState, key) => reinitBehaviorState(nextState, key, resolveBehavior),
    autoSaveEffect,
    textEditTurn
  });
}

function handleAction<TState>(state: PlatformState<TState>, action: ActionSpec, effects: PlatformEffect[]): PlatformState<TState> {
  return handleMenuAction(state, action, effects, {
    writeValue,
    extractConfigPayload,
    resolveBehavior
  });
}

function autoSaveEffect<TState>(state: PlatformState<TState>, effects: PlatformEffect[]): void {
  if (state.runtimeConfig.autoSaveDefault) {
    effects.push({ type: "store_save_default", payload: extractConfigPayload(state) });
  }
}


const FRAME_SECONDS = 0.15;

export function toOledLines(display: DisplayFrame): { lines: string[]; colors: number[] } {
  const title = fitOledTextToColumns(display.title, OLED_TEXT_COLUMNS);
  const titleColor = getSectionColorFromPath(display.title);
  const body = display.lines
    .slice(0, OLED_TEXT_LINES - 1)
    .map((line, idx) => ({
      line: line.trim().length === 0 ? "" : fitOledMenuLineToColumns(line, OLED_TEXT_COLUMNS),
      color: display.colors?.[idx] ?? 0xffff
    }));
  // Keep empty lines - they render as blank spacer lines
  return {
    lines: [title, ...body.map(b => b.line)].slice(0, OLED_TEXT_LINES),
    colors: [titleColor, ...body.map(b => b.color)].slice(0, OLED_TEXT_LINES)
  };
}

export function enumerateMenuHelpTargets<TState>(state: PlatformState<TState>): HelpTarget[] {
  const out: HelpTarget[] = [];
  function walk(node: MenuNode, s: PlatformState<TState>, path: string): void {
    const kids = visibleChildren(node, s);
    for (const child of kids) {
      if (child.kind === "spacer") continue;
      out.push(menuHelpTargetFromNode(path, child));
      if (child.kind === "group") {
        walk(child, s, `${path} > ${child.label ?? "Group"}`);
      }
    }
  }
  const root = menuTree(state);
  walk(root, state, "Menu");
  return out;
}

export type EnumHelpTarget = {
  path: string;
  key: string;
  kind: "enum";
  options: string[];
};

export function enumerateEnumHelpTargets<TState>(state: PlatformState<TState>): EnumHelpTarget[] {
  const out: EnumHelpTarget[] = [];
  function walk(node: MenuNode, s: PlatformState<TState>, path: string): void {
    const kids = visibleChildren(node, s);
    for (const child of kids) {
      if (child.kind === "group") {
        walk(child, s, `${path} > ${child.label ?? "Group"}`);
        continue;
      }
      if (child.kind !== "enum") continue;
      out.push({
        path: `${path} > ${child.label ?? "Option"}`,
        key: `key:${child.key}`,
        kind: "enum",
        options: child.options.slice()
      });
    }
  }
  walk(menuTree(state), state, "Menu");
  return out;
}

function isMainEncoderInput(id: "main" | "aux1" | "aux2" | "aux3" | "aux4" | undefined): boolean {
  return id === undefined || id === "main";
}

export function emergencyBrake<TState>(state: PlatformState<TState>): { state: PlatformState<TState>; events: MusicalEvent[] } {
  return emergencyBrakeState(state);
}

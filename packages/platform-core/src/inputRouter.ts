import type { BehaviorEngine } from "@cellsymphony/behavior-api";
import { GRID_HEIGHT, GRID_WIDTH, type DeviceInput } from "@cellsymphony/device-contracts";
import type { MusicalEvent } from "@cellsymphony/musical-events";
import { interpretGrid, type AxisStrategy, type InterpretationProfile, type TickStrategy } from "@cellsymphony/interpretation-core";
import { mapIntentsToMusicalEvents } from "@cellsymphony/mapping-core";
import { clamp } from "./coreUtils";
import { clampPartIndex, PLATFORM_CAPS } from "./platformCaps";
import type { PlatformEffect, PlatformState, RuntimeConfig } from "./index";
import { toGridSnapshot } from "./runtimeHelpers";
import { applyModulation, applyNoteBehavior, withScaleSteps } from "./musicTransforms";
import { makeToast } from "./toast";
import type { TouchMode } from "./platformTypes";

type Deps<TState> = {
  isMainEncoderInput: (id: "main" | "aux1" | "aux2" | "aux3" | "aux4" | undefined) => boolean;
  applyAuxUnbindChoice: (state: PlatformState<TState>, encoderId: string, choice: string) => PlatformState<TState>;
  writeAnyValue: (state: PlatformState<TState>, key: string, value: unknown) => PlatformState<TState>;
  backMenu: (menu: any) => any;
  applyExternalClockPulses: (state: PlatformState<TState>, behavior: BehaviorEngine<TState, unknown>, pulses: number) => { state: PlatformState<TState>; events: MusicalEvent[] };
  locate: (root: any, state: PlatformState<TState>, menu: any) => any;
  menuTree: (state: PlatformState<TState>) => any;
  resolveBehavior: (activeId: string) => BehaviorEngine<any, any>;
  readAnyValue: (state: PlatformState<TState>, key: string) => unknown;
  openContextHelp: (state: PlatformState<TState>) => PlatformState<TState>;
  pressMenu: (state: PlatformState<TState>, effects: PlatformEffect[]) => PlatformState<TState>;
  turnMenu: (state: PlatformState<TState>, delta: -1 | 1, effects: PlatformEffect[]) => PlatformState<TState>;
  assignAuxEncoder: any;
  pressAuxEncoder: any;
  turnAuxEncoder: any;
  reinitBehaviorState: (state: PlatformState<TState>, key: string) => PlatformState<TState>;
  autoSaveEffect: (state: PlatformState<TState>, effects: PlatformEffect[]) => void;
  formatDisplayValue: (key: string, value: unknown, runtimeConfig?: any) => string;
  isSpawnActionType: (actionType: string) => boolean;
  spawnActionTypeForBehavior: (behaviorId: string) => string | null;
  executeConfirmed: (state: PlatformState<TState>, action: any, effects: PlatformEffect[], behavior: BehaviorEngine<TState, unknown>) => PlatformState<TState>;
};

const TOUCH_PAGES: TouchMode[] = ["mix", "pan", "fx"];

function touchPageFromRow(y: number, current: TouchMode): TouchMode {
  const direct = TOUCH_PAGES[Math.floor(y)];
  if (direct) return direct;
  const idx = TOUCH_PAGES.indexOf(current);
  return TOUCH_PAGES[(idx + 1) % TOUCH_PAGES.length] ?? "mix";
}

function handleTouchGridPress<TState>(state: PlatformState<TState>, input: Extract<DeviceInput, { type: "grid_press" }>, deps: Deps<TState>): PlatformState<TState> {
  if (input.x === GRID_WIDTH - 1) {
    return { ...state, system: { ...state.system, touchMode: touchPageFromRow(input.y, state.system.touchMode) } };
  }
  if (state.system.touchMode === "mix") {
    const inst = clamp(Math.floor(input.x), 0, Math.min(PLATFORM_CAPS.instrumentCount, GRID_WIDTH) - 1);
    const volume = Math.round(clamp(Math.floor(input.y), 0, GRID_HEIGHT - 1) / (GRID_HEIGHT - 1) * 100);
    return deps.writeAnyValue(state, `instruments.${inst}.mixer.volume`, volume);
  }
  if (state.system.touchMode === "pan") {
    const inst = clamp(Math.floor(input.y), 0, Math.min(PLATFORM_CAPS.instrumentCount, GRID_HEIGHT) - 1);
    const panPos = clamp(Math.floor(input.x), 0, GRID_WIDTH - 1);
    return deps.writeAnyValue(state, `instruments.${inst}.mixer.panPos`, panPos);
  }
  return state;
}

export function routeInputWithDeps<TState>(state: PlatformState<TState>, input: DeviceInput, behavior: BehaviorEngine<TState, unknown>, deps: Deps<TState>): { state: PlatformState<TState>; events: MusicalEvent[]; effects: PlatformEffect[] } {
  const events: MusicalEvent[] = [];
  const effects: PlatformEffect[] = [];
  let nextState = { ...state };
  const pressed = (i: any): boolean => (typeof i.pressed === "boolean" ? i.pressed : true);

  {
    const now = Date.now();
    const sys = nextState.system;
    const isMidiRealtime = input.type === "midi_clock" || input.type === "midi_start" || input.type === "midi_continue" || input.type === "midi_stop";
    const wasAsleep = sys.oledMode === "off" || sys.oledMode === "splash";
    nextState.system = { ...sys, lastInteractionMs: isMidiRealtime ? sys.lastInteractionMs : now, oledMode: !isMidiRealtime && wasAsleep ? "normal" : sys.oledMode };
    if (!isMidiRealtime && wasAsleep) return { state: nextState, events, effects };
  }

  if (nextState.system.confirm) {
    const c = nextState.system.confirm;
    if (input.type === "button_shift") nextState.system = { ...nextState.system, shiftHeld: pressed(input) };
    if (input.type === "button_fn") nextState.system = { ...nextState.system, fnHeld: pressed(input) };
    if (input.type === "encoder_turn" && deps.isMainEncoderInput(input.id)) {
      if (c.kind === "help_info" && c.action.kind === "help_info") {
        const contentSlots = Math.max(1, 8 - 2);
        const maxScroll = Math.max(0, c.action.lines.length - contentSlots);
        nextState.system = { ...nextState.system, confirm: { ...c, scroll: clamp(c.scroll + input.delta, 0, maxScroll) } };
      } else {
        nextState.system = { ...nextState.system, confirm: { ...c, cursor: clamp(c.cursor + input.delta, 0, c.options.length - 1) } };
      }
    } else if (input.type === "encoder_press" && deps.isMainEncoderInput(input.id)) {
      const choice = c.options[c.cursor];
      if (c.kind === "aux_unbind" && c.action.kind === "aux_unbind") {
        if (choice !== "Cancel") nextState = deps.applyAuxUnbindChoice(nextState, c.action.encoderId, choice);
      } else if (c.kind === "text_dirty_exit") {
        if (choice === "Save") nextState = deps.executeConfirmed(nextState, c.action, effects, behavior);
        else if (c.action.kind === "text_dirty_exit") {
          nextState = deps.writeAnyValue(nextState, c.action.key, c.action.original);
          nextState.system = { ...nextState.system, textEdit: null };
          nextState.menu = { ...nextState.menu, editing: false };
          if (c.action.backAfter) nextState.menu = deps.backMenu(nextState.menu);
        }
      } else if (choice === "Yes" || choice === "Confirm") {
        nextState = deps.executeConfirmed(nextState, c.action, effects, behavior);
      }
      nextState.system = { ...nextState.system, confirm: null };
    } else if (input.type === "button_a" && pressed(input)) {
      nextState.system = { ...nextState.system, confirm: null };
    }
    nextState.behaviorState = behavior.onInput(nextState.behaviorState, input, { bpm: nextState.transport.bpm, emit: (event) => events.push(event) });
    return { state: nextState, events, effects };
  }

  if (input.type === "button_shift") nextState.system = { ...nextState.system, shiftHeld: pressed(input), pendingCloneSource: pressed(input) ? nextState.system.pendingCloneSource : null };
  if (input.type === "button_fn") nextState.system = { ...nextState.system, fnHeld: pressed(input), pendingCloneSource: pressed(input) ? nextState.system.pendingCloneSource : null };

  if (nextState.system.sampleAssign) {
    if (input.type === "button_a" && pressed(input)) {
      nextState.system = { ...nextState.system, sampleAssign: null, sampleAssignLastPress: null, toast: makeToast("Assign mode off") };
      return { state: nextState, events, effects };
    }
    if (input.type === "grid_press") {
      const now = Date.now();
      const mode = nextState.system.shiftHeld
        ? (nextState.system.sampleAssignLastPress && nextState.system.sampleAssignLastPress.x === input.x && nextState.system.sampleAssignLastPress.y === input.y && now - nextState.system.sampleAssignLastPress.atMs <= 350 ? "column" : "row")
        : "single";
      nextState = applySampleAssignment(nextState, nextState.system.sampleAssign.instrumentSlot, nextState.system.sampleAssign.sampleSlot, input.x, input.y, mode as "single" | "row" | "column");
      nextState.system = {
        ...nextState.system,
        sampleAssignLastPress: nextState.system.shiftHeld ? { x: input.x, y: input.y, atMs: now } : null
      };
      deps.autoSaveEffect(nextState, effects);
      return { state: nextState, events, effects };
    }
  }

  if (input.type === "midi_clock") {
    if (nextState.runtimeConfig.midi.syncMode === "external" && nextState.runtimeConfig.midi.clockInEnabled) {
      const pulses = Math.max(0, Math.floor((input as any).pulses ?? 0));
      const advanced = deps.applyExternalClockPulses(nextState, behavior, pulses);
      nextState = advanced.state;
      events.push(...advanced.events);
      if (advanced.events.some((e) => e.type === "note_on")) nextState.system = { ...nextState.system, eventBlipUntilMs: Date.now() + 100 };
    }
    return { state: nextState, events, effects };
  }

  if (input.type === "midi_start" || input.type === "midi_continue" || input.type === "midi_stop") {
    if (nextState.runtimeConfig.midi.syncMode === "external" && nextState.runtimeConfig.midi.clockInEnabled && nextState.runtimeConfig.midi.respondToStartStop) {
      if (input.type === "midi_stop") {
        nextState.transport = { ...nextState.transport, playing: false };
        nextState.system = { ...nextState.system, stopLatched: true };
      } else if (!nextState.system.pausedByUser) {
        if (input.type === "midi_start") {
          nextState.transport = { ...nextState.transport, playing: true, ppqnPulse: 0, tick: 0 };
          nextState.partScanIndex = nextState.partScanIndex.map(() => 0);
          nextState.partScanPulseAccumulator = nextState.partScanPulseAccumulator.map(() => 0);
          nextState.partAlgorithmPulseAccumulator = nextState.partAlgorithmPulseAccumulator.map(() => 0);
          nextState.scanIndex = 0;
          nextState.scanPulseAccumulator = 0;
          nextState.algorithmPulseAccumulator = 0;
          nextState.ppqnPulseRemainder = 0;
          nextState.system = { ...nextState.system, stopLatched: false, pendingResync: false, externalPpqnPulse: 0 };
        } else {
          nextState.transport = { ...nextState.transport, playing: true };
          nextState.system = { ...nextState.system, stopLatched: false };
        }
      }
    }
    return { state: nextState, events, effects };
  }

  if (input.type === "grid_press" && nextState.system.fnHeld && nextState.system.shiftHeld && input.x === GRID_WIDTH - 1) {
    const srcIdx = clamp(Math.floor(input.y), 0, Math.min(PLATFORM_CAPS.partCount, GRID_HEIGHT) - 1);
    nextState.system = { ...nextState.system, pendingCloneSource: srcIdx, toast: makeToast(`Clone P${srcIdx + 1} → select target`) };
    return { state: nextState, events, effects };
  }

  if (input.type === "grid_press" && nextState.system.fnHeld && !nextState.system.shiftHeld && input.x === GRID_WIDTH - 1) {
    nextState.system = { ...nextState.system, touchMode: nextState.system.touchMode === "none" ? "mix" : nextState.system.touchMode, toast: makeToast("Touch") };
    nextState.menu = { stack: [3], cursor: 0, editing: false };
    return { state: nextState, events, effects };
  }

  if (nextState.system.touchMode !== "none" && !nextState.system.fnHeld && !nextState.system.shiftHeld && input.type === "grid_press") {
    nextState = handleTouchGridPress(nextState, input, deps);
    deps.autoSaveEffect(nextState, effects);
    return { state: nextState, events, effects };
  }

  if (nextState.system.touchMode !== "none" && !nextState.system.fnHeld && !nextState.system.shiftHeld && input.type === "grid_release") {
    return { state: nextState, events, effects };
  }

  if (input.type === "grid_press" && nextState.system.fnHeld && input.x === 0) {
    const idx = clamp(Math.floor(input.y), 0, Math.min(PLATFORM_CAPS.partCount, GRID_HEIGHT) - 1);
    const pending = nextState.system.pendingCloneSource;
    if (pending !== null && pending !== idx) {
      const parts = Array.isArray((nextState.runtimeConfig as any).parts) ? [...((nextState.runtimeConfig as any).parts as any[])] : [];
      parts[idx] = structuredClone(parts[pending]);
      nextState = { ...nextState, runtimeConfig: { ...(nextState.runtimeConfig as any), parts } as any };
      const partStates = Array.isArray((nextState as any).partStates) ? [...(nextState as any).partStates] : [];
      if (partStates[pending] !== undefined) partStates[idx] = structuredClone(partStates[pending]);
      (nextState as any).partStates = partStates;
    }
    nextState = deps.writeAnyValue(nextState, "activePartIndex", idx);
    nextState = deps.reinitBehaviorState(nextState, "activePartIndex");
    nextState.system = { ...nextState.system, pendingCloneSource: null, toast: makeToast(pending !== null && pending !== idx ? `Cloned P${pending + 1} → P${idx + 1}` : `Part ${idx + 1}`) };
    return { state: nextState, events, effects };
  }

  if (input.type === "button_s" && pressed(input)) {
    const view = deps.locate(deps.menuTree(nextState), nextState, nextState.menu);
    if (view.path.endsWith("/Choose Sample")) {
      const selected = view.siblings[nextState.menu.cursor] as any;
      if (selected?.kind === "action" && selected.action?.type === "sample_pick" && typeof selected.action.path === "string") {
        effects.push({ type: "sample_preview_request", path: selected.action.path } as any);
      }
      return { state: nextState, events, effects };
    }
  }

  if (input.type === "button_s" && pressed(input)) {
    if (nextState.runtimeConfig.midi.syncMode === "external" && nextState.system.shiftHeld) {
      nextState.system = { ...nextState.system, pendingResync: true };
      return { state: nextState, events, effects };
    }
    const wasPlaying = nextState.transport.playing;
    const now = Date.now();
    const playing = !wasPlaying;
    nextState.transport = { ...nextState.transport, playing };
    if (nextState.runtimeConfig.midi.syncMode === "external") {
      nextState.system = { ...nextState.system, pausedByUser: !playing };
      return { state: nextState, events, effects };
    }
    if (playing) {
      const isStopToPlay = nextState.system.stopLatched || (nextState.transport.ppqnPulse === 0 && nextState.transport.tick === 0);
      if (isStopToPlay) {
        nextState.transport = { ...nextState.transport, ppqnPulse: 0, tick: 0 };
        nextState.partScanIndex = nextState.partScanIndex.map(() => 0);
        nextState.partScanPulseAccumulator = nextState.partScanPulseAccumulator.map(() => 0);
        nextState.partAlgorithmPulseAccumulator = nextState.partAlgorithmPulseAccumulator.map(() => 0);
        nextState.scanPulseAccumulator = 0;
        nextState.algorithmPulseAccumulator = 0;
        nextState.ppqnPulseRemainder = 0;
        nextState.scanIndex = 0;
        nextState.system = { ...nextState.system, stopLatched: false, transportFlash: "measure", transportFlashUntilMs: now + 220 };
      } else {
        nextState.system = { ...nextState.system, stopLatched: false };
      }
    }
  } else if (input.type === "button_a" && pressed(input)) {
    const view = deps.locate(deps.menuTree(nextState), nextState, nextState.menu);
    const selected = view.siblings[nextState.menu.cursor];
    if (nextState.menu.editing && selected && selected.kind === "text" && nextState.system.shiftHeld) {
      const raw = String(deps.readAnyValue(nextState, selected.key) ?? "");
      const cursor = clamp(nextState.system.nameCursor, 0, raw.length);
      if (cursor > 0) {
        const next = raw.slice(0, cursor - 1) + raw.slice(cursor);
        nextState = { ...nextState, system: { ...nextState.system, draftName: next, nameCursor: cursor - 1 } };
      }
    } else if (nextState.system.fnHeld && nextState.system.shiftHeld) {
      const activePart = clampPartIndex((nextState.runtimeConfig as any).activePartIndex ?? 0);
      const parts = Array.isArray((nextState.runtimeConfig as any).parts) ? [...((nextState.runtimeConfig as any).parts as any[])] : [];
      const partStates = Array.isArray((nextState as any).partStates) ? [...(nextState as any).partStates] : [];
      const noneId = "none";
      const noneEngine = deps.resolveBehavior(noneId);
      const emptyCfg: any = {};
      if (noneEngine.configMenu) for (const item of noneEngine.configMenu(noneEngine.init({}))) { const val = emptyCfg[item.key]; if (val !== undefined) emptyCfg[item.key] = val; }
      parts[activePart] = {
        ...parts[activePart],
        l1: { stepRate: "1/4", behaviorId: noneId, behaviorConfig: emptyCfg, saveGridState: true },
        l2: { scanMode: "immediate", scanAxis: "columns", scanUnit: "1/8", scanDirection: "forward", eventEnabled: false, stateEnabled: false, pitch: { startingNote: 60, lowestNote: 36, highestNote: 83, outOfRange: "clamp", scale: "chromatic", root: "C" }, x: { pitch: { enabled: false, steps: 1 }, velocity: { enabled: false, steps: 8 } }, y: { pitch: { enabled: false, steps: 1 }, velocity: { enabled: false, steps: 8 } }, mapping: { activate: { action: "none", slot: 0 }, stable: { action: "none", slot: 0 }, deactivate: { action: "none", slot: 0 }, scanned: { action: "none", slot: 0 }, scanned_empty: { action: "none", slot: 0 } } },
        autoName: true,
        name: "none"
      };
      partStates[activePart] = noneEngine.init(emptyCfg);
      nextState = { ...nextState, runtimeConfig: { ...(nextState.runtimeConfig as any), parts } as any, behaviorState: noneEngine.init(emptyCfg), activeBehavior: noneId } as any;
      (nextState as any).partStates = partStates;
      nextState.system = { ...nextState.system, toast: makeToast(`P${activePart + 1} reset`) };
    } else if (nextState.system.shiftHeld && !nextState.system.fnHeld) {
      const activePart = clampPartIndex((nextState.runtimeConfig as any).activePartIndex ?? 0);
      const part: any = (nextState.runtimeConfig as any).parts?.[activePart];
      const behaviorId = String(part?.l1?.behaviorId ?? nextState.runtimeConfig.activeBehavior);
      const b = deps.resolveBehavior(behaviorId);
      const ns = (part?.l1?.behaviorConfig ?? nextState.runtimeConfig.behaviorConfig?.[behaviorId]) as Record<string, unknown> | undefined;
      const cfg: any = {};
      if (b.configMenu) for (const item of b.configMenu(b.init({}))) { const val = ns?.[item.key]; if (val !== undefined) cfg[item.key] = val; }
      nextState.behaviorState = b.init(cfg);
      if (Array.isArray((nextState as any).partStates) && (nextState as any).partStates.length > activePart) {
        (nextState as any).partStates[activePart] = nextState.behaviorState;
      }
      nextState.system = { ...nextState.system, toast: makeToast("Grid cleared") };
    } else {
      if (nextState.menu.editing && selected && selected.kind === "text") {
        const current = String(deps.readAnyValue(nextState, selected.key) ?? "");
        const sess = nextState.system.textEdit;
        const dirty = sess && sess.key === selected.key ? current !== sess.original : false;
        if (dirty && sess) {
          nextState.system = { ...nextState.system, confirm: { kind: "text_dirty_exit", action: { kind: "text_dirty_exit", key: sess.key, original: sess.original, saveAction: sess.saveAction, backAfter: true, mode: "save" }, cursor: 0, options: ["Save", "Discard"], scroll: 0 } };
        } else {
          nextState.system = { ...nextState.system, textEdit: null };
          nextState.menu = deps.backMenu(nextState.menu);
        }
      } else nextState.menu = deps.backMenu(nextState.menu);
    }
  } else if (input.type === "encoder_press" && deps.isMainEncoderInput(input.id)) {
    if (nextState.system.shiftHeld && nextState.system.fnHeld) return { state: deps.openContextHelp(nextState), events, effects };
    nextState = deps.pressMenu(nextState, effects);
  } else if (input.type === "encoder_turn" && deps.isMainEncoderInput(input.id)) {
    nextState = deps.turnMenu(nextState, input.delta, effects);
  }

  if (input.type === "encoder_press" && input.id && !deps.isMainEncoderInput(input.id)) {
    const auxDeps = {
      menuTree: deps.menuTree,
      resolveBehavior: deps.resolveBehavior,
      readAnyValue: deps.readAnyValue,
      writeAnyValue: deps.writeAnyValue,
      reinitBehaviorState: deps.reinitBehaviorState,
      autoSaveEffect: deps.autoSaveEffect,
      formatDisplayValue: deps.formatDisplayValue,
      isSpawnActionType: deps.isSpawnActionType,
      spawnActionTypeForBehavior: deps.spawnActionTypeForBehavior
    };
    nextState = nextState.system.shiftHeld
      ? deps.assignAuxEncoder(nextState, input.id, effects, auxDeps)
      : deps.pressAuxEncoder(nextState, input.id, effects, (event: MusicalEvent) => events.push(event), auxDeps);
  }
  if (input.type === "encoder_turn" && input.id && !deps.isMainEncoderInput(input.id)) {
    nextState = deps.turnAuxEncoder(nextState, input.id, input.delta, effects, {
      menuTree: deps.menuTree,
      resolveBehavior: deps.resolveBehavior,
      readAnyValue: deps.readAnyValue,
      writeAnyValue: deps.writeAnyValue,
      reinitBehaviorState: deps.reinitBehaviorState,
      autoSaveEffect: deps.autoSaveEffect,
      formatDisplayValue: deps.formatDisplayValue,
      isSpawnActionType: deps.isSpawnActionType,
      spawnActionTypeForBehavior: deps.spawnActionTypeForBehavior
    });
  }

  const beforeInputGrid = behavior.interpretInputTransitions ? toGridSnapshot(behavior.renderModel(nextState.behaviorState)) : null;
  nextState.behaviorState = behavior.onInput(nextState.behaviorState, input, { bpm: nextState.transport.bpm, emit: (event) => events.push(event) });
  if (beforeInputGrid) {
    const afterInputGrid = toGridSnapshot(behavior.renderModel(nextState.behaviorState));
    if (gridChanged(beforeInputGrid, afterInputGrid)) {
      const profile = inputTransitionProfile(nextState.runtimeConfig);
      const intents = interpretGrid(beforeInputGrid, afterInputGrid, nextState.transport.tick, profile);
      if (intents.length > 0) {
        const mapped = mapIntentsToMusicalEvents(intents, withScaleSteps(nextState.mappingConfig, nextState.runtimeConfig));
        const modulated = applyModulation(intents, mapped, nextState.runtimeConfig);
        const instruments: any[] = Array.isArray((nextState.runtimeConfig as any).instruments) ? ((nextState.runtimeConfig as any).instruments as any[]) : [];
        const shaped = applyNoteBehavior(modulated, instruments, 0, nextState.system.heldNotes);
        nextState.system = { ...nextState.system, heldNotes: shaped.heldNotes };
        events.push(...shaped.events);
      }
    }
  }
  if (events.some((e) => e.type === "note_on")) nextState.system = { ...nextState.system, eventBlipUntilMs: Date.now() + 100 };
  return { state: nextState, events, effects };
}

function gridChanged(before: { cells: boolean[] }, after: { cells: boolean[] }): boolean {
  const len = Math.min(before.cells.length, after.cells.length);
  for (let i = 0; i < len; i += 1) {
    if (before.cells[i] !== after.cells[i]) return true;
  }
  return false;
}

function inputTransitionProfile(cfg: RuntimeConfig): InterpretationProfile {
  const tick: TickStrategy = { mode: "whole_grid_transitions" };
  const axisX: AxisStrategy = cfg.x.pitch.enabled ? { mode: "scale_step", step: Math.abs(cfg.x.pitch.steps) } : { mode: "timing_only" };
  const axisY: AxisStrategy = cfg.y.pitch.enabled ? { mode: "scale_step", step: Math.abs(cfg.y.pitch.steps) } : { mode: "timing_only" };
  return {
    id: "input_profile",
    event: { enabled: cfg.eventEnabled },
    state: { enabled: false, tick },
    x: axisX,
    y: axisY
  };
}

function inputNoteBehavior(
  events: MusicalEvent[],
  runtimeConfig: RuntimeConfig,
  partIdx: number,
  initialHeld: string[]
): { events: MusicalEvent[]; heldNotes: string[] } {
  const instruments: any[] = Array.isArray((runtimeConfig as any).instruments) ? ((runtimeConfig as any).instruments as any[]) : [];
  return applyNoteBehavior(events, instruments, partIdx, initialHeld);
}

function applySampleAssignment<TState>(
  state: PlatformState<TState>,
  instrumentSlot: number,
  sampleSlot: number,
  x: number,
  y: number,
  mode: "single" | "row" | "column"
): PlatformState<TState> {
  const slot = clamp(Math.floor(instrumentSlot), 0, 15);
  const sslot = clamp(Math.floor(sampleSlot), 0, 7);
  const gx = clamp(Math.floor(x), 0, GRID_WIDTH - 1);
  const gy = clamp(Math.floor(y), 0, GRID_HEIGHT - 1);
  const instruments = Array.isArray((state.runtimeConfig as any).instruments) ? ([...((state.runtimeConfig as any).instruments as any[])] as any[]) : [];
  const inst = instruments[slot];
  if (!inst || inst.type !== "sample") return state;
  const sample = { ...(inst.sample ?? {}) };
  const levelsEnabled = sample.velocityLevelsEnabled === true;
  const assignments = Array.isArray(sample.assignments) ? ([...sample.assignments] as any[]) : [];
  const resolved = resolveNextAssignment(assignments, gx, gy, sslot, levelsEnabled);
  const points: Array<{ x: number; y: number }> = [];
  if (mode === "single") points.push({ x: gx, y: gy });
  else if (mode === "row") {
    for (let cx = 0; cx < GRID_WIDTH; cx += 1) points.push({ x: cx, y: gy });
  } else {
    for (let cy = 0; cy < GRID_HEIGHT; cy += 1) points.push({ x: gx, y: cy });
  }
  for (const pt of points) {
    const idx = assignments.findIndex((a) => a.x === pt.x && a.y === pt.y);
    if (!resolved) {
      if (idx >= 0) assignments.splice(idx, 1);
      continue;
    }
    const next = { x: pt.x, y: pt.y, sampleSlot: sslot, ...(resolved.level ? { level: resolved.level } : {}) };
    if (idx >= 0) assignments[idx] = next;
    else assignments.push(next);
  }
  instruments[slot] = { ...inst, sample: { ...sample, assignments } };
  return { ...state, runtimeConfig: { ...(state.runtimeConfig as any), instruments } as any };
}

function resolveNextAssignment(assignments: any[], x: number, y: number, sampleSlot: number, levelsEnabled: boolean): { level?: "high" | "medium" | "low" } | null {
  const current = assignments.find((a) => a.x === x && a.y === y);
  const selectedCurrent = current && Number(current.sampleSlot) === sampleSlot ? current : null;
  if (!levelsEnabled) {
    if (selectedCurrent) return null;
    return {};
  }
  const level = selectedCurrent?.level as "high" | "medium" | "low" | undefined;
  if (!selectedCurrent) return { level: "high" };
  if (level === "high") return { level: "medium" };
  if (level === "medium") return { level: "low" };
  return null;
}

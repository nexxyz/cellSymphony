import { type BehaviorEngine, getBehavior, listBehaviorIds, registerBehavior } from "@cellsymphony/behavior-api";
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

import { renderOledFrame } from "./oledRender";
import { logoSepia128Rgb565be } from "./oledAssets/logoSepia128_rgb565be";
import { logo128Rgb565be } from "./oledAssets/logo128_rgb565be";

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
  masterVolume: number;
  displayBrightness: number;
  gridBrightness: number;
  buttonBrightness: number;
  screenSleepSeconds: number;
  midi: {
    enabled: boolean;
    outId: string | null;
    clockOutEnabled: boolean;
    inId: string | null;
    clockInEnabled: boolean;
    syncMode: "internal" | "external";
    respondToStartStop: boolean;
  };
  sound: {
    noteLengthMs: number;
    velocityScalePct: number;
    velocityCurve: "linear" | "soft" | "hard";
  };
  scanMode: ScanMode;
  scanAxis: ScanAxis;
  scanUnit: NoteUnit;
  scanDirection: Direction;
  algorithmStepUnit: NoteUnit;
  activeBehavior: string;
  autoSaveDefault: boolean;
  behaviorConfig: Record<string, unknown>;
  eventEnabled: boolean;
  eventParity: "none" | "activate_even_deactivate_odd";
  stateEnabled: boolean;
  pitch: PitchSettings;
  x: AxisModConfig;
  y: AxisModConfig;
};

type MenuNode =
  | { kind: "group"; label: string; children: MenuNode[] | ((state: PlatformState<any>) => MenuNode[]); visible?: (c: RuntimeConfig) => boolean }
  | { kind: "enum"; label: string; key: string; options: string[]; visible?: (c: RuntimeConfig) => boolean }
  | { kind: "number"; label: string; key: string; min: number; max: number; step: number; visible?: (c: RuntimeConfig) => boolean }
  | { kind: "bool"; label: string; key: string; visible?: (c: RuntimeConfig) => boolean }
  | { kind: "action"; label: string; action: ActionSpec }
  | { kind: "text"; label: string; key: string; maxLen: number; onExitSaveAction?: ActionSpec }
  | { kind: "spacer" }
;

type ActionSpec =
  | { type: "refresh_presets" }
  | { type: "preset_save" }
  | { type: "preset_load"; name: string }
  | { type: "preset_delete"; name: string }
  | { type: "preset_rename_pick"; name: string }
  | { type: "preset_rename_apply" }
  | { type: "default_save" }
  | { type: "default_load" }
  | { type: "factory_load" }
  | { type: "midi_select_output"; id: string | null }
  | { type: "midi_select_input"; id: string | null }
  | { type: "midi_panic" }
  | { type: "behavior_action"; behaviorId: string; actionType: string };

type MenuState = {
  stack: number[];
  cursor: number;
  editing: boolean;
};

export type ConfigPayload = {
  activeBehavior: string;
  runtimeConfig: RuntimeConfig;
  mappingConfig: MappingConfig;
};

type ConfirmKind =
  | "overwrite_preset"
  | "delete_preset"
  | "rename_preset"
  | "load_preset"
  | "load_default"
  | "load_factory"
  | "save_default"
  | "text_dirty_exit"
  | "midi_panic"
  | "aux_unbind";
  

type TextConfirmMode = "save" | "discard";

type PendingAction =
  | { kind: "preset_save"; name: string }
  | { kind: "preset_delete"; name: string }
  | { kind: "preset_load"; name: string }
  | { kind: "preset_rename"; from: string; to: string }
  | { kind: "default_save" }
  | { kind: "default_load" }
  | { kind: "factory_load" }
  | { kind: "midi_panic" }
  | { kind: "aux_unbind"; encoderId: string }
  | {
      kind: "text_dirty_exit";
      key: string;
      original: string;
      saveAction?: ActionSpec;
      backAfter: boolean;
      mode: TextConfirmMode;
    };

type ConfirmState = {
  kind: ConfirmKind;
  action: PendingAction;
  cursor: number;
  options: string[];
};

type TextEditSession = {
  key: string;
  original: string;
  saveAction?: ActionSpec;
};

type ToastState = {
  message: string;
  untilMs: number;
};

type SystemState = {
  shiftHeld: boolean;
  presetNames: string[];
  selectedPreset: string | null;
  draftName: string;
  nameCursor: number;
  pendingRename: { from: string; to: string } | null;
  confirm: ConfirmState | null;
  toast: ToastState | null;
  eventBlipUntilMs: number;
  stopLatched: boolean;
  transportFlash: "none" | "beat" | "measure";
  transportFlashUntilMs: number;
  textEdit: TextEditSession | null;
  midiOutputs: MidiPortInfo[];
  midiInputs: MidiPortInfo[];
  midiStatus: string | null;
  externalPpqnPulse: number;
  pendingResync: boolean;
  pausedByUser: boolean;
  oledMode: "normal" | "splash" | "off";
  oledSplashText: string;
  oledSplashUntilMs: number;
  lastInteractionMs: number;
  auxBindings: Record<string, AuxBinding | null>;
};

type AuxTurnBinding = {
  key: string;
  label?: string;
  kind: "number" | "enum" | "bool";
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
};

type AuxPressBinding = {
  actionType: string;
  routeKey?: string;
  label?: string;
};

type AuxBinding = {
  turn: AuxTurnBinding | null;
  press: AuxPressBinding | null;
};

export type PlatformEffectBase =
  | { type: "store_list_presets" }
  | { type: "store_load_preset"; name: string }
  | { type: "store_save_preset"; name: string; payload: ConfigPayload }
  | { type: "store_delete_preset"; name: string }
  | { type: "store_load_default" }
  | { type: "store_save_default"; payload: ConfigPayload };

export type MidiPortInfo = { id: string; name: string };

export type MidiEffect =
  | { type: "midi_list_outputs_request" }
  | { type: "midi_list_inputs_request" }
  | { type: "midi_select_output"; id: string | null }
  | { type: "midi_select_input"; id: string | null }
  | { type: "midi_panic" };

export type PlatformEffect = PlatformEffectBase | MidiEffect;

export type StoreResultBase =
  | { type: "list_presets_result"; names: string[] }
  | { type: "load_preset_result"; name: string; payload: ConfigPayload | null }
  | { type: "save_preset_result"; name: string; outcome: "created" | "overwritten" }
  | { type: "delete_preset_result"; name: string; ok: boolean }
  | { type: "load_default_result"; payload: ConfigPayload | null }
  | { type: "save_default_result"; ok: boolean }
  | { type: "store_error"; message: string };

export type MidiResult =
  | { type: "midi_list_outputs_result"; outputs: MidiPortInfo[] }
  | { type: "midi_list_inputs_result"; inputs: MidiPortInfo[] }
  | { type: "midi_status"; ok: boolean; message?: string; selectedOutId?: string | null; selectedInId?: string | null };

export type StoreResult = StoreResultBase | MidiResult;

export type PlatformState<TState> = {
  transport: TransportFrame;
  behaviorState: TState;
  activeBehavior: string;
  mappingConfig: MappingConfig;
  runtimeConfig: RuntimeConfig;
  menu: MenuState;
  system: SystemState;
  scanIndex: number;
  scanPulseAccumulator: number;
  algorithmPulseAccumulator: number;
  ppqnPulseRemainder: number;
};

export const OLED_WIDTH = 128;
export const OLED_HEIGHT = 128;
export const OLED_TEXT_COLUMNS = 20;
export const OLED_TEXT_LINES = 8;

export function createInitialState<TState>(behavior: BehaviorEngine<TState, unknown>): PlatformState<TState> {
  const runtimeConfig: RuntimeConfig = {
    masterVolume: 73,
    displayBrightness: 75,
    gridBrightness: 75,
    buttonBrightness: 75,
    screenSleepSeconds: 60,
    midi: {
      enabled: false,
      outId: null,
      clockOutEnabled: false,
      inId: null,
      clockInEnabled: false,
      syncMode: "internal",
      respondToStartStop: true
    },
    sound: {
      noteLengthMs: 120,
      velocityScalePct: 100,
      velocityCurve: "linear"
    },
    scanMode: "immediate",
    scanAxis: "columns",
    scanUnit: "1/8",
    scanDirection: "forward",
    algorithmStepUnit: "1/8",
    activeBehavior: behavior.id,
    autoSaveDefault: false,
    behaviorConfig: Object.fromEntries(listBehaviorIds().map(id => {
      const b = getBehavior(id);
      const defaults: Record<string, unknown> = {};
      if (b?.configMenu) {
        const s = b.init({});
        for (const item of b.configMenu(s)) {
          defaults[item.key] = (s as any)[item.key];
        }
      }
      return [id, defaults];
    })),
    eventEnabled: true,
    eventParity: "activate_even_deactivate_odd",
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
  };
  return {
    transport: { playing: false, bpm: 120, tick: 0, ppqnPulse: 0 },
    behaviorState: behavior.init({}),
    activeBehavior: behavior.id,
    mappingConfig: loadDefaultMappingConfig(),
    runtimeConfig,
    menu: { stack: [], cursor: 0, editing: false },
    system: {
      shiftHeld: false,
      presetNames: [],
      selectedPreset: null,
      draftName: "",
      nameCursor: 0,
      pendingRename: null,
      confirm: null,
      toast: null,
      eventBlipUntilMs: 0,
      stopLatched: true,
      transportFlash: "none",
      transportFlashUntilMs: 0,
      textEdit: null,
      midiOutputs: [],
      midiInputs: [],
      midiStatus: null,
      externalPpqnPulse: 0,
      pendingResync: false,
      pausedByUser: false,
      oledMode: "splash",
      oledSplashText: "Starting up",
      oledSplashUntilMs: Date.now() + 1000,
      lastInteractionMs: Date.now(),
      auxBindings: {}
    },
    scanIndex: 0,
    scanPulseAccumulator: 0,
    algorithmPulseAccumulator: 0,
    ppqnPulseRemainder: 0
  };
}

export function routeInput<TState>(
  state: PlatformState<TState>,
  input: DeviceInput,
  behavior: BehaviorEngine<TState, unknown>
): { state: PlatformState<TState>; events: MusicalEvent[]; effects: PlatformEffect[] } {
  const events: MusicalEvent[] = [];
  const effects: PlatformEffect[] = [];
  let nextState = { ...state };

  // Normalize optional button pressed field for backward compatibility.
  const pressed = (i: any): boolean => (typeof i.pressed === "boolean" ? i.pressed : true);

  // Any interaction wakes the OLED and resets idle timer.
  // If we were asleep/splashing, swallow the waking input (wake only).
  {
    const now = Date.now();
    const sys = nextState.system;
    const isMidiRealtime =
      input.type === "midi_clock" || input.type === "midi_start" || input.type === "midi_continue" || input.type === "midi_stop";
    const wasAsleep = sys.oledMode === "off" || sys.oledMode === "splash";
    nextState.system = {
      ...sys,
      lastInteractionMs: isMidiRealtime ? sys.lastInteractionMs : now,
      oledMode: !isMidiRealtime && wasAsleep ? "normal" : sys.oledMode
    };
    if (!isMidiRealtime && wasAsleep) {
      return { state: nextState, events, effects };
    }
  }

  // Confirmation overlay intercepts menu controls and must not fall through.
  if (nextState.system.confirm) {
    const c = nextState.system.confirm;
    if (input.type === "encoder_turn" && isMainEncoderInput(input.id)) {
      const nextCursor = clamp(c.cursor + input.delta, 0, c.options.length - 1);
      nextState.system = { ...nextState.system, confirm: { ...c, cursor: nextCursor } };
    } else if (input.type === "encoder_press" && isMainEncoderInput(input.id)) {
      const choice = c.options[c.cursor];
      if (c.kind === "aux_unbind" && c.action.kind === "aux_unbind") {
        if (choice !== "Cancel") {
          nextState = applyAuxUnbindChoice(nextState, c.action.encoderId, choice);
        }
      } else if (c.kind === "text_dirty_exit") {
        if (choice === "Save") {
          nextState = executeConfirmed(nextState, c.action, effects, behavior);
        } else {
          // Discard
          if (c.action.kind === "text_dirty_exit") {
            nextState = writeAnyValue(nextState, c.action.key, c.action.original);
            nextState.system = { ...nextState.system, textEdit: null };
            nextState.menu = { ...nextState.menu, editing: false };
            if (c.action.backAfter) nextState.menu = backMenu(nextState.menu);
          }
        }
      } else {
        if (choice === "Yes") {
          nextState = executeConfirmed(nextState, c.action, effects, behavior);
        }
      }
      nextState.system = { ...nextState.system, confirm: null };
    } else if (input.type === "button_a" && pressed(input)) {
      // Back cancels confirm and returns to editing.
      nextState.system = { ...nextState.system, confirm: null };
    }

    nextState.behaviorState = behavior.onInput(nextState.behaviorState, input, {
      bpm: nextState.transport.bpm,
      emit: (event) => events.push(event)
    });
    return { state: nextState, events, effects };
  }

  if (input.type === "button_shift") {
    nextState.system = { ...nextState.system, shiftHeld: pressed(input) };
  }

  // External MIDI clock / transport.
  if (input.type === "midi_clock") {
    if (nextState.runtimeConfig.midi.syncMode === "external" && nextState.runtimeConfig.midi.clockInEnabled) {
      const pulses = Math.max(0, Math.floor((input as any).pulses ?? 0));
      const advanced = applyExternalClockPulses(nextState, behavior, pulses);
      nextState = advanced.state;
      events.push(...advanced.events);
      if (advanced.events.some((e) => e.type === "note_on")) {
        nextState.system = { ...nextState.system, eventBlipUntilMs: Date.now() + 100 };
      }
    }
    return { state: nextState, events, effects };
  }
  if (input.type === "midi_start" || input.type === "midi_continue" || input.type === "midi_stop") {
    if (nextState.runtimeConfig.midi.syncMode === "external" && nextState.runtimeConfig.midi.clockInEnabled) {
      if (nextState.runtimeConfig.midi.respondToStartStop) {
        if (input.type === "midi_stop") {
          nextState.transport = { ...nextState.transport, playing: false };
          nextState.system = { ...nextState.system, stopLatched: true };
        } else {
          // Local pause wins.
          if (!nextState.system.pausedByUser) {
            if (input.type === "midi_start") {
              // External Start resets our local engine position and clears any queued resync.
              nextState.transport = { ...nextState.transport, playing: true, ppqnPulse: 0, tick: 0 };
              nextState.scanIndex = 0;
              nextState.scanPulseAccumulator = 0;
              nextState.algorithmPulseAccumulator = 0;
              nextState.ppqnPulseRemainder = 0;
              nextState.system = {
                ...nextState.system,
                stopLatched: false,
                pendingResync: false,
                externalPpqnPulse: 0
              };
            } else {
              // External Continue resumes without resetting position.
              nextState.transport = { ...nextState.transport, playing: true };
              nextState.system = { ...nextState.system, stopLatched: false };
            }
          }
        }
      }
    }
    return { state: nextState, events, effects };
  }

  if (input.type === "button_s" && pressed(input)) {
    // External sync: Shift+S triggers resync (no transport control).
    if (nextState.runtimeConfig.midi.syncMode === "external" && nextState.system.shiftHeld) {
      nextState.system = { ...nextState.system, pendingResync: true };
      return { state: nextState, events, effects };
    }

    const wasPlaying = nextState.transport.playing;
    const now = Date.now();
    const playing = !wasPlaying;

    // Toggle transport.
    nextState.transport = { ...nextState.transport, playing };

    if (nextState.runtimeConfig.midi.syncMode === "external") {
      // In external mode, S gates the local engine (pause/resume) but does not affect external clock.
      nextState.system = { ...nextState.system, pausedByUser: !playing };
      return { state: nextState, events, effects };
    }

    if (playing) {
      const isStopToPlay = nextState.system.stopLatched || (nextState.transport.ppqnPulse === 0 && nextState.transport.tick === 0);
      if (isStopToPlay) {
        // STOP->PLAY (or fresh startup) forces a new bar and measure flash.
        nextState.transport = { ...nextState.transport, ppqnPulse: 0, tick: 0 };
        nextState.scanPulseAccumulator = 0;
        nextState.algorithmPulseAccumulator = 0;
        nextState.ppqnPulseRemainder = 0;
        nextState.scanIndex = 0;
        nextState.system = {
          ...nextState.system,
          stopLatched: false,
          transportFlash: "measure",
          transportFlashUntilMs: now + 220
        };
      } else {
        // PAUSE->PLAY resumes timeline; do not reset flash state.
        nextState.system = { ...nextState.system, stopLatched: false };
      }
    }
  } else if (input.type === "button_a" && pressed(input)) {
    // Shift+Backspace in text editing mode. Shift+Back anywhere else clears the grid.
    const view = locate(menuTree(nextState), nextState, nextState.menu);
    const selected = view.siblings[nextState.menu.cursor];
    if (nextState.menu.editing && selected && selected.kind === "text" && nextState.system.shiftHeld) {
      nextState = textBackspace(nextState, selected.key);
    } else if (nextState.system.shiftHeld) {
      const behavior = resolveBehavior(nextState.runtimeConfig.activeBehavior);
      const ns = nextState.runtimeConfig.behaviorConfig?.[nextState.runtimeConfig.activeBehavior] as Record<string, unknown> | undefined;
      const cfg: any = {};
      if (behavior.configMenu) {
        for (const item of behavior.configMenu(behavior.init({}))) {
          const val = ns?.[item.key];
          if (val !== undefined) cfg[item.key] = val;
        }
      }
      nextState.behaviorState = behavior.init(cfg);
      nextState.system = { ...nextState.system, toast: { message: "Grid cleared", untilMs: Date.now() + 1500 } };
    } else {
      if (nextState.menu.editing && selected && selected.kind === "text") {
        const current = String(readAnyValue(nextState, selected.key) ?? "");
        const sess = nextState.system.textEdit;
        const dirty = sess && sess.key === selected.key ? current !== sess.original : false;
        if (dirty && sess) {
          nextState.system = {
            ...nextState.system,
            confirm: {
              kind: "text_dirty_exit",
              action: {
                kind: "text_dirty_exit",
                key: sess.key,
                original: sess.original,
                saveAction: sess.saveAction,
                backAfter: true,
                mode: "save"
              },
              cursor: 0,
              options: ["Save", "Discard"]
            }
          };
        } else {
          nextState.system = { ...nextState.system, textEdit: null };
          nextState.menu = backMenu(nextState.menu);
        }
      } else {
        nextState.menu = backMenu(nextState.menu);
      }
    }
  } else if (input.type === "encoder_press" && isMainEncoderInput(input.id)) {
    nextState = pressMenu(nextState, effects);
  } else if (input.type === "encoder_turn" && isMainEncoderInput(input.id)) {
    nextState = turnMenu(nextState, input.delta, effects);
  }

  if (input.type === "encoder_press" && input.id && !isMainEncoderInput(input.id)) {
    if (nextState.system.shiftHeld) {
      nextState = assignAuxEncoder(nextState, input.id, effects);
    } else {
      nextState = pressAuxEncoder(nextState, input.id, effects, (event) => events.push(event));
    }
  }
  if (input.type === "encoder_turn" && input.id && !isMainEncoderInput(input.id)) {
    nextState = turnAuxEncoder(nextState, input.id, input.delta, effects);
  }

  nextState.behaviorState = behavior.onInput(nextState.behaviorState, input, {
    bpm: nextState.transport.bpm,
    emit: (event) => events.push(event)
  });

  if (events.some((e) => e.type === "note_on")) {
    nextState.system = { ...nextState.system, eventBlipUntilMs: Date.now() + 100 };
  }
  return { state: nextState, events, effects };
}

function executeConfirmed<TState>(
  state: PlatformState<TState>,
  action: PendingAction,
  effects: PlatformEffect[],
  behavior: BehaviorEngine<TState, unknown>
): PlatformState<TState> {
  if (action.kind === "factory_load") {
    const factory = factoryPayload(behavior);
    return applyConfigPayload(state, factory, behavior);
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
      next.system = { ...next.system, oledMode: nextMode };
    }
  }

  // Transport flash decay.
  if (next.system.transportFlashUntilMs > 0 && nowMs > next.system.transportFlashUntilMs) {
    next.system = { ...next.system, transportFlashUntilMs: 0, transportFlash: "none" };
  }

  const prevPulse = next.transport.ppqnPulse;
  if (next.runtimeConfig.midi.syncMode === "external") {
    // External sync mode: transport advancement is driven by incoming MIDI clock pulses.
    return { state: next, events, effects };
  }
  if (next.transport.playing) {
    const elapsedPulses = pulsesPerSecond(next.transport.bpm) * elapsedSeconds;
    next.scanPulseAccumulator += elapsedPulses;
    next.algorithmPulseAccumulator += elapsedPulses;
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
    const algorithmStepPulses = noteUnitToPulses(next.runtimeConfig.algorithmStepUnit);
    while (next.algorithmPulseAccumulator >= algorithmStepPulses) {
      next.algorithmPulseAccumulator -= algorithmStepPulses;
      next.behaviorState = behavior.onTick(next.behaviorState, { bpm: next.transport.bpm, emit: () => {} });
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

  // Beat/measure flash (match space button colors).
  if (next.transport.playing && next.transport.ppqnPulse > prevPulse) {
    let sawBeat = false;
    let sawMeasure = false;
    for (let pulse = prevPulse + 1; pulse <= next.transport.ppqnPulse; pulse += 1) {
      if (pulse % 96 === 0) sawMeasure = true;
      else if (pulse % 24 === 0) sawBeat = true;
    }
    if (sawMeasure) {
      next.system = { ...next.system, transportFlash: "measure", transportFlashUntilMs: nowMs + 220 };
    } else if (sawBeat) {
      next.system = { ...next.system, transportFlash: "beat", transportFlashUntilMs: nowMs + 220 };
    }
  }

  if (events.some((e) => e.type === "note_on")) {
    next.system = { ...next.system, eventBlipUntilMs: nowMs + 100 };
  }
  return { state: next, events, effects };
}

export function extractConfigPayload<TState>(state: PlatformState<TState>): ConfigPayload {
  return {
    activeBehavior: (state.runtimeConfig as any).activeBehavior ?? state.activeBehavior,
    runtimeConfig: state.runtimeConfig,
    mappingConfig: state.mappingConfig
  };
}

export function applyConfigPayload<TState>(
  state: PlatformState<TState>,
  payload: ConfigPayload,
  behavior: BehaviorEngine<TState, unknown>
): PlatformState<TState> {
  const safe = sanitizePayload(payload, behavior);
  const next = { ...state } as any;
  next.activeBehavior = safe.activeBehavior;
  next.runtimeConfig = safe.runtimeConfig;
  next.mappingConfig = safe.mappingConfig;

  // Re-init behavior state if the active behavior changed
  const resolved = resolveBehavior(safe.activeBehavior);
  if (resolved.id !== behavior.id || resolved.id !== state.activeBehavior) {
    next.behaviorState = resolved.init({});
  }

  // Reset transient timing accumulators to avoid discontinuities.
  next.scanPulseAccumulator = 0;
  next.algorithmPulseAccumulator = 0;
  next.ppqnPulseRemainder = 0;
  next.scanIndex = 0;
  return next as PlatformState<TState>;
}

function sanitizePayload<TState>(payload: ConfigPayload, behavior: BehaviorEngine<TState, unknown>): ConfigPayload {
  const factory = factoryPayload(behavior);
  const p: any = payload ?? {};
  const rt: any = p.runtimeConfig ?? {};
  const mergedRuntime: RuntimeConfig = {
    ...(factory.runtimeConfig as any),
    ...(rt as any),
    midi: { ...(factory.runtimeConfig as any).midi, ...(rt.midi ?? {}) },
    sound: { ...(factory.runtimeConfig as any).sound, ...(rt.sound ?? {}) },
    pitch: { ...(factory.runtimeConfig.pitch as any), ...(rt.pitch ?? {}) },
    x: {
      ...(factory.runtimeConfig.x as any),
      ...(rt.x ?? {}),
      pitch: { ...(factory.runtimeConfig.x.pitch as any), ...(rt.x?.pitch ?? {}) },
      velocity: { ...(factory.runtimeConfig.x.velocity as any), ...(rt.x?.velocity ?? {}) },
      filterCutoff: { ...(factory.runtimeConfig.x.filterCutoff as any), ...(rt.x?.filterCutoff ?? {}) },
      filterResonance: { ...(factory.runtimeConfig.x.filterResonance as any), ...(rt.x?.filterResonance ?? {}) }
    },
    y: {
      ...(factory.runtimeConfig.y as any),
      ...(rt.y ?? {}),
      pitch: { ...(factory.runtimeConfig.y.pitch as any), ...(rt.y?.pitch ?? {}) },
      velocity: { ...(factory.runtimeConfig.y.velocity as any), ...(rt.y?.velocity ?? {}) },
      filterCutoff: { ...(factory.runtimeConfig.y.filterCutoff as any), ...(rt.y?.filterCutoff ?? {}) },
      filterResonance: { ...(factory.runtimeConfig.y.filterResonance as any), ...(rt.y?.filterResonance ?? {}) }
    }
  };

  const merged: ConfigPayload = {
    activeBehavior: typeof p.activeBehavior === "string" ? p.activeBehavior : factory.activeBehavior,
    runtimeConfig: mergedRuntime,
    mappingConfig: p.mappingConfig ? (p.mappingConfig as MappingConfig) : factory.mappingConfig
  };
  return merged;
}

export function applyStoreResult<TState>(
  state: PlatformState<TState>,
  result: StoreResult,
  behavior: BehaviorEngine<TState, unknown>
): { state: PlatformState<TState>; effects: PlatformEffect[] } {
  const effects: PlatformEffect[] = [];
  const setToast = (s: PlatformState<TState>, message: string): PlatformState<TState> => ({
    ...s,
    system: { ...s.system, toast: { message, untilMs: Date.now() + 3000 } }
  });

  if (result.type === "midi_list_outputs_result") {
    return { state: { ...state, system: { ...state.system, midiOutputs: result.outputs } }, effects };
  }
  if (result.type === "midi_list_inputs_result") {
    return { state: { ...state, system: { ...state.system, midiInputs: result.inputs } }, effects };
  }
  if (result.type === "midi_status") {
    const msg = result.ok ? "MIDI ok" : result.message ?? "MIDI error";
    return { state: { ...state, system: { ...state.system, midiStatus: msg } }, effects };
  }

  if (result.type === "list_presets_result") {
    const names = [...result.names].sort((a, b) => a.localeCompare(b));
    return { state: { ...state, system: { ...state.system, presetNames: names } }, effects };
  }
  if (result.type === "load_preset_result") {
    const pending = state.system.pendingRename;
    if (pending && pending.from === result.name) {
      if (!result.payload) {
        const cleared = { ...state, system: { ...state.system, pendingRename: null } };
        return { state: setToast(cleared, "Rename failed"), effects };
      }
      effects.push({ type: "store_save_preset", name: pending.to, payload: result.payload });
      effects.push({ type: "store_delete_preset", name: pending.from });
      const cleared = { ...state, system: { ...state.system, pendingRename: null, selectedPreset: null } };
      return { state: setToast(cleared, "Renaming..."), effects };
    }

    if (!result.payload) return { state: setToast(state, "Preset not found"), effects };
    const next = applyConfigPayload(state, result.payload, behavior);
    return { state: setToast(next, `Loaded: ${result.name}`), effects };
  }
  if (result.type === "save_preset_result") {
    const msg = result.outcome === "overwritten" ? `Overwrote: ${result.name}` : `Saved: ${result.name}`;
    effects.push({ type: "store_list_presets" });
    return { state: setToast(state, msg), effects };
  }
  if (result.type === "delete_preset_result") {
    effects.push({ type: "store_list_presets" });
    return { state: setToast(state, result.ok ? `Deleted: ${result.name}` : "Delete failed"), effects };
  }
  if (result.type === "load_default_result") {
    if (!result.payload) return { state: setToast(state, "No default saved"), effects };
    const next = applyConfigPayload(state, result.payload, behavior);
    return { state: setToast(next, "Loaded default"), effects };
  }
  if (result.type === "save_default_result") {
    return { state: setToast(state, result.ok ? "Save ok." : "Save failed"), effects };
  }
  if (result.type === "store_error") {
    return { state: setToast(state, result.message.slice(0, 18)), effects };
  }
  return { state, effects };
}

function applyExternalClockPulses<TState>(
  state: PlatformState<TState>,
  behavior: BehaviorEngine<TState, unknown>,
  pulses: number
): { state: PlatformState<TState>; events: MusicalEvent[] } {
  const events: MusicalEvent[] = [];
  if (pulses <= 0) return { state, events };
  let next = { ...state };
  const prevExt = next.system.externalPpqnPulse;
  const nextExt = prevExt + pulses;
  next.system = { ...next.system, externalPpqnPulse: nextExt };

  // Pending resync snaps engine position at next bar boundary (96 pulses).
  if (next.system.pendingResync) {
    const target = prevExt + (96 - (prevExt % 96 || 96));
    if (nextExt >= target) {
      next.transport = { ...next.transport, ppqnPulse: target, tick: 0 };
      next.scanPulseAccumulator = 0;
      next.algorithmPulseAccumulator = 0;
      next.ppqnPulseRemainder = 0;
      next.scanIndex = 0;
      next.system = { ...next.system, pendingResync: false };
    }
  }

  if (!next.transport.playing) {
    return { state: next, events };
  }

  // Advance local engine by the incoming pulses.
  const advanced = advanceEngineByPulses(next, behavior, pulses);
  return { state: advanced.state, events: advanced.events };
}

function advanceEngineByPulses<TState>(
  state: PlatformState<TState>,
  behavior: BehaviorEngine<TState, unknown>,
  pulses: number
): { state: PlatformState<TState>; events: MusicalEvent[] } {
  const events: MusicalEvent[] = [];
  let next = { ...state };
  next.scanPulseAccumulator += pulses;
  next.algorithmPulseAccumulator += pulses;
  next.transport = { ...next.transport, ppqnPulse: next.transport.ppqnPulse + pulses };

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
  const algorithmStepPulses = noteUnitToPulses(next.runtimeConfig.algorithmStepUnit);
  while (next.algorithmPulseAccumulator >= algorithmStepPulses) {
    next.algorithmPulseAccumulator -= algorithmStepPulses;
    next.behaviorState = behavior.onTick(next.behaviorState, { bpm: next.transport.bpm, emit: () => {} });
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
  return { state: next, events };
}

export function toSimulatorFrame<TState>(state: PlatformState<TState>, behavior: BehaviorEngine<TState, unknown>): SimulatorFrame {
  const model = behavior.renderModel(state.behaviorState);
  const menuView = currentMenuView(state);
  const scanCursor = state.runtimeConfig.scanMode === "scanning" ? { axis: state.runtimeConfig.scanAxis, index: state.scanIndex } : null;
  const baseDisplay: DisplayFrame = {
    page: menuView.path,
    title: menuView.path,
    editing: state.menu.editing,
    lines: menuView.lines,
    colors: menuView.colors
  };
  const oledLines = toOledLines(baseDisplay);
  const now = Date.now();
  const toast = state.system.toast && state.system.toast.untilMs > now ? state.system.toast.message : null;
  const transportIcon: "play" | "pause" | "stop" = state.transport.playing ? "play" : state.system.stopLatched ? "stop" : "pause";
  const oled = renderOledFrame({
    lines: oledLines.lines,
    off: state.system.oledMode === "off",
    splash:
      state.system.oledMode === "splash"
        ? state.system.oledSplashText === "Starting up"
          ? { pixelsRgb565be: logo128Rgb565be, topText: "", bottomText: "Starting up" }
          : { pixelsRgb565be: logoSepia128Rgb565be, topText: state.system.oledSplashText, bottomText: null }
        : undefined,
    transportIcon,
    transportFlash: state.system.transportFlash,
    eventDotOn: state.system.eventBlipUntilMs > now,
    toast,
    lineColors: oledLines.colors
  });
  return {
    display: baseDisplay,
    oled,
    leds: { width: GRID_WIDTH, height: GRID_HEIGHT, cells: cellsToLeds(model.cells, model.triggerTypes, scanCursor, state.runtimeConfig.gridBrightness / 100) },
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

function menuTree<TState>(state: PlatformState<TState>): MenuNode {
  const activeEngine = resolveBehavior(state.runtimeConfig.activeBehavior);
  const behaviorConfigNodes: MenuNode[] = [];
  if (activeEngine.configMenu) {
    const items = activeEngine.configMenu(state.behaviorState as any);
    for (const item of items) {
      if (item.type === "number") {
        behaviorConfigNodes.push({ kind: "number", label: item.label, key: `behaviorConfig.${activeEngine.id}.${item.key}`, min: item.min ?? 0, max: item.max ?? 127, step: item.step ?? 1 });
      } else if (item.type === "bool") {
        behaviorConfigNodes.push({ kind: "bool", label: item.label, key: `behaviorConfig.${activeEngine.id}.${item.key}` });
      } else if (item.type === "enum") {
        behaviorConfigNodes.push({ kind: "enum", label: item.label, key: `behaviorConfig.${activeEngine.id}.${item.key}`, options: item.options ?? [] });
      } else if (item.type === "action") {
        behaviorConfigNodes.push({ kind: "action", label: item.label, action: { type: "behavior_action", behaviorId: activeEngine.id, actionType: item.key } });
      }
    }
  }

  return {
    kind: "group",
    label: "Root",
    children: [
      {
        kind: "group",
        label: "L1: Life",
        children: [
          { kind: "enum", label: "Step Rate", key: "algorithmStepUnit", options: ["1/16", "1/8", "1/4", "1/2", "1/1"] },
          { kind: "enum", label: "Behaviour", key: "activeBehavior", options: listBehaviorIds() },
          ...behaviorConfigNodes
        ]
      },
      {
        kind: "group",
        label: "L2: Sense",
        children: [
          { kind: "enum", label: "Scan Mode", key: "scanMode", options: ["immediate", "scanning"] },
          { kind: "enum", label: "Scan Axis", key: "scanAxis", options: ["rows", "columns"], visible: (c) => c.scanMode === "scanning" },
          { kind: "enum", label: "Scan Unit", key: "scanUnit", options: ["1/16", "1/8", "1/4", "1/2", "1/1"], visible: (c) => c.scanMode === "scanning" },
          { kind: "enum", label: "Scan Direction", key: "scanDirection", options: ["forward", "reverse"], visible: (c) => c.scanMode === "scanning" },
          { kind: "bool", label: "Event Triggers", key: "eventEnabled" },
          { kind: "enum", label: "Event Pattern", key: "eventParity", options: ["none", "activate_even_deactivate_odd"] },
          { kind: "bool", label: "State Notes", key: "stateEnabled" },
          axisGroup("X Axis", "x", 1),
          axisGroup("Y Axis", "y", 8)
        ]
      },
      {
        kind: "group",
        label: "L3: Voice",
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
          { kind: "enum", label: "Activate Target", key: "mapping.activate.channel", options: ["0", "1", "2", "3"] },
          { kind: "enum", label: "Stable Target", key: "mapping.stable.channel", options: ["0", "1", "2", "3"] },
          { kind: "enum", label: "Deactivate Target", key: "mapping.deactivate.channel", options: ["0", "1", "2", "3"] },
          { kind: "enum", label: "Scanned Target", key: "mapping.scanned.channel", options: ["0", "1", "2", "3"] },
          axisGroup("X Axis", "x", 1),
          axisGroup("Y Axis", "y", 3)
        ]
      },
      { kind: "spacer" },
      {
        kind: "group",
        label: "Playback",
        children: [
          { kind: "number", label: "BPM", key: "transport.bpm", min: 40, max: 240, step: 1 }
        ]
      },
      {
        kind: "group",
        label: "System",
        children: [
          {
            kind: "group",
            label: "Audio",
            children: [{ kind: "number", label: "Master Vol", key: "masterVolume", min: 0, max: 100, step: 1 }]
          },
          {
            kind: "group",
            label: "Presets",
            children: [
              {
                kind: "group",
                label: "Library",
                children: [
                  {
                    kind: "group",
                    label: "Save As",
                    children: [
                      { kind: "text", label: "Name", key: "system.draftName", maxLen: 32, onExitSaveAction: { type: "preset_save" } },
                      { kind: "action", label: "Save", action: { type: "preset_save" } }
                    ]
                  },
                  {
                    kind: "group",
                    label: "Load",
                    children: (s) => presetListNodes(s, "load")
                  },
                  {
                    kind: "group",
                    label: "Rename",
                    children: (s) => presetRenameNodes(s)
                  },
                  {
                    kind: "group",
                    label: "Delete",
                    children: (s) => presetListNodes(s, "delete")
                  },
                  { kind: "action", label: "Refresh", action: { type: "refresh_presets" } }
                ]
              },
              {
                kind: "group",
                label: "Default",
                children: [
                  { kind: "action", label: "Save Default", action: { type: "default_save" } },
                  { kind: "action", label: "Load Default", action: { type: "default_load" } },
                  { kind: "bool", label: "Auto Save", key: "autoSaveDefault" }
                ]
              },
              {
                kind: "group",
                label: "Factory",
                children: [{ kind: "action", label: "Revert Factory", action: { type: "factory_load" } }]
              }
            ]
          },
          {
            kind: "group",
            label: "MIDI",
            children: [
              { kind: "bool", label: "Enabled", key: "midi.enabled" },
              { kind: "enum", label: "Sync Mode", key: "midi.syncMode", options: ["internal", "external"] },
              {
                kind: "group",
                label: "MIDI Out",
                children: (s) => midiOutputNodes(s)
              },
              {
                kind: "group",
                label: "MIDI In",
                children: (s) => midiInputNodes(s)
              },
              {
                kind: "group",
                label: "Sync & Clock",
                children: [
                  { kind: "bool", label: "Clock Out", key: "midi.clockOutEnabled" },
                  { kind: "bool", label: "Clock In", key: "midi.clockInEnabled" },
                  { kind: "bool", label: "Respond Start/Stop", key: "midi.respondToStartStop" }
                ]
              },
              { kind: "action", label: "Panic", action: { type: "midi_panic" } }
            ]
          },
          {
            kind: "group",
            label: "Sound",
            children: [
              { kind: "number", label: "Note Length", key: "sound.noteLengthMs", min: 30, max: 2000, step: 10 },
              { kind: "number", label: "Velocity Scale", key: "sound.velocityScalePct", min: 0, max: 200, step: 5 },
              { kind: "enum", label: "Velocity Curve", key: "sound.velocityCurve", options: ["linear", "soft", "hard"] }
            ]
          },
          {
            kind: "group",
            label: "UI Settings",
            children: [
              { kind: "number", label: "Screen Sleep", key: "screenSleepSeconds", min: 0, max: 600, step: 10 },
              { kind: "number", label: "Display Brightness", key: "displayBrightness", min: 10, max: 100, step: 5 },
              { kind: "number", label: "Grid Brightness", key: "gridBrightness", min: 10, max: 100, step: 5 },
              { kind: "number", label: "Button Brightness", key: "buttonBrightness", min: 10, max: 100, step: 5 }
            ]
          }
        ]
      }
    ]
  };
}

function presetListNodes<TState>(state: PlatformState<TState>, mode: "load" | "delete"): MenuNode[] {
  const names = state.system.presetNames;
  if (names.length === 0) {
    return [{ kind: "action", label: "(none)", action: { type: "refresh_presets" } }];
  }
  return names.map((name) => ({
    kind: "action",
    label: name,
    action: mode === "load" ? { type: "preset_load", name } : { type: "preset_delete", name }
  }));
}

function presetRenameNodes<TState>(state: PlatformState<TState>): MenuNode[] {
  const names = state.system.presetNames;
  const picked = state.system.selectedPreset;
  const out: MenuNode[] = [];
  if (!picked) {
    if (names.length === 0) return [{ kind: "action", label: "(none)", action: { type: "refresh_presets" } }];
    return names.map((name) => ({ kind: "action", label: name, action: { type: "preset_rename_pick", name } }));
  }
  out.push({ kind: "action", label: `From: ${picked}`, action: { type: "refresh_presets" } });
  out.push({ kind: "text", label: "New Name", key: "system.draftName", maxLen: 32, onExitSaveAction: { type: "preset_rename_apply" } });
  out.push({ kind: "action", label: "Apply", action: { type: "preset_rename_apply" } });
  return out;
}

function midiOutputNodes<TState>(state: PlatformState<TState>): MenuNode[] {
  const out: MenuNode[] = [];
  out.push({ kind: "action", label: "(none)", action: { type: "midi_select_output", id: null } });
  for (const p of state.system.midiOutputs) {
    out.push({ kind: "action", label: p.name.slice(0, 20), action: { type: "midi_select_output", id: p.id } });
  }
  if (out.length === 1) out.push({ kind: "action", label: "(no outputs)", action: { type: "midi_select_output", id: null } });
  return out;
}

function midiInputNodes<TState>(state: PlatformState<TState>): MenuNode[] {
  const out: MenuNode[] = [];
  out.push({ kind: "action", label: "(none)", action: { type: "midi_select_input", id: null } });
  for (const p of state.system.midiInputs) {
    out.push({ kind: "action", label: p.name.slice(0, 20), action: { type: "midi_select_input", id: p.id } });
  }
  if (out.length === 1) out.push({ kind: "action", label: "(no inputs)", action: { type: "midi_select_input", id: null } });
  return out;
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

function currentMenuView<TState>(state: PlatformState<TState>): { path: string; lines: string[]; colors: number[] } {
  if (state.system.confirm) {
    const view = confirmView(state);
    return { ...view, colors: Array(view.lines.length).fill(0xffff) };
  }
  const { menu } = state;
  const { siblings, path } = locate(menuTree(state), state, menu);
  const shortPath = abbreviatePath(path);
  if (!siblings.length) return { path: shortPath, lines: [], colors: [] };

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
  const colors: number[] = [];
  const sectionColor = getSectionColorFromPath(path);

  for (let i = start; i < end; i += 1) {
    const item = siblings[i];
    const isSelected = i === cursor && menu.editing;
    const itemLines = formatMenuItemLines(item, state, i === cursor, isSelected);

    // Skip spacers - they add empty lines
    if (item.kind === "spacer") {
      lines.push(...itemLines);
      colors.push(...Array(itemLines.length).fill(0x0000)); // Dummy to maintain alignment
      continue;
    }

    lines.push(...itemLines);

    // Determine color for this item
    let itemColor = sectionColor;
    if (path === "Menu" || path === "") {
      // Root menu: color by item label
      itemColor = getSectionColor(item.label);
    }
    colors.push(...Array(itemLines.length).fill(itemColor));
  }
  return { path: shortPath, lines: lines.slice(0, bodyBudget), colors: colors.slice(0, bodyBudget) };
}

function confirmView<TState>(state: PlatformState<TState>): { path: string; lines: string[] } {
  const c = state.system.confirm;
  if (!c) return { path: "CONF", lines: [] };
  const title = c.kind === "text_dirty_exit" ? "TEXT" : "CONFIRM";
  const details = confirmDetails(state, c);
  const lines = [fitOledText(details)];
  for (let i = 0; i < c.options.length; i++) {
    const prefix = c.cursor === i ? "@@> " : "  ";
    lines.push(`${prefix}${c.options[i]}`);
  }
  return { path: title, lines: lines.slice(0, OLED_TEXT_LINES - 1) };
}

function confirmDetails<TState>(state: PlatformState<TState>, confirm: ConfirmState): string {
  const a = confirm.action;
  if (a.kind === "preset_save") return `Overwrite? ${a.name}`;
  if (a.kind === "preset_delete") return `Delete? ${a.name}`;
  if (a.kind === "preset_load") return `Load? ${a.name}`;
  if (a.kind === "preset_rename") return `Rename? ${a.from}`;
  if (a.kind === "default_save") return "Save default?";
  if (a.kind === "default_load") return "Load default?";
  if (a.kind === "factory_load") return "Load factory?";
  if (a.kind === "text_dirty_exit") return "Save changes?";
  if (a.kind === "midi_panic") return "MIDI panic?";
  if (a.kind === "aux_unbind") return "Unbind encoder?";
  return "Confirm";
}

function applyAuxUnbindChoice<TState>(state: PlatformState<TState>, encoderId: string, choice: string): PlatformState<TState> {
  const binding = state.system.auxBindings[encoderId];
  if (!binding) return setAuxToast(state, "No binding");

  let nextBinding: AuxBinding | null = binding;
  if (choice === "Both") {
    nextBinding = null;
  } else if (choice === "Click") {
    nextBinding = binding.turn ? { turn: binding.turn, press: null } : null;
  } else if (choice === "Turn") {
    nextBinding = binding.press ? { turn: null, press: binding.press } : null;
  }

  const nextState = {
    ...state,
    system: {
      ...state.system,
      auxBindings: {
        ...state.system.auxBindings,
        [encoderId]: nextBinding
      }
    }
  };
  return setAuxToast(nextState, nextBinding ? "Unbound" : "Unbound");
}

function abbreviatePath(path: string): string {
  const map: Record<string, string> = {
    Menu: "MENU",
    L1: "L1",
    L2: "L2",
    L3: "L3",
    Playback: "PLAY",
    System: "SYS"
  };
  if (!path || path === "Menu") return "MENU";
  return path
    .split("/")
    .map((part) => map[part] ?? part)
    .join("/");
}

// Pastel colors for menu sections (Plants + Water -> Flowers)
const COLOR_LIFE = 0x8ED1;      // Pastel Green (R=140, G=220, B=140)
const COLOR_SENSE = 0x8D5C;     // Pastel Blue (R=140, G=170, B=230)
const COLOR_VOICE = 0xC59B;     // Pastel Lavender (R=200, G=180, B=220)
const COLOR_SEPIA = 0xB50D;     // Sepia (R=180, G=160, B=110)

function getSectionColorFromPath(path: string): number {
  if (path.startsWith("L1") || path.includes("L1:")) return COLOR_LIFE;
  if (path.startsWith("L2") || path.includes("L2:")) return COLOR_SENSE;
  if (path.startsWith("L3") || path.includes("L3:")) return COLOR_VOICE;
  // Sepia section (handles "Playback", "PLAY", "System", "SYS", "Menu", "MENU")
  if (path.includes("Playback") || path.includes("PLAY")) return COLOR_SEPIA;
  if (path.includes("System") || path.includes("SYS")) return COLOR_SEPIA;
  if (path.includes("Menu") || path.includes("MENU")) return COLOR_SEPIA;
  return 0xffff; // White default
}

function getSectionColor(nodeLabel: string): number {
  if (nodeLabel.startsWith("L1:") || nodeLabel === "L1: Life") return COLOR_LIFE;
  if (nodeLabel.startsWith("L2:") || nodeLabel === "L2: Sense") return COLOR_SENSE;
  if (nodeLabel.startsWith("L3:") || nodeLabel === "L3: Voice") return COLOR_VOICE;
  if (nodeLabel === "Playback") return COLOR_SEPIA;
  if (nodeLabel === "System") return COLOR_SEPIA;
  return 0xffff; // White default
}

function formatMenuItemLines<TState>(item: MenuNode, state: PlatformState<TState>, selected: boolean, editing: boolean): string[] {
  if (item.kind === "spacer") {
    return [""]; // Spacer = empty line
  }
  const mark = selected ? "@@" : "";
  if (item.kind === "group") {
    return [`${mark}> ${item.label}`];
  }
  if (item.kind === "action") {
    return [`${mark} ${formatActionMenuLabel(item)}`];
  }
  if (item.kind === "text") {
    const value = String(readAnyValue(state, item.key) ?? "");
    const display = value.length === 0 ? "(empty)" : value;
    if (selected) {
      return [`${mark} ${item.label}:`, `${mark}${editing ? " *" : "  "}${fitOledText(display)}`];
    }
    return [`  ${item.label}`];
  }
  const value = formatDisplayValue(item.key, readAnyValue(state, item.key));
  if (selected) {
    return [`${mark} ${item.label}:`, `${mark}${editing ? " *" : "  "}${fitOledText(value)}`];
  }
  return [`  ${item.label}`];
}

function formatActionMenuLabel(item: Extract<MenuNode, { kind: "action" }>): string {
  const shared = isSharedActionSpec(item.action);
  return `!${item.label}${shared ? " [S]" : ""}`;
}

function isSharedActionSpec(action: ActionSpec): boolean {
  return action.type === "behavior_action" && isSpawnActionType(action.actionType);
}

function isSpawnActionType(actionType: string): boolean {
  return actionType === "spawnRandom"
    || actionType === "seedRandom"
    || actionType === "spawnAnt"
    || actionType === "addBall"
    || actionType === "spawnPulse"
    || actionType === "dropNow"
    || actionType === "seedCluster"
    || actionType === "spawnGlider";
}

function spawnActionTypeForBehavior(behaviorId: string): string | null {
  if (behaviorId === "life") return "spawnRandom";
  if (behaviorId === "brain") return "seedRandom";
  if (behaviorId === "ant") return "spawnAnt";
  if (behaviorId === "bounce") return "addBall";
  if (behaviorId === "pulse") return "spawnPulse";
  if (behaviorId === "raindrops") return "dropNow";
  if (behaviorId === "dla") return "seedCluster";
  if (behaviorId === "glider") return "spawnGlider";
  return null;
}

function locate<TState>(root: MenuNode, state: PlatformState<TState>, menu: MenuState): { node: MenuNode; siblings: MenuNode[]; path: string } {
  let node = root;
  const labels: string[] = [];
  for (const idx of menu.stack) {
    const kids = visibleChildren(node, state);
    const next = kids[idx] ?? kids[0];
    if (!next || next.kind !== "group") break;
    labels.push(next.label);
    node = next;
  }
  return { node, siblings: visibleChildren(node, state), path: labels.join("/") || "Menu" };
}

function visibleChildren<TState>(node: MenuNode, state: PlatformState<TState>): MenuNode[] {
  if (node.kind !== "group") return [];
  const kids = typeof node.children === "function" ? node.children(state) : node.children;
  return kids.filter((n) => ("visible" in n && typeof (n as any).visible === "function" ? (n as any).visible(state.runtimeConfig) : true));
}

function backMenu(menu: MenuState): MenuState {
  if (menu.editing) return { ...menu, editing: false };
  if (menu.stack.length === 0) return menu;
  return { ...menu, stack: menu.stack.slice(0, -1), cursor: 0 };
}

function pressMenu<TState>(state: PlatformState<TState>, effects: PlatformEffect[]): PlatformState<TState> {
  const view = locate(menuTree(state), state, state.menu);
  const selected = view.siblings[state.menu.cursor];
  if (!selected) return state;

  // Ignore spacers
  if (selected.kind === "spacer") return state;

  if (selected.kind === "group") {
    const nextMenu = { ...state.menu, stack: [...state.menu.stack, state.menu.cursor], cursor: 0 };
    let nextState: PlatformState<TState> = { ...state, menu: nextMenu };
    const label = selected.label ?? "";
    if (label === "Presets" || label === "Load" || label === "Delete" || label === "Rename") {
      effects.push({ type: "store_list_presets" });
    }
    if (label === "MIDI Out") {
      effects.push({ type: "midi_list_outputs_request" });
    }
    if (label === "MIDI In") {
      effects.push({ type: "midi_list_inputs_request" });
    }
    // Entering Save As primes a human-readable timestamp.
    if (label === "Save As") {
      const suggested = formatTimestamp(Date.now());
      nextState = {
        ...nextState,
        system: { ...nextState.system, draftName: suggested, nameCursor: suggested.length }
      };
    }
    return nextState;
  }

  if (selected.kind === "action") {
    return handleAction(state, selected.action, effects);
  }

  if (selected.kind === "enum" && selected.key === "transport.playing") {
    return { ...state, transport: { ...state.transport, playing: !state.transport.playing } };
  }
  if (selected.kind === "text") {
    const current = String(readAnyValue(state, selected.key) ?? "");
    if (!state.menu.editing) {
      return {
        ...state,
        menu: { ...state.menu, editing: true },
        system: {
          ...state.system,
          nameCursor: clamp(current.length, 0, selected.maxLen),
          textEdit: { key: selected.key, original: current, saveAction: selected.onExitSaveAction }
        }
      };
    }
    // While editing text, encoder press advances the cursor.
    const nextCursor = clamp(state.system.nameCursor + 1, 0, selected.maxLen);
    return { ...state, system: { ...state.system, nameCursor: nextCursor } };
  }

  return { ...state, menu: { ...state.menu, editing: !state.menu.editing } };
}

function turnMenu<TState>(state: PlatformState<TState>, delta: -1 | 1, effects: PlatformEffect[]): PlatformState<TState> {
  const view = locate(menuTree(state), state, state.menu);
  if (!state.menu.editing) {
    const siblings = view.siblings;
    const max = Math.max(0, siblings.length - 1);
    let cursor = state.menu.cursor;
    // Skip spacers when turning
    let attempts = 0;
    do {
      cursor = clamp(cursor + delta, 0, max);
      attempts++;
    } while (siblings[cursor] && siblings[cursor].kind === "spacer" && attempts < siblings.length);
    return { ...state, menu: { ...state.menu, cursor } };
  }
  const selected = view.siblings[state.menu.cursor];
  if (!selected || selected.kind === "group" || selected.kind === "spacer") return state;
  if (selected.kind === "action") return state;
  if (selected.kind === "text") {
    return textEditTurn(state, selected, delta);
  }
  if (selected.kind === "number") {
    const current = readAnyValue(state, selected.key);
    const nextValue = clamp(Number(current) + delta * selected.step, selected.min, selected.max);
    const nextState = writeAnyValue(state, selected.key, nextValue);
    if (selected.key.startsWith("behaviorConfig.")) {
      const finalState = reinitBehaviorState(nextState, selected.key);
      autoSaveEffect(finalState, effects);
      return finalState;
    }
    autoSaveEffect(nextState, effects);
    return nextState;
  }
  if (selected.kind === "bool") {
    const nextValue = delta > 0;
    const nextState = writeAnyValue(state, selected.key, nextValue);
    if (selected.key !== "autoSaveDefault") autoSaveEffect(nextState, effects);
    return nextState;
  }
  // Must be "enum" kind
  const current = readAnyValue(state, selected.key);
  const idx = selected.options.indexOf(String(current));
  const nextIdx = clamp(idx + delta, 0, selected.options.length - 1);
  const raw = selected.options[nextIdx];
  if (selected.key === "transport.playing") {
    return { ...state, transport: { ...state.transport, playing: raw === "true" } };
  }
  if (selected.key === "activeBehavior") {
    const nextState = writeAnyValue(state, selected.key, raw);
    const finalState = reinitBehaviorState(nextState, selected.key);
    autoSaveEffect(finalState, effects);
    return finalState;
  }
  if (selected.key.startsWith("behaviorConfig.")) {
    const nextState = writeAnyValue(state, selected.key, raw);
    const finalState = reinitBehaviorState(nextState, selected.key);
    autoSaveEffect(finalState, effects);
    return finalState;
  }
  const nextState = writeAnyValue(state, selected.key, raw);
  autoSaveEffect(nextState, effects);
  return nextState;
}

function assignAuxEncoder<TState>(state: PlatformState<TState>, encoderId: string, effects: PlatformEffect[]): PlatformState<TState> {
  const view = locate(menuTree(state), state, state.menu);
  const selected = view.siblings[state.menu.cursor];
  const existing = state.system.auxBindings[encoderId];
  const openUnbindConfirm = (next: PlatformState<TState>): PlatformState<TState> => ({
    ...next,
    system: {
      ...next.system,
      confirm: {
        kind: "aux_unbind",
        action: { kind: "aux_unbind", encoderId },
        cursor: 0,
        options: ["Both", "Click", "Turn", "Cancel"]
      }
    }
  });

  // Nothing bindable at cursor → unbind both
  if (!selected || selected.kind === "group" || selected.kind === "spacer" || selected.kind === "text") {
    if (!existing) return setAuxToast(state, `${auxInputPrefix("press", encoderId)} No binding`);
    return openUnbindConfirm(state);
  }

  // Case 1: value parameter (number/enum/bool) in editing mode → bind turn
  if (state.menu.editing && (selected.kind === "number" || selected.kind === "enum" || selected.kind === "bool")) {
    const key = (selected as any).key as string;
    if (!key) return state;
    // Same turn binding → unbind turn slot
    if (existing?.turn && existing.turn.key === key) {
      return openUnbindConfirm(state);
    }
    const turn: AuxTurnBinding = { key, label: (selected as any).label, kind: selected.kind };
    if (selected.kind === "number") {
      turn.min = (selected as any).min;
      turn.max = (selected as any).max;
      turn.step = (selected as any).step;
    } else if (selected.kind === "enum") {
      turn.options = (selected as any).options;
    }
    return setAuxToast(
      { ...state, system: { ...state.system, auxBindings: { ...state.system.auxBindings, [encoderId]: { turn, press: existing?.press ?? null } } } },
      `${auxInputPrefix("press", encoderId)} Bound turn: ${(selected as any).label}`
    );
  }

  // Case 2: action → bind press (any editing state)
  if (selected.kind === "action") {
    const action = (selected as any).action as ActionSpec;
    if (action.type === "behavior_action") {
      const nextPress: AuxPressBinding = isSpawnActionType(action.actionType)
        ? { actionType: action.actionType, routeKey: "trigger.life.spawn_now", label: "Spawn Now" }
        : { actionType: action.actionType, label: (selected as any).label };
      // Same press binding → unbind press slot
      if (existing?.press && existing.press.actionType === nextPress.actionType && existing.press.routeKey === nextPress.routeKey) {
        return openUnbindConfirm(state);
      }
      return setAuxToast(
        {
          ...state,
          system: {
            ...state.system,
            auxBindings: {
              ...state.system.auxBindings,
              [encoderId]: { turn: existing?.turn ?? null, press: nextPress }
            }
          }
        },
        `${auxInputPrefix("press", encoderId)} Bound click: ${(selected as any).label}`
      );
    }
    return state;
  }

  // Not on a bindable item → unbind both
  if (!existing) return setAuxToast(state, `${auxInputPrefix("press", encoderId)} No binding`);
  return openUnbindConfirm(state);
}

function pressAuxEncoder<TState>(state: PlatformState<TState>, encoderId: string, effects: PlatformEffect[], emit: (event: MusicalEvent) => void): PlatformState<TState> {
  const binding = state.system.auxBindings[encoderId];
  if (!binding?.press) return setAuxToast(state, `${auxInputPrefix("press", encoderId)} No binding`);

  let actionType = binding.press.actionType;
  let label = binding.press.label ?? binding.press.actionType;
  if (binding.press.routeKey === "trigger.life.spawn_now") {
    label = "Spawn Now";
    const resolvedAction = spawnActionTypeForBehavior(state.runtimeConfig.activeBehavior);
    if (!resolvedAction) {
      return setAuxToast(state, `${auxInputPrefix("press", encoderId)} N/A (Spawn Now)`);
    }
    actionType = resolvedAction;
  }

  const behavior = resolveBehavior(state.runtimeConfig.activeBehavior);
  const newBehaviorState = behavior.onInput(state.behaviorState, { type: "behavior_action", actionType } as DeviceInput, {
    bpm: state.transport.bpm,
    emit
  });
  const nextState = { ...state, behaviorState: newBehaviorState };
  return setAuxToast(nextState, `${auxInputPrefix("press", encoderId)} ${label}`);
}

function turnAuxEncoder<TState>(state: PlatformState<TState>, encoderId: string, delta: -1 | 1, effects: PlatformEffect[]): PlatformState<TState> {
  const binding = state.system.auxBindings[encoderId];
  if (!binding?.turn) return setAuxToast(state, `${auxInputPrefix("turn", encoderId)} No binding`);

  const t = binding.turn;
  const label = t.label ?? t.key;

  if (t.kind === "number") {
    const current = readAnyValue(state, t.key);
    const nextValue = clamp(Number(current) + delta * (t.step ?? 1), t.min ?? 0, t.max ?? 127);
    const nextState = writeAnyValue(state, t.key, nextValue);
    if (t.key.startsWith("behaviorConfig.")) {
      const finalState = reinitBehaviorState(nextState, t.key);
      autoSaveEffect(finalState, effects);
      const v = formatDisplayValue(t.key, readAnyValue(finalState, t.key));
      return setAuxToast(finalState, `${auxInputPrefix("turn", encoderId)} ${label}: ${v}`);
    }
    autoSaveEffect(nextState, effects);
    const v = formatDisplayValue(t.key, readAnyValue(nextState, t.key));
    return setAuxToast(nextState, `${auxInputPrefix("turn", encoderId)} ${label}: ${v}`);
  }

  if (t.kind === "enum" && t.options) {
    const current = readAnyValue(state, t.key);
    const idx = t.options.indexOf(String(current));
    const nextIdx = clamp(idx + delta, 0, t.options.length - 1);
    const raw = t.options[nextIdx];
    if (t.key === "transport.playing") {
      const nextState = { ...state, transport: { ...state.transport, playing: raw === "true" } };
      const v = formatDisplayValue(t.key, readAnyValue(nextState, t.key));
      return setAuxToast(nextState, `${auxInputPrefix("turn", encoderId)} ${label}: ${v}`);
    }
    if (t.key === "activeBehavior") {
      const nextState = writeAnyValue(state, t.key, raw);
      const finalState = reinitBehaviorState(nextState, t.key);
      autoSaveEffect(finalState, effects);
      const v = formatDisplayValue(t.key, readAnyValue(finalState, t.key));
      return setAuxToast(finalState, `${auxInputPrefix("turn", encoderId)} ${label}: ${v}`);
    }
    if (t.key.startsWith("behaviorConfig.")) {
      const nextState = writeAnyValue(state, t.key, raw);
      const finalState = reinitBehaviorState(nextState, t.key);
      autoSaveEffect(finalState, effects);
      const v = formatDisplayValue(t.key, readAnyValue(finalState, t.key));
      return setAuxToast(finalState, `${auxInputPrefix("turn", encoderId)} ${label}: ${v}`);
    }
    const nextState = writeAnyValue(state, t.key, raw);
    autoSaveEffect(nextState, effects);
    const v = formatDisplayValue(t.key, readAnyValue(nextState, t.key));
    return setAuxToast(nextState, `${auxInputPrefix("turn", encoderId)} ${label}: ${v}`);
  }

  if (t.kind === "bool") {
    const current = readAnyValue(state, t.key);
    const nextValue = delta > 0 ? true : delta < 0 ? false : current;
    // Clamp: once at true, can't go further right; once at false, can't go further left
    const clamped = current === true ? (delta > 0 ? true : false) : (delta < 0 ? false : true);
    const nextState = writeAnyValue(state, t.key, clamped);
    autoSaveEffect(nextState, effects);
    const v = formatDisplayValue(t.key, readAnyValue(nextState, t.key));
    return setAuxToast(nextState, `${auxInputPrefix("turn", encoderId)} ${label}: ${v}`);
  }

  return state;
}

function handleAction<TState>(state: PlatformState<TState>, action: ActionSpec, effects: PlatformEffect[]): PlatformState<TState> {
  const openConfirm = (kind: ConfirmKind, pending: PendingAction, options: string[] = ["No", "Yes"]): PlatformState<TState> => ({
    ...state,
    system: { ...state.system, confirm: { kind, action: pending, cursor: 0, options } }
  });
  const toast = (message: string): PlatformState<TState> => ({
    ...state,
    system: { ...state.system, toast: { message, untilMs: Date.now() + 3000 } }
  });

  if (action.type === "refresh_presets") {
    effects.push({ type: "store_list_presets" });
    return state;
  }
  if (action.type === "preset_load") {
    return openConfirm("load_preset", { kind: "preset_load", name: action.name });
  }
  if (action.type === "preset_delete") {
    return openConfirm("delete_preset", { kind: "preset_delete", name: action.name });
  }
  if (action.type === "preset_save") {
    const name = state.system.draftName.trim();
    if (name.length === 0) return toast("Name required");
    if (state.system.presetNames.includes(name)) {
      return openConfirm("overwrite_preset", { kind: "preset_save", name });
    }
    effects.push({ type: "store_save_preset", name, payload: extractConfigPayload(state) });
    return state;
  }
  if (action.type === "preset_rename_pick") {
    const picked = action.name;
    return {
      ...state,
      system: { ...state.system, selectedPreset: picked, draftName: picked, nameCursor: picked.length }
    };
  }
  if (action.type === "preset_rename_apply") {
    const from = state.system.selectedPreset;
    const to = state.system.draftName.trim();
    if (!from) return toast("Pick preset");
    if (to.length === 0) return toast("Name required");
    if (from === to) return toast("Same name");
    if (state.system.presetNames.includes(to)) {
      return openConfirm("overwrite_preset", { kind: "preset_rename", from, to });
    }
    return openConfirm("rename_preset", { kind: "preset_rename", from, to });
  }
  if (action.type === "default_save") {
    return openConfirm("save_default", { kind: "default_save" });
  }
  if (action.type === "default_load") {
    return openConfirm("load_default", { kind: "default_load" });
  }
  if (action.type === "factory_load") {
    return openConfirm("load_factory", { kind: "factory_load" });
  }
  if (action.type === "midi_select_output") {
    const nextCfg = writeValue(state.runtimeConfig, "midi.outId", action.id);
    effects.push({ type: "midi_select_output", id: action.id });
    return { ...state, runtimeConfig: nextCfg };
  }
  if (action.type === "midi_select_input") {
    const nextCfg = writeValue(state.runtimeConfig, "midi.inId", action.id);
    effects.push({ type: "midi_select_input", id: action.id });
    return { ...state, runtimeConfig: nextCfg };
  }
  if (action.type === "midi_panic") {
    return openConfirm("midi_panic", { kind: "midi_panic" });
  }
  if (action.type === "behavior_action") {
    const behavior = resolveBehavior(action.behaviorId);
    const newState = behavior.onInput(state.behaviorState, { type: "behavior_action", actionType: action.actionType } as DeviceInput, {
      bpm: state.transport.bpm,
      emit: () => {}
    });
    return { ...state, behaviorState: newState };
  }
  return state;
}

function autoSaveEffect<TState>(state: PlatformState<TState>, effects: PlatformEffect[]): void {
  if (state.runtimeConfig.autoSaveDefault) {
    effects.push({ type: "store_save_default", payload: extractConfigPayload(state) });
  }
}

function setAuxToast<TState>(state: PlatformState<TState>, message: string): PlatformState<TState> {
  const now = Date.now();
  const baseMs = 1400;
  const extendMs = 600;
  const maxMs = 3000;
  const current = state.system.toast;
  const active = current && current.untilMs > now;
  const untilMs = active ? Math.min(now + maxMs, Math.max(now + baseMs, current.untilMs + extendMs)) : now + baseMs;
  return {
    ...state,
    system: {
      ...state.system,
      toast: { message, untilMs }
    }
  };
}

function auxInputPrefix(kind: "press" | "turn", encoderId: string): string {
  const index = encoderId.startsWith("aux") ? encoderId.slice(3) : encoderId;
  const lead = kind === "press" ? "S" : "T";
  return `${lead}${index}:`;
}

function reinitBehaviorState<TState>(state: PlatformState<TState>, key: string): PlatformState<TState> {
  const previousBehaviorId = state.activeBehavior;
  const parts = key.split(".");
  const behaviorId = parts[1] ?? state.runtimeConfig.activeBehavior;
  const behavior = resolveBehavior(behaviorId);
  const ns = state.runtimeConfig.behaviorConfig?.[behaviorId] as Record<string, unknown> | undefined;
  const cfg: any = {};
  if (behavior.configMenu) {
    for (const item of behavior.configMenu(behavior.init({}))) {
      const val = ns?.[item.key];
      if (val !== undefined) cfg[item.key] = val;
    }
  }
  const next = { ...state } as any;
  next.behaviorState = behavior.init(cfg);
  next.activeBehavior = behaviorId;
  if (key === "activeBehavior") {
    next.system = {
      ...next.system,
      auxBindings: remapAuxPressBindingsForBehavior(next.system.auxBindings, previousBehaviorId, behaviorId)
    };
  }
  return next as PlatformState<TState>;
}

function primaryBehaviorAction(behaviorId: string): { actionType: string; label: string } | null {
  const behavior = resolveBehavior(behaviorId);
  if (!behavior.configMenu) return null;
  const items = behavior.configMenu(behavior.init({}));
  for (const item of items) {
    if (item.type === "action") return { actionType: item.key, label: item.label };
  }
  return null;
}

function remapAuxPressBindingsForBehavior(
  bindings: Record<string, AuxBinding | null>,
  fromBehaviorId: string,
  toBehaviorId: string
): Record<string, AuxBinding | null> {
  if (fromBehaviorId === toBehaviorId) return bindings;
  const fromAction = primaryBehaviorAction(fromBehaviorId);
  if (!fromAction) return bindings;
  const toAction = primaryBehaviorAction(toBehaviorId);

  const next: Record<string, AuxBinding | null> = { ...bindings };
  for (const id of Object.keys(next)) {
    const binding = next[id];
    if (binding?.press?.routeKey) continue;
    if (!binding?.press || binding.press.actionType !== fromAction.actionType) continue;
    if (!toAction) {
      next[id] = binding.turn ? { turn: binding.turn, press: null } : null;
      continue;
    }
    next[id] = { ...binding, press: { actionType: toAction.actionType, label: toAction.label } };
  }
  return next;
}

function textEditTurn<TState>(state: PlatformState<TState>, node: Extract<MenuNode, { kind: "text" }>, delta: -1 | 1): PlatformState<TState> {
  const raw = String(readAnyValue(state, node.key) ?? "");
  const cursor = clamp(state.system.nameCursor, 0, Math.max(0, node.maxLen));
  const safe = raw.slice(0, node.maxLen);
  const curPos = clamp(cursor, 0, safe.length);
  const charset = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-";
  const chars = safe.split("");
  while (chars.length <= curPos) chars.push(" ");
  const current = chars[curPos] ?? " ";
  const idx = Math.max(0, charset.indexOf(current));
  const nextIdx = mod(idx + delta, charset.length);
  chars[curPos] = charset[nextIdx] ?? " ";
  const next = chars.join("").replace(/\s+$/g, "");
  return {
    ...state,
    system: { ...state.system, draftName: next, nameCursor: curPos }
  };
}

function formatTimestamp(nowMs: number): string {
  const d = new Date(nowMs);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}${min}`;
}

function factoryPayload<TState>(behavior: BehaviorEngine<TState, unknown>): ConfigPayload {
  const s = createInitialState(behavior);
  return extractConfigPayload(s);
}

function readAnyValue<TState>(state: PlatformState<TState>, key: string): unknown {
  if (key.startsWith("transport.")) return readNestedValue(state.transport, key.slice("transport.".length));
  if (key.startsWith("mapping.")) return readNestedValue(state.mappingConfig, key.slice("mapping.".length));
  if (key.startsWith("system.")) return readNestedValue(state.system, key.slice("system.".length));
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
  if (key.startsWith("system.")) {
    const system = writeNestedValue(state.system, key.slice("system.".length), value) as SystemState;
    return { ...state, system };
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

function cellsToLeds(
  cells: boolean[],
  triggerTypes: import("@cellsymphony/behavior-api").CellTriggerType[] | undefined,
  scanCursor: { axis: ScanAxis; index: number } | null,
  brightness: number
): LedCell[] {
  const b = clamp(brightness, 0.1, 1);
  const OFF_BG: LedCell = { r: 15, g: 15, b: 22 };
  const OFF_CURSOR: LedCell = { r: 70, g: 70, b: 76 };
  return cells.map((alive, i) => {
    const x = i % GRID_WIDTH;
    const y = Math.floor(i / GRID_WIDTH);
    const inCursor =
      scanCursor !== null &&
      ((scanCursor.axis === "columns" && x === scanCursor.index) ||
        (scanCursor.axis === "rows" && y === scanCursor.index));

    if (!alive) {
      return scaleLed(inCursor ? OFF_CURSOR : OFF_BG, b);
    }

    const type = triggerTypes?.[i] ?? "stable";
    switch (type) {
      case "activate":
        return scaleLed({ r: 255, g: 255, b: 255 }, b);
      case "deactivate":
        return scaleLed({ r: 128, g: 128, b: 128 }, b);
      case "scanned":
        return scaleLed({ r: 255, g: 0, b: 0 }, b);
      default:
        return scaleLed({ r: 0, g: 255, b: 120 }, b);
    }
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

export function toOledLines(display: DisplayFrame): { lines: string[]; colors: number[] } {
  const title = fitOledText(display.title);
  const titleColor = getSectionColorFromPath(display.title);
  const body = display.lines
    .slice(0, OLED_TEXT_LINES - 1)
    .map((line, idx) => ({
      line: line.trim().length === 0 ? "" : fitOledMenuLine(line),
      color: display.colors?.[idx] ?? 0xffff
    }));
  // Keep empty lines - they render as blank spacer lines
  return {
    lines: [title, ...body.map(b => b.line)].slice(0, OLED_TEXT_LINES),
    colors: [titleColor, ...body.map(b => b.color)].slice(0, OLED_TEXT_LINES)
  };
}

function fitOledMenuLine(line: string): string {
  if (!line.startsWith("@@")) return fitOledText(line);
  if (line.startsWith("@@> ")) {
    return `@@> ${fitOledTextToWidth(line.slice(4), OLED_TEXT_COLUMNS - 2)}`;
  }
  return `@@${fitOledTextToWidth(line.slice(2), OLED_TEXT_COLUMNS)}`;
}

function fitOledText(text: string): string {
  return fitOledTextToWidth(text, OLED_TEXT_COLUMNS);
}

function fitOledTextToWidth(text: string, width: number): string {
  if (text.length <= width) return text;
  if (width <= 3) return text.slice(0, width);
  return `${text.slice(0, width - 3)}...`;
}

function isMainEncoderInput(id: "main" | "aux1" | "aux2" | "aux3" | "aux4" | undefined): boolean {
  return id === undefined || id === "main";
}

function formatDisplayValue(key: string, value: unknown): string {
  if (key === "masterVolume") return `Vol: ${value}%`;
  if (key === "displayBrightness") return `OLED ${value}%`;
  if (key === "gridBrightness") return `Grid ${value}%`;
  if (key === "buttonBrightness") return `Btn ${value}%`;
  if (key === "screenSleepSeconds") return Number(value) <= 0 ? "Sleep: Off" : `Sleep: ${value}s`;
  if (key === "activeBehavior") return String(value);
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
  return applyGlobalSound(out, cfg);
}

function applyGlobalSound(events: MusicalEvent[], cfg: RuntimeConfig): MusicalEvent[] {
  const sound = (cfg as any).sound;
  const scale = Math.max(0, Math.min(2, Number(sound?.velocityScalePct ?? 100) / 100));
  const curve: "linear" | "soft" | "hard" = sound?.velocityCurve ?? "linear";
  const noteLen = Math.max(1, Math.min(10_000, Number(sound?.noteLengthMs ?? 120)));

  return events.map((e) => {
    if (e.type !== "note_on") return e;
    const v0 = Math.max(1, Math.min(127, e.velocity));
    const n = v0 / 127;
    const shaped = curve === "soft" ? Math.sqrt(n) : curve === "hard" ? n * n : n;
    const v1 = Math.max(1, Math.min(127, Math.round(shaped * 127 * scale)));
    return { ...e, velocity: v1, durationMs: e.durationMs ?? noteLen };
  });
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
      system: { ...state.system, stopLatched: true, transportFlash: "none", transportFlashUntilMs: 0 },
      scanIndex: origin,
      scanPulseAccumulator: 0,
      algorithmPulseAccumulator: 0,
      ppqnPulseRemainder: 0
    },
    events
  };
}

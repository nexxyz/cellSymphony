import { type BehaviorEngine, getBehavior, listBehaviorIds } from "@cellsymphony/behavior-api";
import { loadDefaultMappingConfig } from "@cellsymphony/mapping-core";
import type { PlatformState, RuntimeConfig } from "./platformTypes";

export function createInitialPlatformState<TState>(behavior: BehaviorEngine<TState, unknown>): PlatformState<TState> {
  const runtimeConfig: RuntimeConfig = {
    masterVolume: 73,
    displayBrightness: 75,
    gridBrightness: 75,
    buttonBrightness: 75,
    screenSleepSeconds: 60,
    midi: { enabled: false, outId: null, clockOutEnabled: false, inId: null, clockInEnabled: false, syncMode: "internal", respondToStartStop: true },
    sound: { noteLengthMs: 120, velocityScalePct: 100, velocityCurve: "linear" },
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
        for (const item of b.configMenu(s)) defaults[item.key] = (s as any)[item.key];
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
      fnHeld: false,
      presetNames: [],
      selectedPreset: null,
      currentPresetName: null,
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

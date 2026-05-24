import { type BehaviorEngine, getBehavior, listBehaviorIds } from "@cellsymphony/behavior-api";
import { loadDefaultMappingConfig } from "@cellsymphony/mapping-core";
import type { PartConfig, PlatformState, RuntimeConfig } from "./platformTypes";
import { SYNTH_PRESETS } from "./synthPresets";
import { PLATFORM_CAPS } from "./platformCaps";

const DEFAULT_PAN_POS = Math.floor(PLATFORM_CAPS.gridWidth / 2);

export function createInitialPlatformState<TState>(behavior: BehaviorEngine<TState, unknown>): PlatformState<TState> {
  const defaultMapping = loadDefaultMappingConfig();
  const instruments = Array.from({ length: PLATFORM_CAPS.instrumentCount }, (_, idx) => ({
    type: "synth" as const,
    autoName: true,
    name: "synth",
    noteBehavior: "oneshot" as const,
    midi: { enabled: false, channel: idx },
    synth: structuredClone(SYNTH_PRESETS[idx % 8]!.synth as RuntimeConfig["instruments"][number]["synth"]),
    sample: {
      baseVelocity: 100,
      velocityLevelsEnabled: false,
      velocityLevels: { high: 120, medium: 85, low: 45 },
      selectedSlot: 0,
      slots: Array.from({ length: PLATFORM_CAPS.sampleSlotCount }, () => ({ path: null })),
      tuneSemis: 0,
      amp: structuredClone((SYNTH_PRESETS[idx % 8]!.synth as any).amp),
      ampEnv: structuredClone((SYNTH_PRESETS[idx % 8]!.synth as any).ampEnv),
      filter: structuredClone((SYNTH_PRESETS[idx % 8]!.synth as any).filter),
      filterEnv: structuredClone((SYNTH_PRESETS[idx % 8]!.synth as any).filterEnv),
      assignments: []
    },
    midiEngine: { velocity: 100, durationMs: 120 },
    mixer: { route: "direct" as const, panPos: DEFAULT_PAN_POS }
  }));

  const runtimeConfig: RuntimeConfig = {
    masterVolume: 73,
    displayBrightness: 75,
    gridBrightness: 75,
    buttonBrightness: 75,
    screenSleepSeconds: 60,
    midi: { enabled: false, outId: null, clockOutEnabled: false, inId: null, clockInEnabled: false, syncMode: "internal", respondToStartStop: true },
    sound: { noteLengthMs: 120, velocityScalePct: 100, velocityCurve: "linear", voiceStealingMode: "balanced" },
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
    stateEnabled: true,
    numericDisplayMode: "bar+numbers",
    pitch: { startingNote: 60, lowestNote: 36, highestNote: 74, outOfRange: "clamp", scale: "major_pentatonic", root: "D" },
    x: {
      pitch: { enabled: true, steps: 0 },
      velocity: { enabled: false, from: 20, to: 100, gridOffset: 0, curve: "linear" },
      filterCutoff: { enabled: false, from: 20, to: 127, gridOffset: 0, curve: "linear" },
      filterResonance: { enabled: false, from: 10, to: 90, gridOffset: 0, curve: "linear" }
    },
    y: {
      pitch: { enabled: true, steps: 1 },
      velocity: { enabled: false, from: 20, to: 100, gridOffset: 0, curve: "linear" },
      filterCutoff: { enabled: false, from: 20, to: 127, gridOffset: 0, curve: "linear" },
      filterResonance: { enabled: false, from: 10, to: 90, gridOffset: 0, curve: "linear" }
    },
    activePartIndex: 0,
    parts: [],
    instruments,
    mixer: {
      buses: Array.from({ length: PLATFORM_CAPS.busCount }, () => ({
        slot1: { type: "none" as const, params: {} },
        slot2: { type: "none" as const, params: {} },
        panPos: DEFAULT_PAN_POS,
        autoName: true,
        name: "(none)"
      }))
    }
  };
  const makePart = (idx: number): PartConfig => ({
    l1: {
      stepRate: idx === 0 ? "1/8" : "1/4",
      behaviorId: idx === 0 ? behavior.id : "life",
      behaviorConfig: { ...((runtimeConfig.behaviorConfig as any)[idx === 0 ? behavior.id : "life"] ?? {}) },
      saveGridState: true
    },
    l2: {
      scanMode: "immediate",
      scanAxis: "columns",
      scanUnit: "1/8",
      scanDirection: "forward",
      eventEnabled: idx === 0,
      stateEnabled: true,
      pitch: structuredClone(runtimeConfig.pitch),
      x: structuredClone(runtimeConfig.x),
      y: structuredClone(runtimeConfig.y),
      mapping: {
        activate: { action: defaultMapping.activate.action, slot: defaultMapping.activate.channel },
        stable: { action: defaultMapping.stable.action, slot: defaultMapping.stable.channel },
        deactivate: { action: defaultMapping.deactivate.action, slot: defaultMapping.deactivate.channel },
        scanned: { action: defaultMapping.scanned.action, slot: defaultMapping.scanned.channel },
        scanned_empty: { action: defaultMapping.scanned_empty.action, slot: defaultMapping.scanned_empty.channel }
      }
    },
    autoName: true,
    name: idx === 0 ? "mock" : "life"
  });
  runtimeConfig.parts = Array.from({ length: PLATFORM_CAPS.partCount }, (_, idx) => makePart(idx));
  const behaviorCfg = runtimeConfig.behaviorConfig as Record<string, Record<string, unknown> | undefined>;
  behaviorCfg.life = { ...(behaviorCfg.life ?? {}), randomCellsPerTick: 12, randomTickInterval: 1 };
  for (let i = 0; i < runtimeConfig.parts.length; i += 1) {
    const p = runtimeConfig.parts[i];
    if (p?.l1?.behaviorId === "life") {
      p.l1.behaviorConfig = { ...(behaviorCfg.life ?? {}) };
    }
  }
  const partStates = runtimeConfig.parts.map((part) => {
    const engine = getBehavior(part.l1.behaviorId) ?? behavior;
    return engine.init({ ...(part.l1.behaviorConfig ?? {}) });
  });
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
      auxBindings: {},
      heldNotes: [],
      sampleAssign: null,
      sampleAssignLastPress: null,
      sampleBrowser: null
    },
    scanIndex: 0,
    scanPulseAccumulator: 0,
    algorithmPulseAccumulator: 0,
    ppqnPulseRemainder: 0,
    partStates,
    partScanIndex: Array.from({ length: PLATFORM_CAPS.partCount }, () => 0),
    partScanPulseAccumulator: Array.from({ length: PLATFORM_CAPS.partCount }, () => 0),
    partAlgorithmPulseAccumulator: Array.from({ length: PLATFORM_CAPS.partCount }, () => 0)
  };
}

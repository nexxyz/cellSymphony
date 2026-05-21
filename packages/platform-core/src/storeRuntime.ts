import type { BehaviorEngine } from "@cellsymphony/behavior-api";
import { getBehavior } from "@cellsymphony/behavior-api";
import type { MappingConfig } from "@cellsymphony/mapping-core";
import type { ConfigPayload, PlatformEffect, PlatformState, RuntimeConfig, StoreResult } from "./index";
import { clampPartIndex, PLATFORM_CAPS } from "./platformCaps";

type StoreDeps<TState> = {
  resolveBehavior: (id: string) => BehaviorEngine<any, any>;
  factoryPayload: (behavior: BehaviorEngine<TState, unknown>) => ConfigPayload;
};

export function extractConfigPayload<TState>(state: PlatformState<TState>): ConfigPayload {
  const runtimeAny: any = state.runtimeConfig;
  const active = clampPartIndex(runtimeAny.activePartIndex ?? 0);
  const parts = Array.isArray(runtimeAny.parts) ? [...runtimeAny.parts] : [];
  const partStates: unknown[] = Array.isArray((state as any).partStates) ? ([...((state as any).partStates as unknown[])] as unknown[]) : [];
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    const behaviorId = String(part?.l1?.behaviorId ?? runtimeAny.activeBehavior ?? state.activeBehavior);
    const engine = getBehavior(behaviorId);
    const saveGridState = part?.l1?.saveGridState !== false;
    const savedState = saveGridState && engine && partStates[i] !== undefined ? engine.serialize(partStates[i] as any) : undefined;
    parts[i] = {
      ...part,
      l1: {
        ...part.l1,
        saveGridState,
        ...(savedState === undefined ? {} : { savedState })
      }
    };
    if (!saveGridState && parts[i]?.l1 && "savedState" in parts[i].l1) {
      delete parts[i].l1.savedState;
    }
  }
  if (parts[active]) {
    const behaviorId = String(runtimeAny.activeBehavior ?? parts[active].l1?.behaviorId ?? "life");
    parts[active] = {
      ...parts[active],
      l1: {
        ...parts[active].l1,
        stepRate: runtimeAny.algorithmStepUnit,
        behaviorId,
        behaviorConfig: { ...((runtimeAny.behaviorConfig ?? {})[behaviorId] ?? {}) }
      },
      l2: {
        ...parts[active].l2,
        scanMode: runtimeAny.scanMode,
        scanAxis: runtimeAny.scanAxis,
        scanUnit: runtimeAny.scanUnit,
        scanDirection: runtimeAny.scanDirection,
        eventEnabled: runtimeAny.eventEnabled,
        stateEnabled: runtimeAny.stateEnabled,
        pitch: structuredClone(runtimeAny.pitch),
        x: structuredClone(runtimeAny.x),
        y: structuredClone(runtimeAny.y),
        mapping: {
          activate: { action: (state.mappingConfig as any).activate?.action ?? parts[active].l2.mapping.activate.action, slot: Number((state.mappingConfig as any).activate?.channel ?? parts[active].l2.mapping.activate.slot) },
          stable: { action: (state.mappingConfig as any).stable?.action ?? parts[active].l2.mapping.stable.action, slot: Number((state.mappingConfig as any).stable?.channel ?? parts[active].l2.mapping.stable.slot) },
          deactivate: { action: (state.mappingConfig as any).deactivate?.action ?? parts[active].l2.mapping.deactivate.action, slot: Number((state.mappingConfig as any).deactivate?.channel ?? parts[active].l2.mapping.deactivate.slot) },
          scanned: { action: (state.mappingConfig as any).scanned?.action ?? parts[active].l2.mapping.scanned.action, slot: Number((state.mappingConfig as any).scanned?.channel ?? parts[active].l2.mapping.scanned.slot) },
          scanned_empty: { action: (state.mappingConfig as any).scanned_empty?.action ?? parts[active].l2.mapping.scanned_empty.action, slot: Number((state.mappingConfig as any).scanned_empty?.channel ?? parts[active].l2.mapping.scanned_empty.slot) }
        }
      }
    };
  }
  const runtimeConfig = { ...(state.runtimeConfig as any), parts } as RuntimeConfig;
  return {
    activeBehavior: runtimeAny.activeBehavior ?? state.activeBehavior,
    runtimeConfig,
    mappingConfig: state.mappingConfig
  };
}

export function applyConfigPayload<TState>(
  state: PlatformState<TState>,
  payload: ConfigPayload,
  behavior: BehaviorEngine<TState, unknown>,
  deps: StoreDeps<TState>
): PlatformState<TState> {
  const safe = sanitizePayload(payload, behavior, deps);
  const next = { ...state } as any;
  next.runtimeConfig = safe.runtimeConfig;
  next.mappingConfig = safe.mappingConfig;
  const activePartIndex = clampPartIndex((safe.runtimeConfig as any).activePartIndex ?? 0);
  const activePart = (safe.runtimeConfig as any).parts?.[activePartIndex];
  const activePartBehaviorId = String(activePart?.l1?.behaviorId ?? safe.activeBehavior);
  next.activeBehavior = safe.activeBehavior;
  const resolved = deps.resolveBehavior(safe.activeBehavior);
  const behaviorCfgSource = ((safe.runtimeConfig as any).behaviorConfig?.[resolved.id] ?? {}) as Record<string, unknown>;
  const behaviorCfg: Record<string, unknown> = {};
  if (resolved.configMenu) {
    for (const item of resolved.configMenu(resolved.init({}))) {
      const v = behaviorCfgSource[item.key];
      if (v !== undefined) behaviorCfg[item.key] = v;
    }
  }
  next.behaviorState = resolved.init(behaviorCfg);
  const parts: any[] = Array.isArray((safe.runtimeConfig as any).parts) ? (safe.runtimeConfig as any).parts : [];
  next.partStates = parts.map((part) => {
    const engine = deps.resolveBehavior(String(part?.l1?.behaviorId ?? safe.activeBehavior));
    const saveGridState = part?.l1?.saveGridState !== false;
    const savedState = part?.l1?.savedState;
    if (saveGridState && savedState !== undefined) {
      return engine.deserialize(savedState);
    }
    return engine.init({ ...(part?.l1?.behaviorConfig ?? {}) });
  });
  while (next.partStates.length < PLATFORM_CAPS.partCount) next.partStates.push(resolved.init({}));
  const shouldUseRestoredActiveState = activePartBehaviorId === safe.activeBehavior && activePart?.l1?.saveGridState !== false && activePart?.l1?.savedState !== undefined;
  if (shouldUseRestoredActiveState) {
    next.behaviorState = (next.partStates[activePartIndex] ?? next.behaviorState) as TState;
  }
  next.partScanIndex = Array.from({ length: PLATFORM_CAPS.partCount }, () => 0);
  next.partScanPulseAccumulator = Array.from({ length: PLATFORM_CAPS.partCount }, () => 0);
  next.partAlgorithmPulseAccumulator = Array.from({ length: PLATFORM_CAPS.partCount }, () => 0);
  next.scanPulseAccumulator = 0;
  next.algorithmPulseAccumulator = 0;
  next.ppqnPulseRemainder = 0;
  next.scanIndex = 0;
  next.system = {
    ...next.system,
    heldNotes: [],
    pendingResync: false,
    externalPpqnPulse: 0,
    sampleAssign: null,
    sampleAssignLastPress: null,
    sampleBrowser: null
  };
  return next as PlatformState<TState>;
}

function sanitizePayload<TState>(payload: ConfigPayload, behavior: BehaviorEngine<TState, unknown>, deps: StoreDeps<TState>): ConfigPayload {
  const factory = deps.factoryPayload(behavior);
  const p: any = payload ?? {};
  const rt: any = p.runtimeConfig ?? {};

  const sanitizeInstruments = (incoming: any): any[] => {
    const factorySlots: any[] = Array.isArray((factory.runtimeConfig as any).instruments)
      ? (factory.runtimeConfig as any).instruments
      : [];
    const baseSlots = factorySlots.length > 0 ? factorySlots : Array.from({ length: PLATFORM_CAPS.instrumentCount }, () => ({ type: "synth", midi: { enabled: false, channel: 0 }, synth: {}, sample: { baseVelocity: 100, velocityLevelsEnabled: false, velocityLevels: { high: 120, medium: 85, low: 45 }, selectedSlot: 0, slots: Array.from({ length: PLATFORM_CAPS.sampleSlotCount }, () => ({ path: null })), tuneSemis: 0, amp: {}, ampEnv: {}, filter: {}, filterEnv: {}, assignments: [] }, midiEngine: { velocity: 100, durationMs: 120 } }));
    const src = Array.isArray(incoming) ? incoming : [];
    const out: any[] = [];
    for (let i = 0; i < PLATFORM_CAPS.instrumentCount; i += 1) {
      const f = baseSlots[i] ?? baseSlots[0] ?? { type: "synth", midi: { enabled: false, channel: i }, synth: {}, sample: { baseVelocity: 100, velocityLevelsEnabled: false, velocityLevels: { high: 120, medium: 85, low: 45 }, selectedSlot: 0, slots: Array.from({ length: PLATFORM_CAPS.sampleSlotCount }, () => ({ path: null })), tuneSemis: 0, amp: {}, ampEnv: {}, filter: {}, filterEnv: {}, assignments: [] }, midiEngine: { velocity: 100, durationMs: 120 } };
      const s = src[i] ?? {};
      out.push({
        ...(f as any),
        ...(s as any),
        type: (s as any).type === "sample" || (s as any).type === "midi" || (s as any).type === "synth" ? (s as any).type : (f as any).type,
        nameMode: (s as any).nameMode === "auto" || (s as any).nameMode === "drums" || (s as any).nameMode === "pad" || (s as any).nameMode === "lead" || (s as any).nameMode === "bass" || (s as any).nameMode === "fx" || (s as any).nameMode === "custom"
          ? (s as any).nameMode
          : ((f as any).nameMode ?? "auto"),
        customName: typeof (s as any).customName === "string" && (s as any).customName.trim().length > 0
          ? (s as any).customName
          : ((typeof (f as any).customName === "string" && (f as any).customName.trim().length > 0) ? (f as any).customName : null),
        midi: { ...(f as any).midi, ...((s as any).midi ?? {}) },
        synth: {
          ...(f as any).synth,
          ...((s as any).synth ?? {}),
          osc1: { ...(f as any).synth?.osc1, ...((s as any).synth?.osc1 ?? {}) },
          osc2: { ...(f as any).synth?.osc2, ...((s as any).synth?.osc2 ?? {}) },
          amp: { ...(f as any).synth?.amp, ...((s as any).synth?.amp ?? {}) },
          ampEnv: { ...(f as any).synth?.ampEnv, ...((s as any).synth?.ampEnv ?? {}) },
          filter: { ...(f as any).synth?.filter, ...((s as any).synth?.filter ?? {}) },
          filterEnv: { ...(f as any).synth?.filterEnv, ...((s as any).synth?.filterEnv ?? {}) }
        },
        sample: {
          ...(f as any).sample,
          ...((s as any).sample ?? {}),
          velocityLevels: { ...(f as any).sample?.velocityLevels, ...((s as any).sample?.velocityLevels ?? {}) },
          slots: (() => {
            const incomingSlots = Array.isArray((s as any).sample?.slots)
              ? (s as any).sample.slots.slice(0, PLATFORM_CAPS.sampleSlotCount).map((entry: any) => ({ path: typeof entry?.path === "string" ? entry.path : null }))
              : (Array.isArray((f as any).sample?.slots) ? (f as any).sample.slots.slice(0, PLATFORM_CAPS.sampleSlotCount).map((entry: any) => ({ path: typeof entry?.path === "string" ? entry.path : null })) : []);
            while (incomingSlots.length < PLATFORM_CAPS.sampleSlotCount) incomingSlots.push({ path: null });
            return incomingSlots;
          })(),
          assignments: Array.isArray((s as any).sample?.assignments) ? (s as any).sample.assignments : (Array.isArray((f as any).sample?.assignments) ? (f as any).sample.assignments : []),
          amp: { ...(f as any).sample?.amp, ...((s as any).sample?.amp ?? {}) },
          ampEnv: { ...(f as any).sample?.ampEnv, ...((s as any).sample?.ampEnv ?? {}) },
          filter: { ...(f as any).sample?.filter, ...((s as any).sample?.filter ?? {}) },
          filterEnv: { ...(f as any).sample?.filterEnv, ...((s as any).sample?.filterEnv ?? {}) }
        },
        midiEngine: {
          ...(f as any).midiEngine,
          ...((s as any).midiEngine ?? {})
        },
        mixer: {
          route: (() => {
            const raw = String((s as any).mixer?.route ?? (f as any).mixer?.route ?? "direct");
            if (raw === "direct") return "direct";
            const m = /^bus_(\d+)$/.exec(raw);
            if (!m) return "direct";
            const idx = Number(m[1]);
            if (!Number.isFinite(idx) || idx < 1 || idx > PLATFORM_CAPS.busCount) return "direct";
            return `bus_${idx}`;
          })(),
          panPos: Math.max(0, Math.min(PLATFORM_CAPS.gridWidth - 1, Number((s as any).mixer?.panPos ?? (f as any).mixer?.panPos ?? Math.floor(PLATFORM_CAPS.gridWidth / 2))))
        }
      });
    }
    return out;
  };

  const sanitizeMixer = (incoming: any): any => {
    const factoryMixer = (factory.runtimeConfig as any).mixer;
    const sourceBuses = Array.isArray(incoming?.buses) ? incoming.buses : (Array.isArray(factoryMixer?.buses) ? factoryMixer.buses : []);
    const buses: any[] = [];
    for (let i = 0; i < PLATFORM_CAPS.busCount; i += 1) {
      const src = sourceBuses[i] ?? {};
      buses.push({
        slot1: src.slot1 === "none" ? "none" : "none",
        slot2: src.slot2 === "none" ? "none" : "none",
        panPos: Math.max(0, Math.min(PLATFORM_CAPS.gridWidth - 1, Number(src.panPos ?? Math.floor(PLATFORM_CAPS.gridWidth / 2))))
      });
    }
    return { buses };
  };

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
    },
    activePartIndex: clampPartIndex(rt.activePartIndex ?? (factory.runtimeConfig as any).activePartIndex ?? 0),
    parts: Array.isArray(rt.parts) ? rt.parts : Array.isArray((factory.runtimeConfig as any).parts) ? (factory.runtimeConfig as any).parts : [],
    instruments: sanitizeInstruments(rt.instruments),
    mixer: sanitizeMixer(rt.mixer)
  };

  const voiceStealingMode = (mergedRuntime as any).sound?.voiceStealingMode;
  if (voiceStealingMode !== "off" && voiceStealingMode !== "lenient" && voiceStealingMode !== "balanced" && voiceStealingMode !== "aggressive") {
    (mergedRuntime as any).sound.voiceStealingMode = (factory.runtimeConfig as any).sound?.voiceStealingMode ?? "balanced";
  }

  if (!Array.isArray((mergedRuntime as any).parts) || (mergedRuntime as any).parts.length === 0) {
    (mergedRuntime as any).parts = Array.isArray((factory.runtimeConfig as any).parts) ? structuredClone((factory.runtimeConfig as any).parts) : [];
  }
  const active = clampPartIndex((mergedRuntime as any).activePartIndex ?? 0);
  const parts = [...((mergedRuntime as any).parts as any[])];
  while (parts.length < PLATFORM_CAPS.partCount) {
    const base = (factory.runtimeConfig as any).parts?.[parts.length] ?? (factory.runtimeConfig as any).parts?.[0];
    if (base) parts.push(structuredClone(base));
    else break;
  }
  if (parts[active]) {
    const p = parts[active];
    mergedRuntime.algorithmStepUnit = p.l1?.stepRate ?? mergedRuntime.algorithmStepUnit;
    mergedRuntime.activeBehavior = p.l1?.behaviorId ?? mergedRuntime.activeBehavior;
    mergedRuntime.scanMode = p.l2?.scanMode ?? mergedRuntime.scanMode;
    mergedRuntime.scanAxis = p.l2?.scanAxis ?? mergedRuntime.scanAxis;
    mergedRuntime.scanUnit = p.l2?.scanUnit ?? mergedRuntime.scanUnit;
    mergedRuntime.scanDirection = p.l2?.scanDirection ?? mergedRuntime.scanDirection;
    mergedRuntime.eventEnabled = p.l2?.eventEnabled ?? mergedRuntime.eventEnabled;
    mergedRuntime.stateEnabled = p.l2?.stateEnabled ?? mergedRuntime.stateEnabled;
    mergedRuntime.pitch = p.l2?.pitch ? structuredClone(p.l2.pitch) : mergedRuntime.pitch;
    mergedRuntime.x = p.l2?.x ? structuredClone(p.l2.x) : mergedRuntime.x;
    mergedRuntime.y = p.l2?.y ? structuredClone(p.l2.y) : mergedRuntime.y;
    const behaviorFromPayload = ((rt.behaviorConfig ?? {}) as any)[mergedRuntime.activeBehavior];
    mergedRuntime.behaviorConfig = {
      ...(mergedRuntime.behaviorConfig as any),
      [mergedRuntime.activeBehavior]: { ...(behaviorFromPayload ?? p.l1?.behaviorConfig ?? {}) }
    };
    if (behaviorFromPayload) {
      parts[active] = {
        ...p,
        l1: {
          ...p.l1,
          behaviorId: mergedRuntime.activeBehavior,
          behaviorConfig: { ...behaviorFromPayload }
        }
      };
    }
  }
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (!part?.l1) continue;
    parts[i] = {
      ...part,
      l1: {
        ...part.l1,
        saveGridState: part.l1.saveGridState !== false
      }
    };
  }
  (mergedRuntime as any).parts = parts;

  const mappingConfig = p.mappingConfig ? (p.mappingConfig as MappingConfig) : factory.mappingConfig;
  const activePart = (mergedRuntime as any).parts?.[active];
  const mergedMapping: MappingConfig = activePart?.l2?.mapping
    ? {
      ...mappingConfig,
      activate: { ...mappingConfig.activate, action: activePart.l2.mapping.activate.action, channel: activePart.l2.mapping.activate.slot },
      stable: { ...mappingConfig.stable, action: activePart.l2.mapping.stable.action, channel: activePart.l2.mapping.stable.slot },
      deactivate: { ...mappingConfig.deactivate, action: activePart.l2.mapping.deactivate.action, channel: activePart.l2.mapping.deactivate.slot },
      scanned: { ...mappingConfig.scanned, action: activePart.l2.mapping.scanned.action, channel: activePart.l2.mapping.scanned.slot },
      scanned_empty: { ...mappingConfig.scanned_empty, action: activePart.l2.mapping.scanned_empty.action, channel: activePart.l2.mapping.scanned_empty.slot }
    }
    : mappingConfig;

  return {
    activeBehavior: typeof p.activeBehavior === "string" ? p.activeBehavior : factory.activeBehavior,
    runtimeConfig: mergedRuntime,
    mappingConfig: mergedMapping
  };
}

export function applyStoreResult<TState>(
  state: PlatformState<TState>,
  result: StoreResult,
  behavior: BehaviorEngine<TState, unknown>,
  deps: StoreDeps<TState>
): { state: PlatformState<TState>; effects: PlatformEffect[] } {
  const effects: PlatformEffect[] = [];
  const setToast = (s: PlatformState<TState>, message: string): PlatformState<TState> => ({
    ...s,
    system: { ...s.system, toast: { message, untilMs: Date.now() + 3000 } }
  });

  if (result.type === "midi_list_outputs_result") return { state: { ...state, system: { ...state.system, midiOutputs: result.outputs } }, effects };
  if (result.type === "midi_list_inputs_result") return { state: { ...state, system: { ...state.system, midiInputs: result.inputs } }, effects };
  if (result.type === "sample_list_result") {
    const browser = state.system.sampleBrowser;
    if (!browser) {
      return {
        state: {
          ...state,
          system: {
            ...state.system,
            sampleBrowser: {
              instrumentSlot: result.instrumentSlot,
              sampleSlot: result.sampleSlot,
              dir: result.dir,
              entries: result.entries
            }
          }
        },
        effects
      };
    }
    return {
      state: {
        ...state,
        system: {
          ...state.system,
          sampleBrowser: {
            ...browser,
            instrumentSlot: result.instrumentSlot,
            sampleSlot: result.sampleSlot,
            dir: result.dir,
            entries: result.entries
          }
        }
      },
      effects
    };
  }
  if (result.type === "sample_list_error") {
    const reason = (result.message ?? "error").slice(0, 48);
    return {
      state: setToast(
        {
          ...state,
          system: {
            ...state.system,
            sampleBrowser: {
              instrumentSlot: result.instrumentSlot,
              sampleSlot: result.sampleSlot,
              dir: result.dir,
              entries: []
            }
          }
        },
        `Sample list error: ${reason}`
      ),
      effects
    };
  }
  if (result.type === "sample_preview_error") {
    return { state: setToast(state, `Sample preview error: ${(result.message ?? "error").slice(0, 40)}`), effects };
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
      if (!result.payload) return { state: setToast({ ...state, system: { ...state.system, pendingRename: null } }, "Rename failed"), effects };
      effects.push({ type: "store_save_preset", name: pending.to, payload: result.payload });
      effects.push({ type: "store_delete_preset", name: pending.from });
      return { state: setToast({ ...state, system: { ...state.system, pendingRename: null, selectedPreset: null } }, "Renaming..."), effects };
    }
    if (!result.payload) return { state: setToast(state, "Preset not found"), effects };
    const loaded = applyConfigPayload(state, result.payload, behavior, deps);
    return { state: setToast({ ...loaded, system: { ...loaded.system, currentPresetName: result.name } }, `Loaded: ${result.name}`), effects };
  }
  if (result.type === "save_preset_result") {
    effects.push({ type: "store_list_presets" });
    const msg = result.outcome === "overwritten" ? `Overwrote: ${result.name}` : `Saved: ${result.name}`;
    return { state: setToast({ ...state, system: { ...state.system, currentPresetName: result.name } }, msg), effects };
  }
  if (result.type === "delete_preset_result") {
    effects.push({ type: "store_list_presets" });
    return { state: setToast(state, result.ok ? `Deleted: ${result.name}` : "Delete failed"), effects };
  }
  if (result.type === "load_default_result") {
    if (!result.payload) return { state: setToast(state, "No default saved"), effects };
    const loaded = applyConfigPayload(state, result.payload, behavior, deps);
    return { state: setToast({ ...loaded, system: { ...loaded.system, currentPresetName: null } }, "Loaded default"), effects };
  }
  if (result.type === "save_default_result") return { state: setToast(state, result.ok ? "Save ok." : "Save failed"), effects };
  if (result.type === "store_error") return { state: setToast(state, result.message.slice(0, 18)), effects };
  return { state, effects };
}

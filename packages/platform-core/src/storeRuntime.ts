import type { BehaviorEngine } from "@cellsymphony/behavior-api";
import type { MappingConfig } from "@cellsymphony/mapping-core";
import type { ConfigPayload, PlatformEffect, PlatformState, RuntimeConfig, StoreResult } from "./index";

type StoreDeps<TState> = {
  resolveBehavior: (id: string) => BehaviorEngine<any, any>;
  factoryPayload: (behavior: BehaviorEngine<TState, unknown>) => ConfigPayload;
};

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
  behavior: BehaviorEngine<TState, unknown>,
  deps: StoreDeps<TState>
): PlatformState<TState> {
  const safe = sanitizePayload(payload, behavior, deps);
  const next = { ...state } as any;
  next.activeBehavior = safe.activeBehavior;
  next.runtimeConfig = safe.runtimeConfig;
  next.mappingConfig = safe.mappingConfig;
  const resolved = deps.resolveBehavior(safe.activeBehavior);
  if (resolved.id !== behavior.id || resolved.id !== state.activeBehavior) {
    next.behaviorState = resolved.init({});
  }
  next.scanPulseAccumulator = 0;
  next.algorithmPulseAccumulator = 0;
  next.ppqnPulseRemainder = 0;
  next.scanIndex = 0;
  return next as PlatformState<TState>;
}

function sanitizePayload<TState>(payload: ConfigPayload, behavior: BehaviorEngine<TState, unknown>, deps: StoreDeps<TState>): ConfigPayload {
  const factory = deps.factoryPayload(behavior);
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

  return {
    activeBehavior: typeof p.activeBehavior === "string" ? p.activeBehavior : factory.activeBehavior,
    runtimeConfig: mergedRuntime,
    mappingConfig: p.mappingConfig ? (p.mappingConfig as MappingConfig) : factory.mappingConfig
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

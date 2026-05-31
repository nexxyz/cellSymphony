import type { StoreResult, PlatformState, PlatformEffect } from "./index";
import { makeToast } from "./toast";
import { applyConfigPayload } from "./storeRuntime";

function setToast<TState>(s: PlatformState<TState>, message: string): PlatformState<TState> {
  return { ...s, system: { ...s.system, toast: makeToast(message, { durationMs: 3000 }) } };
}

export function applyStoreResult<TState>(
  state: PlatformState<TState>,
  result: StoreResult,
  behavior: any,
  deps: any
): { state: PlatformState<TState>; effects: PlatformEffect[] } {
  const effects: PlatformEffect[] = [];

  if (result.type === "midi_list_outputs_result") return { state: { ...state, system: { ...state.system, midiOutputs: result.outputs } }, effects };
  if (result.type === "midi_list_inputs_result") return { state: { ...state, system: { ...state.system, midiInputs: result.inputs } }, effects };
  if (result.type === "sample_list_result") {
    const browser = state.system.sampleBrowser;
    if (!browser) {
      return { state: { ...state, system: { ...state.system, sampleBrowser: { instrumentSlot: result.instrumentSlot, sampleSlot: result.sampleSlot, dir: result.dir, entries: result.entries } } }, effects };
    }
    return { state: { ...state, system: { ...state.system, sampleBrowser: { ...browser, instrumentSlot: result.instrumentSlot, sampleSlot: result.sampleSlot, dir: result.dir, entries: result.entries } } }, effects };
  }
  if (result.type === "sample_list_error") {
    const reason = (result.message ?? "error").slice(0, 48);
    return { state: setToast({ ...state, system: { ...state.system, sampleBrowser: { instrumentSlot: result.instrumentSlot, sampleSlot: result.sampleSlot, dir: result.dir, entries: [] } } }, `Sample list error: ${reason}`), effects };
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
  if (result.type === "save_default_result") {
    const flashUntilMs = result.ok ? Date.now() + 500 : undefined;
    const flashState: PlatformState<TState> = { ...state, system: { ...state.system, autoSaveFlash: "flash" as const, autoSaveFlashUntilMs: flashUntilMs ?? 0 } };
    if (result.isAuto) return { state: flashState, effects };
    return { state: setToast(flashState, result.ok ? "Save ok." : "Save failed"), effects };
  }
  if (result.type === "store_error") return { state: setToast(state, result.message.slice(0, 18)), effects };
  return { state, effects };
}

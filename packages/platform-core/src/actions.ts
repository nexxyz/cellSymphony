import type { DeviceInput } from "@cellsymphony/device-contracts";
import type { PlatformEffect, PlatformState } from "./index";

type ActionDeps<TState> = {
  writeValue: <TConfig extends object>(cfg: TConfig, key: string, value: unknown) => TConfig;
  extractConfigPayload: (state: PlatformState<TState>) => any;
  resolveBehavior: (activeId: string) => any;
};

export function handleMenuAction<TState>(state: PlatformState<TState>, action: any, effects: PlatformEffect[], deps: ActionDeps<TState>): PlatformState<TState> {
  const openConfirm = (kind: any, pending: any, options: string[] = ["No", "Yes"]): PlatformState<TState> => ({
    ...state,
    system: { ...state.system, confirm: { kind, action: pending, cursor: 0, options, scroll: 0 } }
  });
  const toast = (message: string): PlatformState<TState> => ({
    ...state,
    system: { ...state.system, toast: { message, untilMs: Date.now() + 3000 } }
  });

  if (action.type === "refresh_presets") {
    effects.push({ type: "store_list_presets" });
    return state;
  }
  if (action.type === "preset_save_current") {
    const name = state.system.currentPresetName;
    if (!name) return toast("No preset loaded");
    return openConfirm("overwrite_preset", { kind: "preset_save", name }, ["Cancel", "Confirm"]);
  }
  if (action.type === "preset_load") return openConfirm("load_preset", { kind: "preset_load", name: action.name });
  if (action.type === "preset_delete") return openConfirm("delete_preset", { kind: "preset_delete", name: action.name });
  if (action.type === "preset_save") {
    const name = state.system.draftName.trim();
    if (name.length === 0) return toast("Name required");
    if (state.system.presetNames.includes(name)) return openConfirm("overwrite_preset", { kind: "preset_save", name }, ["Cancel", "Confirm"]);
    effects.push({ type: "store_save_preset", name, payload: deps.extractConfigPayload(state) });
    return state;
  }
  if (action.type === "preset_rename_pick") {
    const picked = action.name;
    return { ...state, system: { ...state.system, selectedPreset: picked, draftName: picked, nameCursor: picked.length } };
  }
  if (action.type === "preset_rename_apply") {
    const from = state.system.selectedPreset;
    const to = state.system.draftName.trim();
    if (!from) return toast("Pick preset");
    if (to.length === 0) return toast("Name required");
    if (from === to) return toast("Same name");
    if (state.system.presetNames.includes(to)) return openConfirm("overwrite_preset", { kind: "preset_rename", from, to });
    return openConfirm("rename_preset", { kind: "preset_rename", from, to });
  }
  if (action.type === "default_save") return openConfirm("save_default", { kind: "default_save" });
  if (action.type === "default_load") return openConfirm("load_default", { kind: "default_load" });
  if (action.type === "factory_load") return openConfirm("load_factory", { kind: "factory_load" });
  if (action.type === "midi_select_output") {
    const nextCfg = deps.writeValue(state.runtimeConfig, "midi.outId", action.id);
    effects.push({ type: "midi_select_output", id: action.id });
    return { ...state, runtimeConfig: nextCfg };
  }
  if (action.type === "midi_select_input") {
    const nextCfg = deps.writeValue(state.runtimeConfig, "midi.inId", action.id);
    effects.push({ type: "midi_select_input", id: action.id });
    return { ...state, runtimeConfig: nextCfg };
  }
  if (action.type === "midi_panic") return openConfirm("midi_panic", { kind: "midi_panic" });
  if (action.type === "behavior_action") {
    const behavior = deps.resolveBehavior(action.behaviorId);
    const newState = behavior.onInput(state.behaviorState, { type: "behavior_action", actionType: action.actionType } as DeviceInput, {
      bpm: state.transport.bpm,
      emit: () => {}
    });
    return { ...state, behaviorState: newState };
  }
  return state;
}

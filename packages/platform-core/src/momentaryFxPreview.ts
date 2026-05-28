import type { PlatformEffect, PlatformState } from "./index";
import type { MomentaryFxType } from "./platformTypes";
import { targetFromKey } from "./momentaryFxTarget";
import { nowMs } from "./timing";

export const MOMENTARY_PREVIEW_ID = "momentary-preview";

function isPreviewFx(fx: { cellX: number; cellY: number }): boolean {
  return fx.cellX === -1 && fx.cellY === -1;
}

export function startMomentaryFxPreview<TState>(state: PlatformState<TState>, effects: PlatformEffect[]): PlatformState<TState> {
  const selected = state.runtimeConfig.touchFx?.selected;
  const fxType = (selected?.fxType ?? "none") as MomentaryFxType;
  if (fxType === "none") return state;
  const params = selected?.params ?? {};
  const targetKey = String(selected?.targetKey ?? "master");
  const target = targetFromKey(targetKey);

  const already = state.system.activeFx.find(isPreviewFx);
  const without = state.system.activeFx.filter((fx) => !isPreviewFx(fx));
  if (already) {
    if (already.fxType !== fxType) {
      effects.push({ type: "audio_command", command: { type: "momentary_fx_stop", id: MOMENTARY_PREVIEW_ID } });
      effects.push({ type: "audio_command", command: { type: "momentary_fx_start", id: MOMENTARY_PREVIEW_ID, fxType, params: structuredClone(params), target } });
      return { ...state, system: { ...state.system, activeFx: [...without, { cellX: -1, cellY: -1, fxType, config: { fxType, params: structuredClone(params), targetKey }, activatedAtMs: nowMs() }] } };
    }
    return state;
  }

  effects.push({ type: "audio_command", command: { type: "momentary_fx_start", id: MOMENTARY_PREVIEW_ID, fxType, params: structuredClone(params), target } });
  return { ...state, system: { ...state.system, activeFx: [...without, { cellX: -1, cellY: -1, fxType, config: { fxType, params: structuredClone(params), targetKey }, activatedAtMs: nowMs() }] } };
}

export function stopMomentaryFxPreview<TState>(state: PlatformState<TState>, effects: PlatformEffect[]): PlatformState<TState> {
  if (!state.system.activeFx.some(isPreviewFx)) return state;
  effects.push({ type: "audio_command", command: { type: "momentary_fx_stop", id: MOMENTARY_PREVIEW_ID } });
  return { ...state, system: { ...state.system, activeFx: state.system.activeFx.filter((fx) => !isPreviewFx(fx)) } };
}

export function isMomentaryFxPreviewActive<TState>(state: PlatformState<TState>): boolean {
  return state.system.activeFx.some(isPreviewFx);
}

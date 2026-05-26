import { GRID_HEIGHT, GRID_WIDTH } from "@cellsymphony/device-contracts";
import { clamp } from "./coreUtils";
import { PLATFORM_CAPS } from "./platformCaps";
import type { PlatformEffect, PlatformState } from "./platformTypes";
import { makeToast } from "./toast";

export function activateMomentaryFx<TState>(state: PlatformState<TState>, x: number, y: number, effects: PlatformEffect[]): PlatformState<TState> {
  const cellX = clamp(Math.floor(x), 0, GRID_WIDTH - 1);
  const cellY = clamp(Math.floor(y), 0, GRID_HEIGHT - 1);
  const assignments = Array.isArray((state.runtimeConfig as any).touchFx?.assignments) ? ((state.runtimeConfig as any).touchFx.assignments as any[]) : [];
  const assignment = assignments.find((a) => a?.x === cellX && a?.y === cellY);
  const config = assignment?.config;
  if (!config || config.fxType === "none") return state;
  const activeFx = state.system.activeFx.filter((fx) => !(fx.cellX === cellX && fx.cellY === cellY));
  const replaced = activeFx.find((fx) => fx.fxType === config.fxType);
  const withoutSameType = activeFx.filter((fx) => fx.fxType !== config.fxType);
  if (!replaced && withoutSameType.length >= PLATFORM_CAPS.touchFxMaxConcurrent) return state;
  if (replaced) effects.push({ type: "audio_command", command: { type: "momentary_fx_stop", id: momentaryFxId(replaced.cellX, replaced.cellY) } });
  const next = { cellX, cellY, fxType: config.fxType, config: structuredClone(config), activatedAtMs: Date.now() };
  effects.push({
    type: "audio_command",
    command: { type: "momentary_fx_start", id: momentaryFxId(cellX, cellY), fxType: config.fxType, params: structuredClone(config.params ?? {}), target: { type: "global" } }
  });
  return { ...state, system: { ...state.system, activeFx: [...withoutSameType, next] } };
}

export function releaseMomentaryFx<TState>(state: PlatformState<TState>, x: number, y: number, effects: PlatformEffect[]): PlatformState<TState> {
  if (state.system.touchMode !== "fx") return state;
  const cellX = clamp(Math.floor(x), 0, GRID_WIDTH - 1);
  const cellY = clamp(Math.floor(y), 0, GRID_HEIGHT - 1);
  const nextActive = state.system.activeFx.filter((fx) => fx.cellX !== cellX || fx.cellY !== cellY);
  if (nextActive.length === state.system.activeFx.length) return state;
  effects.push({ type: "audio_command", command: { type: "momentary_fx_stop", id: momentaryFxId(cellX, cellY) } });
  return { ...state, system: { ...state.system, activeFx: nextActive } };
}

function momentaryFxId(cellX: number, cellY: number): string {
  return `momentary-fx:${cellX}:${cellY}`;
}

export function applyFxAssignment<TState>(state: PlatformState<TState>, x: number, y: number): PlatformState<TState> {
  const assign = state.system.fxAssignMode;
  if (!assign) return state;
  const cellX = clamp(Math.floor(x), 0, GRID_WIDTH - 1);
  const cellY = clamp(Math.floor(y), 0, GRID_HEIGHT - 1);
  const touchFx = (state.runtimeConfig as any).touchFx ?? { selected: assign.config, assignments: [] };
  const assignments = Array.isArray(touchFx.assignments) ? [...touchFx.assignments] : [];
  const idx = assignments.findIndex((a) => a?.x === cellX && a?.y === cellY);
  if (assign.config.fxType === "none") {
    if (idx >= 0) assignments.splice(idx, 1);
  } else {
    const next = { x: cellX, y: cellY, config: structuredClone(assign.config) };
    if (idx >= 0) assignments[idx] = next;
    else assignments.push(next);
  }
  return {
    ...state,
    runtimeConfig: { ...(state.runtimeConfig as any), touchFx: { ...touchFx, assignments } } as any,
    system: { ...state.system, toast: makeToast(assign.config.fxType === "none" ? "FX cleared" : `FX mapped: ${assign.config.fxType}`) }
  };
}

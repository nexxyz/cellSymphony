import { GRID_HEIGHT, GRID_WIDTH } from "@cellsymphony/device-contracts";
import { interpretGrid, type AxisStrategy, type InterpretationProfile, type TickStrategy } from "@cellsymphony/interpretation-core";
import { mapIntentsToMusicalEvents } from "@cellsymphony/mapping-core";
import type { MusicalEvent } from "@cellsymphony/musical-events";
import { applyModulation } from "./musicTransforms";
import { dedupeSimultaneousNotes, toGridSnapshot } from "./runtimeHelpers";
import { mod } from "./coreUtils";
import type { BehaviorEngine } from "@cellsymphony/behavior-api";
import type { Direction, NoteUnit, PlatformState, RuntimeConfig } from "./index";

const PPQN = 24;

export function tickTransport<TState>(state: PlatformState<TState>, behavior: BehaviorEngine<TState, unknown>, elapsedSeconds: number): { state: PlatformState<TState>; events: MusicalEvent[] } {
  const events: MusicalEvent[] = [];
  let next = { ...state };
  const prevPulse = next.transport.ppqnPulse;
  if (next.runtimeConfig.midi.syncMode === "external") return { state: next, events };
  if (!next.transport.playing) return { state: next, events };

  const elapsedPulses = pulsesPerSecond(next.transport.bpm) * elapsedSeconds;
  next.scanPulseAccumulator += elapsedPulses;
  next.algorithmPulseAccumulator += elapsedPulses;
  next.ppqnPulseRemainder += elapsedPulses;
  const wholePulses = Math.floor(next.ppqnPulseRemainder);
  if (wholePulses > 0) {
    next.ppqnPulseRemainder -= wholePulses;
    next.transport = { ...next.transport, ppqnPulse: next.transport.ppqnPulse + wholePulses };
  }

  const advanced = advanceEngineByPulses(next, behavior, 0);
  next = advanced.state;
  events.push(...advanced.events);
  next = applyBeatFlash(next, prevPulse);
  return { state: next, events };
}

export function applyExternalClockPulses<TState>(state: PlatformState<TState>, behavior: BehaviorEngine<TState, unknown>, pulses: number): { state: PlatformState<TState>; events: MusicalEvent[] } {
  const events: MusicalEvent[] = [];
  if (pulses <= 0) return { state, events };
  let next = { ...state };
  const prevExt = next.system.externalPpqnPulse;
  const nextExt = prevExt + pulses;
  next.system = { ...next.system, externalPpqnPulse: nextExt };

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

  if (!next.transport.playing) return { state: next, events };
  return advanceEngineByPulses(next, behavior, pulses);
}

function advanceEngineByPulses<TState>(state: PlatformState<TState>, behavior: BehaviorEngine<TState, unknown>, pulses: number): { state: PlatformState<TState>; events: MusicalEvent[] } {
  const events: MusicalEvent[] = [];
  let next = { ...state };
  if (pulses > 0) {
    next.scanPulseAccumulator += pulses;
    next.algorithmPulseAccumulator += pulses;
    next.transport = { ...next.transport, ppqnPulse: next.transport.ppqnPulse + pulses };
  }

  let scanAdvanced = false;
  if (next.runtimeConfig.scanMode === "scanning") {
    const scanStepPulses = noteUnitToPulses(next.runtimeConfig.scanUnit);
    while (next.scanPulseAccumulator >= scanStepPulses) {
      next.scanPulseAccumulator -= scanStepPulses;
      next.scanIndex = advanceScanIndex(next.scanIndex, next.runtimeConfig.scanDirection, next.runtimeConfig.scanAxis === "columns" ? GRID_WIDTH : GRID_HEIGHT);
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

function applyBeatFlash<TState>(state: PlatformState<TState>, prevPulse: number): PlatformState<TState> {
  let next = { ...state };
  if (next.transport.playing && next.transport.ppqnPulse > prevPulse) {
    let sawBeat = false;
    let sawMeasure = false;
    for (let pulse = prevPulse + 1; pulse <= next.transport.ppqnPulse; pulse += 1) {
      if (pulse % 96 === 0) sawMeasure = true;
      else if (pulse % 24 === 0) sawBeat = true;
    }
    const nowMs = Date.now();
    if (sawMeasure) next.system = { ...next.system, transportFlash: "measure", transportFlashUntilMs: nowMs + 220 };
    else if (sawBeat) next.system = { ...next.system, transportFlash: "beat", transportFlashUntilMs: nowMs + 220 };
  }
  return next;
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

function withScaleSteps(mapping: any, cfg: RuntimeConfig): any {
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

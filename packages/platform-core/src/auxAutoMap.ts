import type { PlatformState } from "./index";
import type { AuxBinding, AuxPressBinding, AuxTurnBinding, MomentaryFxType } from "./platformTypes";
import { defaultFxParam } from "./fxDefaults";
import type { BehaviorEngine } from "@cellsymphony/behavior-api";

export type AuxAutoMap = {
  aux1: AuxBinding | null;
  aux2: AuxBinding | null;
  aux3: AuxBinding | null;
  aux4: AuxBinding | null;
};

export const AUX_AUTO_MAP_DISABLED = { aux1: null, aux2: null, aux3: null, aux4: null } as const;

const NONE: AuxAutoMap = { aux1: null, aux2: null, aux3: null, aux4: null };

function isTouchPath(path: string): boolean {
  return path === "L4: Touch" || path.startsWith("L4: Touch/") || path.includes("/L4: Touch");
}

function isFxPagePath(path: string): boolean {
  return path.endsWith("/FX Page") || path.includes("L4: Touch/FX Page");
}

function isL1Path(path: string): boolean {
  return path === "L1: Life" || path.startsWith("L1: Life/") || path.includes("/L1: Life");
}

function turn(key: string, label: string, opts: Omit<AuxTurnBinding, "key" | "label"> & { kind: AuxTurnBinding["kind"] }): AuxTurnBinding {
  return { key, label, ...opts };
}

function press(actionType: string, label: string, routeKey?: string): AuxPressBinding {
  return routeKey ? { actionType, label, routeKey } : { actionType, label };
}

function mapFromMomentaryFxType(fxType: MomentaryFxType, keyPrefix: string): AuxAutoMap {
  // keyPrefix example: "touchFx.selected.params" or "touchFx.assignments.<i>.config.params"
  if (fxType === "none") return NONE;
  if (fxType === "stutter") {
    return {
      aux1: { turn: turn(`${keyPrefix}.rateHz`, "Rate", { kind: "number", min: 1, max: 32, step: 1 }), press: null },
      aux2: { turn: turn(`${keyPrefix}.depthPct`, "Depth", { kind: "number", min: 0, max: 100, step: 1 }), press: null },
      aux3: null,
      aux4: null
    };
  }
  if (fxType === "freeze") {
    return {
      aux1: { turn: turn(`${keyPrefix}.releaseMs`, "Release", { kind: "number", min: 10, max: 5000, step: 10 }), press: null },
      aux2: null,
      aux3: null,
      aux4: { turn: turn(`${keyPrefix}.mixPct`, "Mix", { kind: "number", min: 0, max: 100, step: 1 }), press: null }
    };
  }
  if (fxType === "filter_sweep") {
    return {
      aux1: { turn: turn(`${keyPrefix}.sweepInMs`, "In", { kind: "number", min: 10, max: 3000, step: 10 }), press: null },
      aux2: { turn: turn(`${keyPrefix}.resonancePct`, "Res", { kind: "number", min: 0, max: 100, step: 1 }), press: null },
      aux3: { turn: turn(`${keyPrefix}.cutoffPct`, "Cutoff", { kind: "number", min: 0, max: 100, step: 1 }), press: null },
      aux4: { turn: turn(`${keyPrefix}.sweepOutMs`, "Out", { kind: "number", min: 10, max: 3000, step: 10 }), press: null }
    };
  }
  if (fxType === "pitch_shift") {
    return {
      aux1: null,
      aux2: { turn: turn(`${keyPrefix}.cents`, "Cents", { kind: "number", min: -100, max: 100, step: 1 }), press: null },
      aux3: { turn: turn(`${keyPrefix}.semitones`, "Semi", { kind: "number", min: -24, max: 24, step: 1 }), press: null },
      aux4: { turn: turn(`${keyPrefix}.mixPct`, "Mix", { kind: "number", min: 0, max: 100, step: 1 }), press: null }
    };
  }
  return NONE;
}

function behaviorL1AutoMap<TState>(behavior: BehaviorEngine<TState, unknown> | null, keyPrefix: string): AuxAutoMap {
  const id = behavior?.id ?? "none";
  if (id === "none" || id === "sequencer") return NONE;
  if (id === "keys") {
    return {
      aux1: { turn: turn(`${keyPrefix}.quantize`, "Quantize", { kind: "enum", options: ["immediate", "step"] }), press: null },
      aux2: null,
      aux3: null,
      aux4: null
    };
  }

  const spawnIntervalKey = (k: string) => ({ turn: turn(`${keyPrefix}.${k}`, "Interval", { kind: "number", min: 0, max: 30, step: 1 }), press: null } as AuxBinding);
  const spawnCountKey = (k: string) => ({ turn: turn(`${keyPrefix}.${k}`, "Count", { kind: "number", min: 0, max: 100, step: 1 }), press: null } as AuxBinding);

  if (id === "life") {
    return {
      aux1: { ...spawnIntervalKey("randomTickInterval"), press: press("spawnRandom", "Spawn", "trigger.life.spawn_now") },
      aux2: { ...spawnCountKey("randomCellsPerTick"), press: null },
      aux3: null,
      aux4: null
    };
  }
  if (id === "brain") {
    return {
      aux1: { ...spawnIntervalKey("seedInterval"), press: press("seedRandom", "Seed", "trigger.life.spawn_now") },
      aux2: { ...spawnCountKey("randomSeedCells"), press: null },
      aux3: { turn: turn(`${keyPrefix}.fireThreshold`, "Thresh", { kind: "number", min: 1, max: 6, step: 1 }), press: null },
      aux4: null
    };
  }
  if (id === "ant") {
    return {
      aux1: { ...spawnIntervalKey("autoSpawnInterval"), press: press("spawnAnt", "Spawn", "trigger.life.spawn_now") },
      aux2: { ...spawnCountKey("maxAnts"), press: null },
      aux3: null,
      aux4: null
    };
  }
  if (id === "bounce") {
    return {
      aux1: { ...spawnIntervalKey("spawnInterval"), press: press("addBall", "Add", "trigger.life.spawn_now") },
      aux2: { ...spawnCountKey("maxBalls"), press: null },
      aux3: null,
      aux4: null
    };
  }
  if (id === "pulse") {
    return {
      aux1: { ...spawnIntervalKey("autoPulseInterval"), press: press("spawnPulse", "Spawn", "trigger.life.spawn_now") },
      aux2: { turn: turn(`${keyPrefix}.lifespan`, "Life", { kind: "number", min: 1, max: 12, step: 1 }), press: null },
      aux3: { turn: turn(`${keyPrefix}.pulseShape`, "Shape", { kind: "enum", options: ["ring", "heart", "star", "plus", "x"] }), press: null },
      aux4: null
    };
  }
  if (id === "raindrops") {
    return {
      aux1: { ...spawnIntervalKey("autoDropInterval"), press: press("dropNow", "Drop", "trigger.life.spawn_now") },
      aux2: { turn: turn(`${keyPrefix}.splashRadius`, "Splash", { kind: "number", min: 0, max: 12, step: 1 }), press: null },
      aux3: null,
      aux4: null
    };
  }
  if (id === "dla") {
    return {
      aux1: { ...spawnIntervalKey("spawnInterval"), press: press("seedCluster", "Seed", "trigger.life.spawn_now") },
      aux2: null,
      aux3: null,
      aux4: null
    };
  }
  if (id === "glider") {
    return {
      aux1: { ...spawnIntervalKey("spawnInterval"), press: press("spawnGlider", "Spawn", "trigger.life.spawn_now") },
      aux2: null,
      aux3: null,
      aux4: null
    };
  }
  return NONE;
}

function isL2Path(path: string): boolean {
  return path.startsWith("L2") || path.includes("/L2:") || path.includes("L2: Sense");
}

export function resolveAuxAutoMap<TState>(
  state: PlatformState<TState>,
  context: { path: string; selectedKey?: string },
  resolveBehavior: (id: string) => BehaviorEngine<any, any>
): AuxAutoMap {
  if ((state.system as any).auxAutoMapEnabled === false) return NONE;
  // Active held/preview momentary FX wins.
  const active = Array.isArray(state.system.activeFx) ? state.system.activeFx : [];
  const focused = active.length > 0 ? active[active.length - 1] : null;
  if (focused) {
    // For held FX, map to selected FX params for now; routing layer will apply live update.
    return mapFromMomentaryFxType(focused.fxType, "touchFx.selected.params");
  }

  const path = context.path;
  if (isL2Path(path)) return NONE;

  // Touch FX Page selected config.
  if (isFxPagePath(path)) {
    const fxType = String((state.runtimeConfig as any).touchFx?.selected?.fxType ?? "none") as MomentaryFxType;
    return mapFromMomentaryFxType(fxType, "touchFx.selected.params");
  }

  // When in Touch/performance area, don't apply generic fallthrough auto maps.
  if (isTouchPath(path)) return NONE;

  // Bus FX slot params.
  const k = String(context.selectedKey ?? "");
  const fxParamMatch = /^mixer\.buses\.(\d+)\.(slot[12])\.params\./.exec(k);
  if (fxParamMatch) {
    const typeKey = `mixer.buses.${fxParamMatch[1]}.${fxParamMatch[2]}.type`;
    const fxType = String((state.runtimeConfig as any).mixer?.buses?.[Number(fxParamMatch[1])]?.[fxParamMatch[2]]?.type ?? (state.runtimeConfig as any)[typeKey] ?? "none");
    const type = fxType;
    const base = `mixer.buses.${fxParamMatch[1]}.${fxParamMatch[2]}.params`;
    const map: AuxAutoMap = { ...NONE };
    const put = (slot: keyof AuxAutoMap, keySuffix: string, label: string, kind: AuxTurnBinding["kind"], min?: number, max?: number, step?: number) => {
      if (defaultFxParam(type, keySuffix) === undefined) return;
      (map as any)[slot] = { turn: { key: `${base}.${keySuffix}`, label, kind, ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}), ...(step !== undefined ? { step } : {}) }, press: null };
    };
    // Curated per FX type.
    if (type === "reverb") { put("aux1", "decay", "Decay", "number", 0, 1, 0.01); put("aux2", "damp", "Damp", "number", 0, 1, 0.01); put("aux4", "mixPct", "Mix", "number", 0, 100, 1); return map; }
    if (type === "delay") { put("aux1", "timeMs", "Time", "number", 1, 2000, 1); put("aux2", "feedback", "FB", "number", 0, 0.95, 0.01); put("aux4", "mixPct", "Mix", "number", 0, 100, 1); return map; }
    if (type === "tremolo") { put("aux1", "rateHz", "Rate", "number", 0, 20, 0.1); put("aux2", "depthPct", "Depth", "number", 0, 100, 1); return map; }
    if (type === "auto_pan") { put("aux1", "rateHz", "Rate", "number", 0, 20, 0.1); put("aux2", "depthPct", "Depth", "number", 0, 100, 1); return map; }
    if (type === "vibrato") { put("aux1", "rateHz", "Rate", "number", 0, 10, 0.1); put("aux2", "depthMs", "Depth", "number", 0, 20, 0.1); put("aux3", "baseMs", "Base", "number", 0, 50, 0.5); put("aux4", "mixPct", "Mix", "number", 0, 100, 1); return map; }
    if (type === "chorus") { put("aux1", "rateHz", "Rate", "number", 0, 10, 0.1); put("aux2", "depthMs", "Depth", "number", 0, 50, 0.5); put("aux3", "feedback", "FB", "number", 0, 0.95, 0.01); put("aux4", "mixPct", "Mix", "number", 0, 100, 1); return map; }
    if (type === "flanger") { put("aux1", "rateHz", "Rate", "number", 0, 10, 0.1); put("aux2", "feedback", "FB", "number", 0, 0.95, 0.01); put("aux3", "depthMs", "Depth", "number", 0, 10, 0.1); put("aux4", "mixPct", "Mix", "number", 0, 100, 1); return map; }
    if (type === "wah") { put("aux1", "rateHz", "Rate", "number", 0, 10, 0.1); put("aux2", "depthPct", "Depth", "number", 0, 100, 1); put("aux3", "centerHz", "Center", "number", 50, 5000, 10); put("aux4", "q", "Q", "number", 0.1, 20, 0.1); return map; }
    if (type === "filter_lfo") { put("aux1", "rateHz", "Rate", "number", 0, 10, 0.1); put("aux2", "depthPct", "Depth", "number", 0, 100, 1); put("aux3", "centerHz", "Center", "number", 50, 10000, 10); put("aux4", "q", "Q", "number", 0.1, 20, 0.1); return map; }
    if (type === "duck") { put("aux1", "attackMs", "Atk", "number", 0, 200, 1); put("aux2", "amountPct", "Amt", "number", 0, 100, 1); put("aux3", "threshold", "Th", "number", 0, 1, 0.01); put("aux4", "releaseMs", "Rel", "number", 0, 2000, 10); return map; }
    if (type === "bitcrusher") { put("aux1", "rateDiv", "Div", "number", 1, 32, 1); put("aux3", "bits", "Bits", "number", 1, 16, 1); put("aux4", "mixPct", "Mix", "number", 0, 100, 1); return map; }
    if (type === "saturator") { put("aux3", "drive", "Drive", "number", 0, 10, 0.1); put("aux4", "mixPct", "Mix", "number", 0, 100, 1); return map; }
    if (type === "distortion") { put("aux2", "clip", "Clip", "number", 0, 1, 0.01); put("aux3", "drive", "Drive", "number", 0, 10, 0.1); put("aux4", "mixPct", "Mix", "number", 0, 100, 1); return map; }
    if (type === "glitch") { put("aux1", "sliceMs", "Slice", "number", 1, 500, 1); put("aux2", "chancePct", "Chance", "number", 0, 100, 1); put("aux4", "mixPct", "Mix", "number", 0, 100, 1); return map; }
    if (type === "compressor") { put("aux1", "attackMs", "Atk", "number", 0, 200, 1); put("aux2", "ratio", "Ratio", "number", 1, 20, 0.5); put("aux3", "thresholdDb", "Thresh", "number", -60, 0, 1); put("aux4", "makeupDb", "Makeup", "number", -12, 24, 1); return map; }
    if (type === "eq") { put("aux1", "midFreqHz", "MidHz", "number", 50, 8000, 10); put("aux2", "midQ", "MidQ", "number", 0.1, 10, 0.1); put("aux3", "midGainDb", "Mid", "number", -24, 24, 1); put("aux4", "mixPct", "Mix", "number", 0, 100, 1); return map; }
    return map;
  }

  // L1 behavior: only when actually browsing L1.
  if (!isL1Path(path)) return NONE;
  const activePart = (state.runtimeConfig as any).activePartIndex ?? 0;
  const part = (state.runtimeConfig as any).parts?.[activePart];
  const behaviorId = String(part?.l1?.behaviorId ?? (state.runtimeConfig as any).activeBehavior ?? "none");
  const behavior = resolveBehavior(behaviorId);
  return behaviorL1AutoMap(behavior, `behaviorConfig.${behaviorId}`);
}

export type EffectiveAuxSlot = {
  turn: AuxTurnBinding | null;
  press: AuxPressBinding | null;
  sourceTurn: "auto" | "custom" | "none";
  sourcePress: "auto" | "custom" | "none";
};

export type EffectiveAuxMap = {
  aux1: EffectiveAuxSlot;
  aux2: EffectiveAuxSlot;
  aux3: EffectiveAuxSlot;
  aux4: EffectiveAuxSlot;
};

function effectiveSlot(auto: AuxBinding | null, custom: AuxBinding | null): EffectiveAuxSlot {
  const turn = auto?.turn ?? custom?.turn ?? null;
  const press = auto?.press ?? custom?.press ?? null;
  const sourceTurn = auto?.turn ? "auto" : custom?.turn ? "custom" : "none";
  const sourcePress = auto?.press ? "auto" : custom?.press ? "custom" : "none";
  return { turn, press, sourceTurn, sourcePress };
}

export function resolveEffectiveAuxMap<TState>(
  state: PlatformState<TState>,
  context: { path: string; selectedKey?: string },
  resolveBehavior: (id: string) => BehaviorEngine<any, any>
): EffectiveAuxMap {
  const auto = resolveAuxAutoMap(state, context, resolveBehavior);
  const customBindings = state.system.auxBindings;
  return {
    aux1: effectiveSlot(auto.aux1, customBindings["aux1"] ?? null),
    aux2: effectiveSlot(auto.aux2, customBindings["aux2"] ?? null),
    aux3: effectiveSlot(auto.aux3, customBindings["aux3"] ?? null),
    aux4: effectiveSlot(auto.aux4, customBindings["aux4"] ?? null)
  };
}

export function auxAutoIndicatorLines(map: AuxAutoMap): string[] {
  const slots: Array<[string, AuxBinding | null]> = [["A1", map.aux1], ["A2", map.aux2], ["A3", map.aux3], ["A4", map.aux4]];
  const fmt = (name: string, b: AuxBinding | null): string => {
    if (!b) return `${name} -`;
    const t = b.turn?.label;
    const p = b.press?.label;
    if (t && p) return `${name} ${t}/!${p}`;
    if (t) return `${name} ${t}`;
    if (p) return `${name} !${p}`;
    return `${name} -`;
  };
  const left = `${fmt("A1", map.aux1)}  ${fmt("A2", map.aux2)}`;
  const right = `${fmt("A3", map.aux3)}  ${fmt("A4", map.aux4)}`;
  return [left, right];
}

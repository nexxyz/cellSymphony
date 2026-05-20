import type { BehaviorEngine } from "@cellsymphony/behavior-api";
import type { MappingConfig } from "@cellsymphony/mapping-core";
import type { TransportFrame } from "@cellsymphony/device-contracts";
import { clamp, mod, readNestedValue, readValue, writeNestedValue, writeValue } from "./coreUtils";
import type { ConfigPayload, MenuNode, PlatformState, SystemState } from "./platformTypes";
import { clampPartIndex } from "./platformCaps";

type AnyState = PlatformState<any>;

function syncLegacyFromActivePart<TState>(state: PlatformState<TState>): PlatformState<TState> {
  const active = clampPartIndex((state.runtimeConfig as any).activePartIndex ?? 0);
  const part = (state.runtimeConfig as any).parts?.[active];
  if (!part) return state;
  const nextRuntime: any = {
    ...(state.runtimeConfig as any),
    algorithmStepUnit: part.l1.stepRate,
    activeBehavior: part.l1.behaviorId,
    scanMode: part.l2.scanMode,
    scanAxis: part.l2.scanAxis,
    scanUnit: part.l2.scanUnit,
    scanDirection: part.l2.scanDirection,
    eventEnabled: part.l2.eventEnabled,
    stateEnabled: part.l2.stateEnabled,
    pitch: structuredClone(part.l2.pitch),
    x: structuredClone(part.l2.x),
    y: structuredClone(part.l2.y),
    behaviorConfig: {
      ...(state.runtimeConfig as any).behaviorConfig,
      [part.l1.behaviorId]: { ...(part.l1.behaviorConfig ?? {}) }
    }
  };
  const nextMapping: any = {
    ...(state.mappingConfig as any),
    activate: { ...(state.mappingConfig as any).activate, action: part.l2.mapping.activate.action, channel: part.l2.mapping.activate.slot },
    stable: { ...(state.mappingConfig as any).stable, action: part.l2.mapping.stable.action, channel: part.l2.mapping.stable.slot },
    deactivate: { ...(state.mappingConfig as any).deactivate, action: part.l2.mapping.deactivate.action, channel: part.l2.mapping.deactivate.slot },
    scanned: { ...(state.mappingConfig as any).scanned, action: part.l2.mapping.scanned.action, channel: part.l2.mapping.scanned.slot },
    scanned_empty: { ...(state.mappingConfig as any).scanned_empty, action: part.l2.mapping.scanned_empty.action, channel: part.l2.mapping.scanned_empty.slot }
  };
  return { ...state, runtimeConfig: nextRuntime, mappingConfig: nextMapping };
}

function syncActivePartFromLegacy<TState>(state: PlatformState<TState>): PlatformState<TState> {
  const active = clampPartIndex((state.runtimeConfig as any).activePartIndex ?? 0);
  const parts = Array.isArray((state.runtimeConfig as any).parts) ? [...((state.runtimeConfig as any).parts as any[])] : [];
  const current = parts[active];
  if (!current) return state;
  const behaviorId = String((state.runtimeConfig as any).activeBehavior ?? current.l1.behaviorId);
  const nextPart = {
    ...current,
    l1: {
      ...current.l1,
      stepRate: (state.runtimeConfig as any).algorithmStepUnit,
      behaviorId,
      behaviorConfig: { ...((((state.runtimeConfig as any).behaviorConfig ?? {})[behaviorId] ?? {})) }
    },
    l2: {
      ...current.l2,
      scanMode: (state.runtimeConfig as any).scanMode,
      scanAxis: (state.runtimeConfig as any).scanAxis,
      scanUnit: (state.runtimeConfig as any).scanUnit,
      scanDirection: (state.runtimeConfig as any).scanDirection,
      eventEnabled: Boolean((state.runtimeConfig as any).eventEnabled),
      stateEnabled: Boolean((state.runtimeConfig as any).stateEnabled),
      pitch: structuredClone((state.runtimeConfig as any).pitch),
      x: structuredClone((state.runtimeConfig as any).x),
      y: structuredClone((state.runtimeConfig as any).y),
      mapping: {
        activate: { action: (state.mappingConfig as any).activate?.action ?? current.l2.mapping.activate.action, slot: Number((state.mappingConfig as any).activate?.channel ?? current.l2.mapping.activate.slot) },
        stable: { action: (state.mappingConfig as any).stable?.action ?? current.l2.mapping.stable.action, slot: Number((state.mappingConfig as any).stable?.channel ?? current.l2.mapping.stable.slot) },
        deactivate: { action: (state.mappingConfig as any).deactivate?.action ?? current.l2.mapping.deactivate.action, slot: Number((state.mappingConfig as any).deactivate?.channel ?? current.l2.mapping.deactivate.slot) },
        scanned: { action: (state.mappingConfig as any).scanned?.action ?? current.l2.mapping.scanned.action, slot: Number((state.mappingConfig as any).scanned?.channel ?? current.l2.mapping.scanned.slot) },
        scanned_empty: { action: (state.mappingConfig as any).scanned_empty?.action ?? current.l2.mapping.scanned_empty.action, slot: Number((state.mappingConfig as any).scanned_empty?.channel ?? current.l2.mapping.scanned_empty.slot) }
      }
    }
  };
  parts[active] = nextPart;
  return { ...state, runtimeConfig: { ...(state.runtimeConfig as any), parts } as any };
}

export function textEditTurn<TState>(state: PlatformState<TState>, node: Extract<MenuNode, { kind: "text" }>, delta: -1 | 1): PlatformState<TState> {
  const raw = String(readAnyValue(state, node.key) ?? "");
  const cursor = clamp(state.system.nameCursor, 0, Math.max(0, node.maxLen));
  const safe = raw.slice(0, node.maxLen);
  const curPos = clamp(cursor, 0, safe.length);
  const charset = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-";
  const chars = safe.split("");
  while (chars.length <= curPos) chars.push(" ");
  const current = chars[curPos] ?? " ";
  const idx = Math.max(0, charset.indexOf(current));
  const nextIdx = mod(idx + delta, charset.length);
  chars[curPos] = charset[nextIdx] ?? " ";
  const next = chars.join("").replace(/\s+$/g, "");
  return {
    ...state,
    system: { ...state.system, draftName: next, nameCursor: curPos }
  };
}

export function formatTimestamp(nowMs: number): string {
  const d = new Date(nowMs);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}${min}`;
}

export function factoryPayload<TState>(behavior: BehaviorEngine<TState, unknown>, createInitialState: (b: BehaviorEngine<TState, unknown>) => PlatformState<TState>, extractConfigPayload: (s: PlatformState<TState>) => ConfigPayload): ConfigPayload {
  const s = createInitialState(behavior);
  return extractConfigPayload(s);
}

export function readAnyValue<TState>(state: PlatformState<TState>, key: string): unknown {
  if (key.startsWith("transport.")) return readNestedValue(state.transport, key.slice("transport.".length));
  if (key.startsWith("mapping.")) return readNestedValue(state.mappingConfig, key.slice("mapping.".length));
  if (key.startsWith("system.")) return readNestedValue(state.system, key.slice("system.".length));
  return readValue(state.runtimeConfig, key);
}

export function writeAnyValue<TState>(state: PlatformState<TState>, key: string, value: unknown): PlatformState<TState> {
  if (key.startsWith("transport.")) {
    const transport = writeNestedValue(state.transport, key.slice("transport.".length), value) as TransportFrame;
    return { ...state, transport };
  }
  if (key.startsWith("mapping.")) {
    const mappingConfig = writeNestedValue(state.mappingConfig, key.slice("mapping.".length), value) as MappingConfig;
    return syncActivePartFromLegacy({ ...state, mappingConfig });
  }
  if (key.startsWith("system.")) {
    const system = writeNestedValue(state.system, key.slice("system.".length), value) as SystemState;
    return { ...state, system };
  }
  if (key.startsWith("parts.")) {
    const normalized = key.endsWith(".slot") ? Number(value) : value;
    const nextState = { ...state, runtimeConfig: writeValue(state.runtimeConfig, key, normalized) };
    if (key.endsWith(".l1.behaviorId")) {
      return nextState;
    }
    const active = clampPartIndex((nextState.runtimeConfig as any).activePartIndex ?? 0);
    if (key.startsWith(`parts.${active}.`)) {
      return syncLegacyFromActivePart(nextState);
    }
    return nextState;
  }
  const normalized = key.endsWith(".customName")
    ? (String(value ?? "").trim().length === 0 ? null : String(value))
    : (key === "activePartIndex" || key.endsWith(".sample.selectedSlot") ? Number(value) : value);
  const nextState = { ...state, runtimeConfig: writeValue(state.runtimeConfig, key, normalized) };
  if (key === "activePartIndex") {
    return syncLegacyFromActivePart(nextState);
  }
  if (key.startsWith("mapping.")) {
    return syncActivePartFromLegacy(nextState);
  }
  return syncActivePartFromLegacy(nextState);
}

export function reinitBehaviorState<TState>(
  state: PlatformState<TState>,
  key: string,
  resolveBehavior: (id: string) => BehaviorEngine<any, any>
): PlatformState<TState> {
  const previousBehaviorId = state.activeBehavior;
  if (key === "activePartIndex") {
    const targetPartIndex = clampPartIndex((state.runtimeConfig as any).activePartIndex ?? 0);
    const partBehaviorId = String((state.runtimeConfig as any).parts?.[targetPartIndex]?.l1?.behaviorId ?? state.runtimeConfig.activeBehavior);
    const partStates = Array.isArray((state as any).partStates) ? ((state as any).partStates as any[]) : [];
    const partState = partStates[targetPartIndex];
    return {
      ...(state as any),
      activeBehavior: partBehaviorId,
      behaviorState: (partState ?? state.behaviorState) as TState
    } as PlatformState<TState>;
  }
  const parts = key.split(".");
  let behaviorId = parts[1] ?? state.runtimeConfig.activeBehavior;
  let ns = state.runtimeConfig.behaviorConfig?.[behaviorId] as Record<string, unknown> | undefined;
  let targetPartIndex = clampPartIndex((state.runtimeConfig as any).activePartIndex ?? 0);
  if (key.startsWith("parts.")) {
    targetPartIndex = clampPartIndex(parts[1] ?? 0);
    behaviorId = String((state.runtimeConfig as any).parts?.[targetPartIndex]?.l1?.behaviorId ?? state.runtimeConfig.activeBehavior);
    ns = ((state.runtimeConfig as any).parts?.[targetPartIndex]?.l1?.behaviorConfig ?? {}) as Record<string, unknown>;
  }
  const behavior = resolveBehavior(behaviorId);
  const cfg: any = {};
  if (behavior.configMenu) {
    for (const item of behavior.configMenu(behavior.init({}))) {
      const val = ns?.[item.key];
      if (val !== undefined) cfg[item.key] = val;
    }
  }
  const next = { ...state } as any;
  next.behaviorState = behavior.init(cfg);
  next.activeBehavior = behaviorId;
  if (key.endsWith(".l1.behaviorId")) {
    next.runtimeConfig = {
      ...next.runtimeConfig,
      activeBehavior: behaviorId,
      behaviorConfig: {
        ...(next.runtimeConfig.behaviorConfig ?? {}),
        [behaviorId]: { ...((next.runtimeConfig.behaviorConfig ?? {})[behaviorId] ?? {}) }
      }
    };
    const part = next.runtimeConfig.parts?.[targetPartIndex];
    if (part) {
      const seeded = { ...((next.runtimeConfig.behaviorConfig ?? {})[behaviorId] ?? {}) };
      part.l1 = { ...part.l1, behaviorId, behaviorConfig: seeded };
    }
  }
  if (Array.isArray(next.partStates) && next.partStates.length > targetPartIndex) {
    next.partStates[targetPartIndex] = next.behaviorState;
  }
  if (key === "activeBehavior" || key.endsWith(".l1.behaviorId")) {
    next.system = {
      ...next.system,
      auxBindings: remapAuxPressBindingsForBehavior(next.system.auxBindings, previousBehaviorId, behaviorId, resolveBehavior)
    };
  }
  return next as PlatformState<TState>;
}

function primaryBehaviorAction(behaviorId: string, resolveBehavior: (id: string) => BehaviorEngine<any, any>): { actionType: string; label: string } | null {
  const behavior = resolveBehavior(behaviorId);
  if (!behavior.configMenu) return null;
  const items = behavior.configMenu(behavior.init({}));
  for (const item of items) {
    if (item.type === "action") return { actionType: item.key, label: item.label };
  }
  return null;
}

function remapAuxPressBindingsForBehavior(
  bindings: Record<string, any>,
  fromBehaviorId: string,
  toBehaviorId: string,
  resolveBehavior: (id: string) => BehaviorEngine<any, any>
): Record<string, any> {
  if (fromBehaviorId === toBehaviorId) return bindings;
  const fromAction = primaryBehaviorAction(fromBehaviorId, resolveBehavior);
  if (!fromAction) return bindings;
  const toAction = primaryBehaviorAction(toBehaviorId, resolveBehavior);

  const next: Record<string, any> = { ...bindings };
  for (const id of Object.keys(next)) {
    const binding = next[id];
    if (binding?.press?.routeKey) continue;
    if (!binding?.press || binding.press.actionType !== fromAction.actionType) continue;
    if (!toAction) {
      next[id] = binding.turn ? { turn: binding.turn, press: null } : null;
      continue;
    }
    next[id] = { ...binding, press: { actionType: toAction.actionType, label: toAction.label } };
  }
  return next;
}

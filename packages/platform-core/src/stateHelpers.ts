import type { BehaviorEngine } from "@cellsymphony/behavior-api";
import type { MappingConfig } from "@cellsymphony/mapping-core";
import type { TransportFrame } from "@cellsymphony/device-contracts";
import { clamp, mod, readNestedValue, readValue, writeNestedValue, writeValue } from "./coreUtils";
import type { ConfigPayload, MenuNode, PlatformState, SystemState } from "./index";

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
    return { ...state, mappingConfig };
  }
  if (key.startsWith("system.")) {
    const system = writeNestedValue(state.system, key.slice("system.".length), value) as SystemState;
    return { ...state, system };
  }
  return { ...state, runtimeConfig: writeValue(state.runtimeConfig, key, value) };
}

export function reinitBehaviorState<TState>(
  state: PlatformState<TState>,
  key: string,
  resolveBehavior: (id: string) => BehaviorEngine<any, any>
): PlatformState<TState> {
  const previousBehaviorId = state.activeBehavior;
  const parts = key.split(".");
  const behaviorId = parts[1] ?? state.runtimeConfig.activeBehavior;
  const behavior = resolveBehavior(behaviorId);
  const ns = state.runtimeConfig.behaviorConfig?.[behaviorId] as Record<string, unknown> | undefined;
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
  if (key === "activeBehavior") {
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

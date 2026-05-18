import type { MusicalEvent } from "@cellsymphony/musical-events";
import type { PlatformEffect, PlatformState } from "./index";
import { clamp } from "./coreUtils";
import { locate } from "./menuView";

type AuxSharedDeps<TState> = {
  menuTree: (state: PlatformState<TState>) => any;
  resolveBehavior: (activeId: string) => any;
  readAnyValue: (state: PlatformState<TState>, key: string) => unknown;
  writeAnyValue: (state: PlatformState<TState>, key: string, value: unknown) => PlatformState<TState>;
  reinitBehaviorState: (state: PlatformState<TState>, key: string) => PlatformState<TState>;
  autoSaveEffect: (state: PlatformState<TState>, effects: PlatformEffect[]) => void;
  formatDisplayValue: (key: string, value: unknown) => string;
  isSpawnActionType: (actionType: string) => boolean;
  spawnActionTypeForBehavior: (behaviorId: string) => string | null;
};

export function applyAuxUnbindChoice<TState>(state: PlatformState<TState>, encoderId: string, choice: string): PlatformState<TState> {
  const binding = state.system.auxBindings[encoderId];
  if (!binding) return setAuxToast(state, "No binding");
  let nextBinding: any = binding;
  if (choice === "Both") nextBinding = null;
  else if (choice === "Click") nextBinding = binding.turn ? { turn: binding.turn, press: null } : null;
  else if (choice === "Turn") nextBinding = binding.press ? { turn: null, press: binding.press } : null;
  const nextState = {
    ...state,
    system: {
      ...state.system,
      auxBindings: {
        ...state.system.auxBindings,
        [encoderId]: nextBinding
      }
    }
  };
  return setAuxToast(nextState, "Unbound");
}

export function assignAuxEncoder<TState>(state: PlatformState<TState>, encoderId: string, _effects: PlatformEffect[], deps: AuxSharedDeps<TState>): PlatformState<TState> {
  const view = locate(deps.menuTree(state), state, state.menu);
  const selected = view.siblings[state.menu.cursor];
  const existing = state.system.auxBindings[encoderId];
  const openUnbindConfirm = (next: PlatformState<TState>): PlatformState<TState> => ({
    ...next,
    system: {
      ...next.system,
      confirm: {
        kind: "aux_unbind",
        action: { kind: "aux_unbind", encoderId },
        cursor: 0,
        options: ["Both", "Click", "Turn", "Cancel"],
        scroll: 0
      }
    }
  });

  if (!selected || selected.kind === "group" || selected.kind === "spacer" || selected.kind === "text") {
    if (!existing) return setAuxToast(state, `${auxInputPrefix("press", encoderId)} No binding`);
    return openUnbindConfirm(state);
  }

  if (state.menu.editing && (selected.kind === "number" || selected.kind === "enum" || selected.kind === "bool")) {
    const key = (selected as any).key as string;
    if (!key) return state;
    if (existing?.turn && existing.turn.key === key) return openUnbindConfirm(state);
    const turn: any = { key, label: (selected as any).label, kind: selected.kind };
    if (selected.kind === "number") {
      turn.min = (selected as any).min;
      turn.max = (selected as any).max;
      turn.step = (selected as any).step;
    } else if (selected.kind === "enum") {
      turn.options = (selected as any).options;
    }
    return setAuxToast(
      { ...state, system: { ...state.system, auxBindings: { ...state.system.auxBindings, [encoderId]: { turn, press: existing?.press ?? null } } } },
      `${auxInputPrefix("press", encoderId)} Bound turn: ${(selected as any).label}`
    );
  }

  if (selected.kind === "action") {
    const action = (selected as any).action as any;
    if (action.type === "behavior_action") {
      const nextPress: any = deps.isSpawnActionType(action.actionType)
        ? { actionType: action.actionType, routeKey: "trigger.life.spawn_now", label: "Spawn Now" }
        : { actionType: action.actionType, label: (selected as any).label };
      if (existing?.press && existing.press.actionType === nextPress.actionType && existing.press.routeKey === nextPress.routeKey) {
        return openUnbindConfirm(state);
      }
      return setAuxToast(
        {
          ...state,
          system: {
            ...state.system,
            auxBindings: {
              ...state.system.auxBindings,
              [encoderId]: { turn: existing?.turn ?? null, press: nextPress }
            }
          }
        },
        `${auxInputPrefix("press", encoderId)} Bound click: ${(selected as any).label}`
      );
    }
    return state;
  }

  if (!existing) return setAuxToast(state, `${auxInputPrefix("press", encoderId)} No binding`);
  return openUnbindConfirm(state);
}

export function pressAuxEncoder<TState>(state: PlatformState<TState>, encoderId: string, _effects: PlatformEffect[], emit: (event: MusicalEvent) => void, deps: AuxSharedDeps<TState>): PlatformState<TState> {
  const binding = state.system.auxBindings[encoderId];
  if (!binding?.press) return setAuxToast(state, `${auxInputPrefix("press", encoderId)} No binding`);
  let actionType = binding.press.actionType;
  let label = binding.press.label ?? binding.press.actionType;
  if (binding.press.routeKey === "trigger.life.spawn_now") {
    label = "Spawn Now";
    const resolvedAction = deps.spawnActionTypeForBehavior(state.runtimeConfig.activeBehavior);
    if (!resolvedAction) return setAuxToast(state, `${auxInputPrefix("press", encoderId)} N/A (Spawn Now)`);
    actionType = resolvedAction;
  }
  const behavior = deps.resolveBehavior(state.runtimeConfig.activeBehavior);
  const newBehaviorState = behavior.onInput(state.behaviorState, { type: "behavior_action", actionType }, { bpm: state.transport.bpm, emit });
  const nextState = { ...state, behaviorState: newBehaviorState };
  return setAuxToast(nextState, `${auxInputPrefix("press", encoderId)} ${label}`);
}

export function turnAuxEncoder<TState>(state: PlatformState<TState>, encoderId: string, delta: -1 | 1, effects: PlatformEffect[], deps: AuxSharedDeps<TState>): PlatformState<TState> {
  const binding = state.system.auxBindings[encoderId];
  if (!binding?.turn) return setAuxToast(state, `${auxInputPrefix("turn", encoderId)} No binding`);
  const t = binding.turn;
  const label = t.label ?? t.key;
  if (t.kind === "number") {
    const current = deps.readAnyValue(state, t.key);
    const nextValue = clamp(Number(current) + delta * (t.step ?? 1), t.min ?? 0, t.max ?? 127);
    const nextState = deps.writeAnyValue(state, t.key, nextValue);
    if (t.key.startsWith("behaviorConfig.")) {
      const finalState = deps.reinitBehaviorState(nextState, t.key);
      deps.autoSaveEffect(finalState, effects);
      const v = deps.formatDisplayValue(t.key, deps.readAnyValue(finalState, t.key));
      return setAuxToast(finalState, `${auxInputPrefix("turn", encoderId)} ${label}: ${v}`);
    }
    deps.autoSaveEffect(nextState, effects);
    const v = deps.formatDisplayValue(t.key, deps.readAnyValue(nextState, t.key));
    return setAuxToast(nextState, `${auxInputPrefix("turn", encoderId)} ${label}: ${v}`);
  }
  if (t.kind === "enum" && t.options) {
    const current = deps.readAnyValue(state, t.key);
    const idx = t.options.indexOf(String(current));
    const nextIdx = clamp(idx + delta, 0, t.options.length - 1);
    const raw = t.options[nextIdx];
    if (t.key === "transport.playing") {
      const nextState = { ...state, transport: { ...state.transport, playing: raw === "true" } };
      const v = deps.formatDisplayValue(t.key, deps.readAnyValue(nextState, t.key));
      return setAuxToast(nextState, `${auxInputPrefix("turn", encoderId)} ${label}: ${v}`);
    }
    if (t.key === "activeBehavior" || t.key.startsWith("behaviorConfig.")) {
      const nextState = deps.writeAnyValue(state, t.key, raw);
      const finalState = deps.reinitBehaviorState(nextState, t.key);
      deps.autoSaveEffect(finalState, effects);
      const v = deps.formatDisplayValue(t.key, deps.readAnyValue(finalState, t.key));
      return setAuxToast(finalState, `${auxInputPrefix("turn", encoderId)} ${label}: ${v}`);
    }
    const nextState = deps.writeAnyValue(state, t.key, raw);
    deps.autoSaveEffect(nextState, effects);
    const v = deps.formatDisplayValue(t.key, deps.readAnyValue(nextState, t.key));
    return setAuxToast(nextState, `${auxInputPrefix("turn", encoderId)} ${label}: ${v}`);
  }
  if (t.kind === "bool") {
    const current = deps.readAnyValue(state, t.key);
    const clamped = current === true ? (delta > 0 ? true : false) : (delta < 0 ? false : true);
    const nextState = deps.writeAnyValue(state, t.key, clamped);
    deps.autoSaveEffect(nextState, effects);
    const v = deps.formatDisplayValue(t.key, deps.readAnyValue(nextState, t.key));
    return setAuxToast(nextState, `${auxInputPrefix("turn", encoderId)} ${label}: ${v}`);
  }
  return state;
}

function setAuxToast<TState>(state: PlatformState<TState>, message: string): PlatformState<TState> {
  const now = Date.now();
  const baseMs = 1400;
  const extendMs = 600;
  const maxMs = 3000;
  const current = state.system.toast;
  const active = current && current.untilMs > now;
  const untilMs = active ? Math.min(now + maxMs, Math.max(now + baseMs, current.untilMs + extendMs)) : now + baseMs;
  return {
    ...state,
    system: {
      ...state.system,
      toast: { message, untilMs }
    }
  };
}

function auxInputPrefix(kind: "press" | "turn", encoderId: string): string {
  const index = encoderId.startsWith("aux") ? encoderId.slice(3) : encoderId;
  const lead = kind === "press" ? "S" : "T";
  return `${lead}${index}:`;
}

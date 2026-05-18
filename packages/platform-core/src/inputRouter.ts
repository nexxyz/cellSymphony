import type { BehaviorEngine } from "@cellsymphony/behavior-api";
import type { DeviceInput } from "@cellsymphony/device-contracts";
import type { MusicalEvent } from "@cellsymphony/musical-events";
import { clamp } from "./coreUtils";
import type { PlatformEffect, PlatformState } from "./index";

type Deps<TState> = {
  isMainEncoderInput: (id: "main" | "aux1" | "aux2" | "aux3" | "aux4" | undefined) => boolean;
  applyAuxUnbindChoice: (state: PlatformState<TState>, encoderId: string, choice: string) => PlatformState<TState>;
  writeAnyValue: (state: PlatformState<TState>, key: string, value: unknown) => PlatformState<TState>;
  backMenu: (menu: any) => any;
  applyExternalClockPulses: (state: PlatformState<TState>, behavior: BehaviorEngine<TState, unknown>, pulses: number) => { state: PlatformState<TState>; events: MusicalEvent[] };
  locate: (root: any, state: PlatformState<TState>, menu: any) => any;
  menuTree: (state: PlatformState<TState>) => any;
  resolveBehavior: (activeId: string) => BehaviorEngine<any, any>;
  readAnyValue: (state: PlatformState<TState>, key: string) => unknown;
  openContextHelp: (state: PlatformState<TState>) => PlatformState<TState>;
  pressMenu: (state: PlatformState<TState>, effects: PlatformEffect[]) => PlatformState<TState>;
  turnMenu: (state: PlatformState<TState>, delta: -1 | 1, effects: PlatformEffect[]) => PlatformState<TState>;
  assignAuxEncoder: any;
  pressAuxEncoder: any;
  turnAuxEncoder: any;
  reinitBehaviorState: (state: PlatformState<TState>, key: string) => PlatformState<TState>;
  autoSaveEffect: (state: PlatformState<TState>, effects: PlatformEffect[]) => void;
  formatDisplayValue: (key: string, value: unknown) => string;
  isSpawnActionType: (actionType: string) => boolean;
  spawnActionTypeForBehavior: (behaviorId: string) => string | null;
  executeConfirmed: (state: PlatformState<TState>, action: any, effects: PlatformEffect[], behavior: BehaviorEngine<TState, unknown>) => PlatformState<TState>;
};

export function routeInputWithDeps<TState>(state: PlatformState<TState>, input: DeviceInput, behavior: BehaviorEngine<TState, unknown>, deps: Deps<TState>): { state: PlatformState<TState>; events: MusicalEvent[]; effects: PlatformEffect[] } {
  const events: MusicalEvent[] = [];
  const effects: PlatformEffect[] = [];
  let nextState = { ...state };
  const pressed = (i: any): boolean => (typeof i.pressed === "boolean" ? i.pressed : true);

  {
    const now = Date.now();
    const sys = nextState.system;
    const isMidiRealtime = input.type === "midi_clock" || input.type === "midi_start" || input.type === "midi_continue" || input.type === "midi_stop";
    const wasAsleep = sys.oledMode === "off" || sys.oledMode === "splash";
    nextState.system = { ...sys, lastInteractionMs: isMidiRealtime ? sys.lastInteractionMs : now, oledMode: !isMidiRealtime && wasAsleep ? "normal" : sys.oledMode };
    if (!isMidiRealtime && wasAsleep) return { state: nextState, events, effects };
  }

  if (nextState.system.confirm) {
    const c = nextState.system.confirm;
    if (input.type === "button_shift") nextState.system = { ...nextState.system, shiftHeld: pressed(input) };
    if (input.type === "button_fn") nextState.system = { ...nextState.system, fnHeld: pressed(input) };
    if (input.type === "encoder_turn" && deps.isMainEncoderInput(input.id)) {
      if (c.kind === "help_info" && c.action.kind === "help_info") {
        const contentSlots = Math.max(1, 8 - 2);
        const maxScroll = Math.max(0, c.action.lines.length - contentSlots);
        nextState.system = { ...nextState.system, confirm: { ...c, scroll: clamp(c.scroll + input.delta, 0, maxScroll) } };
      } else {
        nextState.system = { ...nextState.system, confirm: { ...c, cursor: clamp(c.cursor + input.delta, 0, c.options.length - 1) } };
      }
    } else if (input.type === "encoder_press" && deps.isMainEncoderInput(input.id)) {
      const choice = c.options[c.cursor];
      if (c.kind === "aux_unbind" && c.action.kind === "aux_unbind") {
        if (choice !== "Cancel") nextState = deps.applyAuxUnbindChoice(nextState, c.action.encoderId, choice);
      } else if (c.kind === "text_dirty_exit") {
        if (choice === "Save") nextState = deps.executeConfirmed(nextState, c.action, effects, behavior);
        else if (c.action.kind === "text_dirty_exit") {
          nextState = deps.writeAnyValue(nextState, c.action.key, c.action.original);
          nextState.system = { ...nextState.system, textEdit: null };
          nextState.menu = { ...nextState.menu, editing: false };
          if (c.action.backAfter) nextState.menu = deps.backMenu(nextState.menu);
        }
      } else if (choice === "Yes" || choice === "Confirm") {
        nextState = deps.executeConfirmed(nextState, c.action, effects, behavior);
      }
      nextState.system = { ...nextState.system, confirm: null };
    } else if (input.type === "button_a" && pressed(input)) {
      nextState.system = { ...nextState.system, confirm: null };
    }
    nextState.behaviorState = behavior.onInput(nextState.behaviorState, input, { bpm: nextState.transport.bpm, emit: (event) => events.push(event) });
    return { state: nextState, events, effects };
  }

  if (input.type === "button_shift") nextState.system = { ...nextState.system, shiftHeld: pressed(input) };
  if (input.type === "button_fn") nextState.system = { ...nextState.system, fnHeld: pressed(input) };

  if (input.type === "midi_clock") {
    if (nextState.runtimeConfig.midi.syncMode === "external" && nextState.runtimeConfig.midi.clockInEnabled) {
      const pulses = Math.max(0, Math.floor((input as any).pulses ?? 0));
      const advanced = deps.applyExternalClockPulses(nextState, behavior, pulses);
      nextState = advanced.state;
      events.push(...advanced.events);
      if (advanced.events.some((e) => e.type === "note_on")) nextState.system = { ...nextState.system, eventBlipUntilMs: Date.now() + 100 };
    }
    return { state: nextState, events, effects };
  }

  if (input.type === "midi_start" || input.type === "midi_continue" || input.type === "midi_stop") {
    if (nextState.runtimeConfig.midi.syncMode === "external" && nextState.runtimeConfig.midi.clockInEnabled && nextState.runtimeConfig.midi.respondToStartStop) {
      if (input.type === "midi_stop") {
        nextState.transport = { ...nextState.transport, playing: false };
        nextState.system = { ...nextState.system, stopLatched: true };
      } else if (!nextState.system.pausedByUser) {
        if (input.type === "midi_start") {
          nextState.transport = { ...nextState.transport, playing: true, ppqnPulse: 0, tick: 0 };
          nextState.scanIndex = 0;
          nextState.scanPulseAccumulator = 0;
          nextState.algorithmPulseAccumulator = 0;
          nextState.ppqnPulseRemainder = 0;
          nextState.system = { ...nextState.system, stopLatched: false, pendingResync: false, externalPpqnPulse: 0 };
        } else {
          nextState.transport = { ...nextState.transport, playing: true };
          nextState.system = { ...nextState.system, stopLatched: false };
        }
      }
    }
    return { state: nextState, events, effects };
  }

  if (input.type === "button_s" && pressed(input)) {
    if (nextState.runtimeConfig.midi.syncMode === "external" && nextState.system.shiftHeld) {
      nextState.system = { ...nextState.system, pendingResync: true };
      return { state: nextState, events, effects };
    }
    const wasPlaying = nextState.transport.playing;
    const now = Date.now();
    const playing = !wasPlaying;
    nextState.transport = { ...nextState.transport, playing };
    if (nextState.runtimeConfig.midi.syncMode === "external") {
      nextState.system = { ...nextState.system, pausedByUser: !playing };
      return { state: nextState, events, effects };
    }
    if (playing) {
      const isStopToPlay = nextState.system.stopLatched || (nextState.transport.ppqnPulse === 0 && nextState.transport.tick === 0);
      if (isStopToPlay) {
        nextState.transport = { ...nextState.transport, ppqnPulse: 0, tick: 0 };
        nextState.scanPulseAccumulator = 0;
        nextState.algorithmPulseAccumulator = 0;
        nextState.ppqnPulseRemainder = 0;
        nextState.scanIndex = 0;
        nextState.system = { ...nextState.system, stopLatched: false, transportFlash: "measure", transportFlashUntilMs: now + 220 };
      } else {
        nextState.system = { ...nextState.system, stopLatched: false };
      }
    }
  } else if (input.type === "button_a" && pressed(input)) {
    const view = deps.locate(deps.menuTree(nextState), nextState, nextState.menu);
    const selected = view.siblings[nextState.menu.cursor];
    if (nextState.menu.editing && selected && selected.kind === "text" && nextState.system.shiftHeld) {
      const raw = String(deps.readAnyValue(nextState, selected.key) ?? "");
      const cursor = clamp(nextState.system.nameCursor, 0, raw.length);
      if (cursor > 0) {
        const next = raw.slice(0, cursor - 1) + raw.slice(cursor);
        nextState = { ...nextState, system: { ...nextState.system, draftName: next, nameCursor: cursor - 1 } };
      }
    } else if (nextState.system.shiftHeld) {
      const b = deps.resolveBehavior(nextState.runtimeConfig.activeBehavior);
      const ns = nextState.runtimeConfig.behaviorConfig?.[nextState.runtimeConfig.activeBehavior] as Record<string, unknown> | undefined;
      const cfg: any = {};
      if (b.configMenu) for (const item of b.configMenu(b.init({}))) { const val = ns?.[item.key]; if (val !== undefined) cfg[item.key] = val; }
      nextState.behaviorState = b.init(cfg);
      nextState.system = { ...nextState.system, toast: { message: "Grid cleared", untilMs: Date.now() + 1500 } };
    } else {
      if (nextState.menu.editing && selected && selected.kind === "text") {
        const current = String(deps.readAnyValue(nextState, selected.key) ?? "");
        const sess = nextState.system.textEdit;
        const dirty = sess && sess.key === selected.key ? current !== sess.original : false;
        if (dirty && sess) {
          nextState.system = { ...nextState.system, confirm: { kind: "text_dirty_exit", action: { kind: "text_dirty_exit", key: sess.key, original: sess.original, saveAction: sess.saveAction, backAfter: true, mode: "save" }, cursor: 0, options: ["Save", "Discard"], scroll: 0 } };
        } else {
          nextState.system = { ...nextState.system, textEdit: null };
          nextState.menu = deps.backMenu(nextState.menu);
        }
      } else nextState.menu = deps.backMenu(nextState.menu);
    }
  } else if (input.type === "encoder_press" && deps.isMainEncoderInput(input.id)) {
    if (nextState.system.shiftHeld && nextState.system.fnHeld) return { state: deps.openContextHelp(nextState), events, effects };
    nextState = deps.pressMenu(nextState, effects);
  } else if (input.type === "encoder_turn" && deps.isMainEncoderInput(input.id)) {
    nextState = deps.turnMenu(nextState, input.delta, effects);
  }

  if (input.type === "encoder_press" && input.id && !deps.isMainEncoderInput(input.id)) {
    const auxDeps = {
      menuTree: deps.menuTree,
      resolveBehavior: deps.resolveBehavior,
      readAnyValue: deps.readAnyValue,
      writeAnyValue: deps.writeAnyValue,
      reinitBehaviorState: deps.reinitBehaviorState,
      autoSaveEffect: deps.autoSaveEffect,
      formatDisplayValue: deps.formatDisplayValue,
      isSpawnActionType: deps.isSpawnActionType,
      spawnActionTypeForBehavior: deps.spawnActionTypeForBehavior
    };
    nextState = nextState.system.shiftHeld
      ? deps.assignAuxEncoder(nextState, input.id, effects, auxDeps)
      : deps.pressAuxEncoder(nextState, input.id, effects, (event: MusicalEvent) => events.push(event), auxDeps);
  }
  if (input.type === "encoder_turn" && input.id && !deps.isMainEncoderInput(input.id)) {
    nextState = deps.turnAuxEncoder(nextState, input.id, input.delta, effects, {
      menuTree: deps.menuTree,
      resolveBehavior: deps.resolveBehavior,
      readAnyValue: deps.readAnyValue,
      writeAnyValue: deps.writeAnyValue,
      reinitBehaviorState: deps.reinitBehaviorState,
      autoSaveEffect: deps.autoSaveEffect,
      formatDisplayValue: deps.formatDisplayValue,
      isSpawnActionType: deps.isSpawnActionType,
      spawnActionTypeForBehavior: deps.spawnActionTypeForBehavior
    });
  }

  nextState.behaviorState = behavior.onInput(nextState.behaviorState, input, { bpm: nextState.transport.bpm, emit: (event) => events.push(event) });
  if (events.some((e) => e.type === "note_on")) nextState.system = { ...nextState.system, eventBlipUntilMs: Date.now() + 100 };
  return { state: nextState, events, effects };
}

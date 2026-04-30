import type { BehaviorEngine } from "@cellsymphony/behavior-api";
import type { DeviceInput, DisplayFrame, TransportFrame } from "@cellsymphony/device-contracts";
import type { MusicalEvent } from "@cellsymphony/musical-events";

export type PlatformState<TState> = {
  page: string;
  editing: boolean;
  transport: TransportFrame;
  behaviorState: TState;
};

export function createInitialState<TState>(behavior: BehaviorEngine<TState, unknown>): PlatformState<TState> {
  return {
    page: "Transport",
    editing: false,
    transport: { playing: false, bpm: 120, tick: 0 },
    behaviorState: behavior.init({})
  };
}

export function routeInput<TState>(
  state: PlatformState<TState>,
  input: DeviceInput,
  behavior: BehaviorEngine<TState, unknown>
): { state: PlatformState<TState>; events: MusicalEvent[] } {
  const events: MusicalEvent[] = [];
  const next = { ...state };

  if (input.type === "button_a") {
    next.editing = false;
  }
  if (input.type === "button_s") {
    next.transport = { ...next.transport, playing: !next.transport.playing };
  }

  next.behaviorState = behavior.onInput(next.behaviorState, input, {
    bpm: next.transport.bpm,
    emit: (e) => events.push(e)
  });

  return { state: next, events };
}

export function tick<TState>(
  state: PlatformState<TState>,
  behavior: BehaviorEngine<TState, unknown>
): { state: PlatformState<TState>; events: MusicalEvent[] } {
  const events: MusicalEvent[] = [];
  const nextState = behavior.onTick(state.behaviorState, {
    bpm: state.transport.bpm,
    emit: (e) => events.push(e)
  });
  return {
    state: {
      ...state,
      behaviorState: nextState,
      transport: { ...state.transport, tick: state.transport.tick + 1 }
    },
    events
  };
}

export function toDisplayFrame(page: string, line1: string): DisplayFrame {
  return {
    page,
    title: "Cell Symphony",
    lines: [line1, "A:Back S:Play/Stop"]
  };
}

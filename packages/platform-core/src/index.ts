import type { BehaviorEngine } from "@cellsymphony/behavior-api";
import { PAGES, type DeviceInput, type DisplayFrame, type LedCell, type LedMatrixFrame, type PageId, type SimulatorFrame, type TransportFrame } from "@cellsymphony/device-contracts";
import { extractBirthDeathTransitions, type CellTransition, type GridSnapshot } from "@cellsymphony/interpretation-core";
import { loadDefaultMappingConfig, mapTransitionsToMusicalEvents, type MappingConfig } from "@cellsymphony/mapping-core";
import type { MusicalEvent } from "@cellsymphony/musical-events";

export type PlatformState<TState> = {
  pageIndex: number;
  editing: boolean;
  transport: TransportFrame;
  behaviorState: TState;
  activeBehavior: string;
  mappingConfig: MappingConfig;
};

export function createInitialState<TState>(behavior: BehaviorEngine<TState, unknown>): PlatformState<TState> {
  return {
    pageIndex: 0,
    editing: false,
    transport: { playing: false, bpm: 120, tick: 0 },
    behaviorState: behavior.init({}),
    activeBehavior: behavior.id,
    mappingConfig: loadDefaultMappingConfig()
  };
}

export function routeInput<TState>(
  state: PlatformState<TState>,
  input: DeviceInput,
  behavior: BehaviorEngine<TState, unknown>
): { state: PlatformState<TState>; events: MusicalEvent[] } {
  const events: MusicalEvent[] = [];
  let nextState = { ...state };

  switch (input.type) {
    case "button_a":
      nextState.editing = false;
      break;
    case "button_s":
      nextState.transport = { ...nextState.transport, playing: !nextState.transport.playing };
      break;
    case "encoder_press":
      nextState.editing = !nextState.editing;
      break;
    case "encoder_turn":
      nextState = applyEncoder(nextState, input.delta);
      break;
    default:
      break;
  }

  nextState.behaviorState = behavior.onInput(nextState.behaviorState, input, {
    bpm: nextState.transport.bpm,
    emit: (event) => events.push(event)
  });

  return { state: nextState, events };
}

export function tick<TState>(
  state: PlatformState<TState>,
  behavior: BehaviorEngine<TState, unknown>
): { state: PlatformState<TState>; events: MusicalEvent[] } {
  const events: MusicalEvent[] = [];
  let next = { ...state };
  if (next.transport.playing) {
    const beforeGrid = toGridSnapshot(behavior.renderModel(next.behaviorState));
    next.behaviorState = behavior.onTick(next.behaviorState, {
      bpm: next.transport.bpm,
      emit: (event) => events.push(event)
    });
    const afterGrid = toGridSnapshot(behavior.renderModel(next.behaviorState));
    const transitions = extractBirthDeathTransitions(beforeGrid, afterGrid);
    const phaseFilteredTransitions = filterTransitionsByTickParity(transitions, next.transport.tick);
    const mapped = mapTransitionsToMusicalEvents(phaseFilteredTransitions, afterGrid.height, next.mappingConfig);
    events.push(...dedupeSimultaneousNotes(mapped));
    next.transport = { ...next.transport, tick: next.transport.tick + 1 };
  }
  return { state: next, events };
}

function filterTransitionsByTickParity(
  transitions: CellTransition[],
  tick: number
): CellTransition[] {
  const evenTick = tick % 2 === 0;
  if (evenTick) {
    return transitions.filter((transition) => transition.kind === "birth");
  }
  return transitions.filter((transition) => transition.kind === "death");
}

function dedupeSimultaneousNotes(events: MusicalEvent[]): MusicalEvent[] {
  const out: MusicalEvent[] = [];
  const seen = new Map<string, number>();

  for (const event of events) {
    if (event.type !== "note_on") {
      out.push(event);
      continue;
    }

    const key = `${event.channel}:${event.note}`;
    const existingIndex = seen.get(key);
    if (existingIndex === undefined) {
      seen.set(key, out.length);
      out.push(event);
      continue;
    }

    const existing = out[existingIndex];
    if (existing.type !== "note_on") {
      continue;
    }

    out[existingIndex] = {
      ...existing,
      velocity: Math.max(existing.velocity, event.velocity),
      durationMs: Math.max(existing.durationMs ?? 0, event.durationMs ?? 0)
    };
  }

  return out;
}

function toGridSnapshot(model: { cells: boolean[] }): GridSnapshot {
  return {
    width: 16,
    height: 16,
    cells: model.cells
  };
}

export function toSimulatorFrame<TState>(state: PlatformState<TState>, behavior: BehaviorEngine<TState, unknown>): SimulatorFrame {
  const model = behavior.renderModel(state.behaviorState);
  const page = pageFromIndex(state.pageIndex);

  return {
    display: {
      page,
      title: "Cell Symphony",
      editing: state.editing,
      lines: [model.statusLine, `${state.transport.playing ? "Running" : "Stopped"} ${state.transport.bpm} BPM`]
    },
    leds: {
      width: 16,
      height: 16,
      cells: cellsToLeds(model.cells)
    },
    transport: state.transport,
    activeBehavior: model.name
  };
}

function applyEncoder<TState>(state: PlatformState<TState>, delta: -1 | 1): PlatformState<TState> {
  if (state.editing) {
    const bpm = clamp(state.transport.bpm + delta, 40, 240);
    return { ...state, transport: { ...state.transport, bpm } };
  }
  const max = PAGES.length - 1;
  const nextPageIndex = clamp(state.pageIndex + delta, 0, max);
  return { ...state, pageIndex: nextPageIndex };
}

function cellsToLeds(cells: boolean[]): LedCell[] {
  return cells.map((alive) => (alive ? { r: 0, g: 255, b: 120 } : { r: 15, g: 15, b: 22 }));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function pageFromIndex(index: number): PageId {
  return PAGES[clamp(index, 0, PAGES.length - 1)];
}

export function toDisplayFrame(page: PageId, line1: string, editing: boolean): DisplayFrame {
  return {
    page,
    title: "Cell Symphony",
    editing,
    lines: [line1, "A:Back S:Play/Stop"]
  };
}

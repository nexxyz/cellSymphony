import { lifeBehavior } from "@cellsymphony/behaviors-life";
import type { DeviceInput } from "@cellsymphony/device-contracts";
import type { MusicalEvent } from "@cellsymphony/musical-events";
import { createInitialState, routeInput, tick, toOledLines, toSimulatorFrame, type PlatformState } from "@cellsymphony/platform-core";
import { createIntervalRuntimeScheduler, type RuntimeScheduler } from "./runtimeScheduler";
import type { EventsListener, RuntimeListener, SimulatorSnapshot } from "./types";

type SimulatorRuntime = {
  dispatch(input: DeviceInput): void;
  start(): void;
  stop(): void;
  subscribe(listener: RuntimeListener): () => void;
  subscribeEvents(listener: EventsListener): () => void;
  getSnapshot(): SimulatorSnapshot;
};

const behavior = lifeBehavior;

export function createSimulatorRuntime(scheduler: RuntimeScheduler = createIntervalRuntimeScheduler(150)): SimulatorRuntime {
  let state: PlatformState<ReturnType<typeof behavior.init>> = createInitialState(behavior);
  const listeners = new Set<RuntimeListener>();
  const eventListeners = new Set<EventsListener>();

  function snapshotFromState(next: typeof state): SimulatorSnapshot {
    const frame = toSimulatorFrame(next, behavior);
    return { frame, oledLines: toOledLines(frame.display) };
  }

  function publishSnapshot() {
    const snapshot = snapshotFromState(state);
    for (const listener of listeners) {
      listener(snapshot);
    }
  }

  function publishEvents(events: MusicalEvent[]) {
    if (events.length === 0) return;
    for (const listener of eventListeners) {
      listener(events);
    }
  }

  return {
    dispatch(input) {
      const result = routeInput(state, input, behavior);
      state = result.state;
      publishEvents(result.events);
      publishSnapshot();
    },
    start() {
      scheduler.start(() => {
        const result = tick(state, behavior);
        state = result.state;
        publishEvents(result.events);
        publishSnapshot();
      });
      publishSnapshot();
    },
    stop() {
      scheduler.stop();
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshotFromState(state));
      return () => listeners.delete(listener);
    },
    subscribeEvents(listener) {
      eventListeners.add(listener);
      return () => eventListeners.delete(listener);
    },
    getSnapshot() {
      return snapshotFromState(state);
    }
  };
}

import { lifeBehavior } from "@cellsymphony/behaviors-life";
import type { DeviceInput } from "@cellsymphony/device-contracts";
import type { MusicalEvent } from "@cellsymphony/musical-events";
import { createInitialState, emergencyBrake, routeInput, tick, toOledLines, toSimulatorFrame, type PlatformState } from "@cellsymphony/platform-core";
import { createIntervalRuntimeScheduler, type RuntimeScheduler } from "./runtimeScheduler";
import type { EventsListener, InputAction, RuntimeListener, SimulatorSnapshot } from "./types";

type SimulatorRuntime = {
  dispatch(input: DeviceInput): void;
  dispatchAction(action: InputAction): void;
  start(): void;
  stop(): void;
  subscribe(listener: RuntimeListener): () => void;
  subscribeEvents(listener: EventsListener): () => void;
  getSnapshot(): SimulatorSnapshot;
};

const behavior = lifeBehavior;

export function createSimulatorRuntime(scheduler: RuntimeScheduler = createIntervalRuntimeScheduler(150)): SimulatorRuntime {
  let state: PlatformState<ReturnType<typeof behavior.init>> = createInitialState(behavior);
  let eventBlipUntilMs = 0;
  let transportFlash: "none" | "beat" | "measure" = "none";
  let transportFlashUntilMs = 0;
  let shiftActive = false;
  let stopLatched = false;
  const listeners = new Set<RuntimeListener>();
  const eventListeners = new Set<EventsListener>();

  function snapshotFromState(next: typeof state): SimulatorSnapshot {
    const frame = toSimulatorFrame(next, behavior);
    return {
      frame,
      oledLines: toOledLines(frame.display),
      transportIndicator: {
        icon: frame.transport.playing ? "play" : stopLatched ? "stop" : "pause",
        flash: transportFlash,
        eventBlipUntilMs
      },
      neoKeyLeds: {
        back: "solid_red",
        space: !frame.transport.playing ? "off" : transportFlash === "measure" ? "measure" : transportFlash === "beat" ? "beat" : "off",
        shift: shiftActive ? "solid_yellow" : "off",
        fn: "off"
      },
      displayBrightness: (next as any).runtimeConfig.displayBrightness ?? 75,
      buttonBrightness: (next as any).runtimeConfig.buttonBrightness ?? 75,
      masterVolume: (next as any).runtimeConfig.masterVolume ?? 100
    };
  }

  function publishSnapshot() {
    const snapshot = snapshotFromState(state);
    for (const listener of listeners) {
      listener(snapshot);
    }
  }

  function publishEvents(events: MusicalEvent[]) {
    if (events.length === 0) return;
    if (events.some((event) => event.type === "note_on" || event.type === "sample_trigger")) {
      eventBlipUntilMs = Date.now() + 100;
    }
    for (const listener of eventListeners) {
      listener(events);
    }
  }

  function applyBeatFlash(prevPulse: number, nextPulse: number) {
    if (nextPulse <= prevPulse) return;
    for (let pulse = prevPulse + 1; pulse <= nextPulse; pulse += 1) {
      if (pulse % 96 === 0) {
        transportFlash = "measure";
        transportFlashUntilMs = Date.now() + 220;
      } else if (pulse % 24 === 0 && transportFlash !== "measure") {
        transportFlash = "beat";
        transportFlashUntilMs = Date.now() + 220;
      }
    }
  }

  function applyInput(input: DeviceInput) {
    if (input.type === "button_s" && shiftActive) {
      const result = emergencyBrake(state);
      state = result.state;
      transportFlash = "none";
      stopLatched = true;
      publishEvents(result.events);
      publishSnapshot();
      return;
    }
    if (input.type === "button_s") {
      stopLatched = false;
    }
    const result = routeInput(state, input, behavior);
    state = result.state;
    publishEvents(result.events);
    publishSnapshot();
  }

  return {
    dispatch(input) {
      applyInput(input);
    },
    dispatchAction(action) {
      if (action.type === "emergency_brake") {
        const result = emergencyBrake(state);
        state = result.state;
        transportFlash = "none";
        stopLatched = true;
        publishEvents(result.events);
        publishSnapshot();
        return;
      }
      if (action.type === "shift") {
        shiftActive = action.active;
        publishSnapshot();
        return;
      }
      applyInput(action.input);
    },
    start() {
      scheduler.start(() => {
        if (transportFlashUntilMs > 0 && Date.now() > transportFlashUntilMs) {
          transportFlashUntilMs = 0;
          transportFlash = "none";
        }
        if (eventBlipUntilMs < Date.now()) {
          eventBlipUntilMs = 0;
        }
        const prevPulse = state.transport.ppqnPulse;
        const result = tick(state, behavior);
        state = result.state;
        applyBeatFlash(prevPulse, state.transport.ppqnPulse);
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

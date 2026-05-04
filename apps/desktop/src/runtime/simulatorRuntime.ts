import { lifeBehavior } from "@cellsymphony/behaviors-life";
import type { DeviceInput } from "@cellsymphony/device-contracts";
import type { MusicalEvent } from "@cellsymphony/musical-events";
import {
  applyStoreResult,
  createInitialState,
  emergencyBrake,
  routeInput,
  tick,
  toSimulatorFrame,
  type PlatformEffect,
  type PlatformState,
  type StoreResult
} from "@cellsymphony/platform-core";
import { createIntervalRuntimeScheduler, type RuntimeScheduler } from "./runtimeScheduler";
import type { EventsListener, InputAction, RuntimeListener, SimulatorSnapshot } from "./types";
import { createLocalStorageConfigStore } from "./configStore";
import { TauriMidiService } from "./midi/tauriMidi";

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
const LOOKAHEAD_MS = 20;
const MAX_CATCHUP_MS = 250;

type ScheduledEvents = {
  dueMs: number;
  events: MusicalEvent[];
};

type ScheduledMidi = {
  dueMs: number;
  bytes: Uint8Array;
};

export function createSimulatorRuntime(scheduler: RuntimeScheduler = createIntervalRuntimeScheduler(8)): SimulatorRuntime {
  let state: PlatformState<ReturnType<typeof behavior.init>> = createInitialState(behavior);
  let transportFlash: "none" | "beat" | "measure" = "none";
  let transportFlashUntilMs = 0;
  let shiftActive = false;
  let stopLatched = false;
  let prevPlaying = state.transport.playing;
  let prevStopLatched = state.system.stopLatched;
  let prevPpqnPulse = state.transport.ppqnPulse;
  const eventQueue: ScheduledEvents[] = [];
  const midiQueue: ScheduledMidi[] = [];
  const listeners = new Set<RuntimeListener>();
  const eventListeners = new Set<EventsListener>();

  function snapshotFromState(next: typeof state): SimulatorSnapshot {
    const frame = toSimulatorFrame(next, behavior);
    return {
      frame,
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
    sendMidiForEvents(events, performance.now());
    for (const listener of eventListeners) {
      listener(events);
    }
  }

  function enqueueEvents(events: MusicalEvent[], dueMs: number) {
    if (events.length === 0) return;
    eventQueue.push({ dueMs, events });
  }

  function flushDueEvents(nowMs: number) {
    if (eventQueue.length === 0) return;
    eventQueue.sort((a, b) => a.dueMs - b.dueMs);
    while (eventQueue.length > 0 && eventQueue[0].dueMs <= nowMs) {
      const due = eventQueue.shift();
      if (!due) break;
      publishEvents(due.events);
    }
  }

  function flushDueMidi(nowMs: number) {
    if (midiQueue.length === 0) return;
    midiQueue.sort((a, b) => a.dueMs - b.dueMs);
    while (midiQueue.length > 0 && midiQueue[0].dueMs <= nowMs) {
      const due = midiQueue.shift();
      if (!due) break;
      void midi.send(due.bytes);
    }
  }

  function scheduleMidi(bytes: Uint8Array, dueMs: number) {
    midiQueue.push({ bytes, dueMs });
  }

  function midiStopOnly(nowMs: number) {
    const cfg = state.runtimeConfig.midi;
    if (!cfg.enabled || cfg.syncMode !== "internal") return;
    if (!cfg.outId) return;
    scheduleMidi(new Uint8Array([0xfc]), nowMs);
    midiQueue.length = 0; // drop pending note-offs
  }

  function sendMidiForEvents(events: MusicalEvent[], nowMs: number) {
    const cfg = state.runtimeConfig.midi;
    if (!cfg.enabled || !cfg.outId) return;
    if (!state.transport.playing) return;
    for (const e of events) {
      if (e.type === "note_on") {
        const ch = Math.max(0, Math.min(15, e.channel | 0));
        const note = Math.max(0, Math.min(127, e.note | 0));
        const vel = Math.max(1, Math.min(127, e.velocity | 0));
        scheduleMidi(new Uint8Array([0x90 | ch, note, vel]), nowMs);
        const len = Math.max(1, Math.min(10_000, e.durationMs ?? 120));
        scheduleMidi(new Uint8Array([0x80 | ch, note, 0]), nowMs + len);
        continue;
      }
      if (e.type === "cc") {
        const ch = Math.max(0, Math.min(15, e.channel | 0));
        const cc = Math.max(0, Math.min(127, e.controller | 0));
        const val = Math.max(0, Math.min(127, e.value | 0));
        scheduleMidi(new Uint8Array([0xb0 | ch, cc, val]), nowMs);
      }
    }
  }

  function sendMidiTransportIfNeeded(nowMs: number) {
    const cfg = state.runtimeConfig.midi;
    if (!cfg.enabled || cfg.syncMode !== "internal" || !cfg.outId) {
      prevPlaying = state.transport.playing;
      prevStopLatched = state.system.stopLatched;
      prevPpqnPulse = state.transport.ppqnPulse;
      return;
    }

    if (prevPlaying !== state.transport.playing) {
      if (!prevPlaying && state.transport.playing) {
        // stop->play uses Start, pause->play uses Continue
        const b = prevStopLatched ? 0xfa : 0xfb;
        scheduleMidi(new Uint8Array([b]), nowMs);
      } else if (prevPlaying && !state.transport.playing) {
        scheduleMidi(new Uint8Array([0xfc]), nowMs);
      }
    }

    if (cfg.clockOutEnabled && state.transport.playing) {
      const from = prevPpqnPulse;
      const to = state.transport.ppqnPulse;
      for (let p = from + 1; p <= to; p += 1) {
        scheduleMidi(new Uint8Array([0xf8]), nowMs);
      }
    }

    prevPlaying = state.transport.playing;
    prevStopLatched = state.system.stopLatched;
    prevPpqnPulse = state.transport.ppqnPulse;
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
      if (state.runtimeConfig.midi.syncMode === "external") {
        // In external sync mode, Shift+S is reserved for resync (handled in core).
      } else {
      const result = emergencyBrake(state);
      state = result.state;
      transportFlash = "none";
      stopLatched = true;
      midiStopOnly(performance.now());
      prevPlaying = state.transport.playing;
      prevStopLatched = state.system.stopLatched;
      prevPpqnPulse = state.transport.ppqnPulse;
      publishEvents(result.events);
      publishSnapshot();
      return;
      }
    }
    if (input.type === "button_s") {
      stopLatched = false;
    }
    const result = routeInput(state, input, behavior);
    state = result.state;
    enqueueEvents(result.events, performance.now());
    applyEffects(result.effects);
    sendMidiTransportIfNeeded(performance.now());
    flushDueEvents(performance.now());
    flushDueMidi(performance.now());
    publishSnapshot();
  }

  const store = createLocalStorageConfigStore();
  const tauriMidi = new TauriMidiService();

  let selectedOutId: string | null = null;
  let selectedInId: string | null = null;

  const midi = {
    async listOutputs() {
      return await tauriMidi.listOutputs();
    },
    async listInputs() {
      return await tauriMidi.listInputs();
    },
    async selectOutput(id: string | null) {
      selectedOutId = id;
      return await tauriMidi.selectOutput(id);
    },
    async selectInput(id: string | null) {
      selectedInId = id;
      return await tauriMidi.selectInput(id);
    },
    async send(bytes: Uint8Array) {
      await tauriMidi.send(bytes);
    },
    getSelectedOutputId() {
      return selectedOutId;
    },
    getSelectedInputId() {
      return selectedInId;
    }
  };
  let extPulses = 0;
  const extMsgs: ("start" | "continue" | "stop")[] = [];

  void tauriMidi.listenMidiIn((data: Uint8Array) => {
    for (const b of data) {
      if (b === 0xf8) {
        extPulses += 1;
      } else if (b === 0xfa) {
        extMsgs.push("start");
      } else if (b === 0xfb) {
        extMsgs.push("continue");
      } else if (b === 0xfc) {
        extMsgs.push("stop");
      }
    }
  });

  // Prime MIDI port lists on boot.
  void midi.listOutputs().then((outputs) => {
    const applied = applyStoreResult(state, { type: "midi_list_outputs_result", outputs } as any, behavior);
    state = applied.state;
    publishSnapshot();
  });
  void midi.listInputs().then((inputs) => {
    const applied = applyStoreResult(state, { type: "midi_list_inputs_result", inputs } as any, behavior);
    state = applied.state;
    publishSnapshot();
  });

  const isMidiSmoketest = (import.meta as any).env?.VITE_MIDI_SMOKETEST === "1";
  if (isMidiSmoketest) {
    // Auto-configure MIDI out to loopMIDI and start playback briefly.
    setTimeout(async () => {
      const outputs = await midi.listOutputs();
      const loopOut = outputs.find((p) => p.name.toLowerCase().includes("loopmidi")) ?? outputs[0];
      if (!loopOut) return;

      // Write config via core input path by direct state mutation (dev-only).
      state.runtimeConfig.midi.enabled = true;
      state.runtimeConfig.midi.outId = loopOut.id;
      state.runtimeConfig.midi.clockOutEnabled = true;
      state.runtimeConfig.midi.syncMode = "internal";
      void midi.selectOutput(loopOut.id);
      publishSnapshot();

      // Start playback.
      applyInput({ type: "button_s" });
      // Stop after 800ms.
      setTimeout(() => applyInput({ type: "button_s" }), 800);
    }, 200);
  }

  function execEffect(effect: PlatformEffect): StoreResult {
    try {
      if (effect.type === "store_list_presets") {
        return { type: "list_presets_result", names: store.listPresets() };
      }
      if (effect.type === "store_load_preset") {
        return { type: "load_preset_result", name: effect.name, payload: store.loadPreset(effect.name) };
      }
      if (effect.type === "store_save_preset") {
        const outcome = store.savePreset(effect.name, effect.payload);
        return { type: "save_preset_result", name: effect.name, outcome };
      }
      if (effect.type === "store_delete_preset") {
        const ok = store.deletePreset(effect.name);
        return { type: "delete_preset_result", name: effect.name, ok };
      }
      if (effect.type === "store_load_default") {
        return { type: "load_default_result", payload: store.loadDefault() };
      }
      if (effect.type === "store_save_default") {
        store.saveDefault(effect.payload);
        return { type: "save_default_result", ok: true };
      }
      if (effect.type === "midi_list_outputs_request") {
        // Fire-and-forget async, return empty immediately.
        void midi.listOutputs().then((outputs) => {
          const applied = applyStoreResult(state, { type: "midi_list_outputs_result", outputs } as any, behavior);
          state = applied.state;
          publishSnapshot();
        });
        return { type: "midi_list_outputs_result", outputs: [] } as any;
      }
      if (effect.type === "midi_list_inputs_request") {
        void midi.listInputs().then((inputs) => {
          const applied = applyStoreResult(state, { type: "midi_list_inputs_result", inputs } as any, behavior);
          state = applied.state;
          publishSnapshot();
        });
        return { type: "midi_list_inputs_result", inputs: [] } as any;
      }
      if (effect.type === "midi_select_output") {
        void midi.selectOutput(effect.id).then((res) => {
          const applied = applyStoreResult(state, { type: "midi_status", ok: res.ok, message: res.message, selectedOutId: effect.id } as any, behavior);
          state = applied.state;
          publishSnapshot();
        });
        return { type: "midi_status", ok: true } as any;
      }
      if (effect.type === "midi_select_input") {
        void midi.selectInput(effect.id).then((res) => {
          const applied = applyStoreResult(state, { type: "midi_status", ok: res.ok, message: res.message, selectedInId: effect.id } as any, behavior);
          state = applied.state;
          publishSnapshot();
        });
        return { type: "midi_status", ok: true } as any;
      }
      if (effect.type === "midi_panic") {
        const now = performance.now();
        scheduleMidi(new Uint8Array([0xfc]), now);
        for (let ch = 0; ch < 16; ch += 1) {
          scheduleMidi(new Uint8Array([0xb0 | ch, 120, 0]), now);
          scheduleMidi(new Uint8Array([0xb0 | ch, 123, 0]), now);
        }
        midiQueue.length = 0;
        return { type: "midi_status", ok: true, message: "Panic sent" };
      }
      return { type: "store_error", message: "Unknown effect" };
    } catch (err) {
      return { type: "store_error", message: err instanceof Error ? err.message : "Store error" };
    }
  }

  function applyEffects(initial: PlatformEffect[]) {
    const queue = initial.slice();
    while (queue.length > 0) {
      const effect = queue.shift();
      if (!effect) break;
      const result = execEffect(effect);
      const applied = applyStoreResult(state, result, behavior);
      state = applied.state;
      queue.push(...applied.effects);
    }
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
        enqueueEvents(result.events, performance.now());
        flushDueEvents(performance.now());
        publishSnapshot();
        return;
      }
      if (action.type === "shift") {
        shiftActive = action.active;
        applyInput({ type: "button_shift", pressed: action.active });
        return;
      }
      applyInput(action.input);
    },
    start() {
      scheduler.start((nowMs, elapsedMs) => {
        // Keep MIDI bindings aligned with persisted config.
        {
          const cfg = state.runtimeConfig.midi;
          if (cfg.enabled) {
            if (cfg.outId !== midi.getSelectedOutputId()) void midi.selectOutput(cfg.outId);
            if (cfg.inId !== midi.getSelectedInputId()) void midi.selectInput(cfg.inId);
          } else {
            if (midi.getSelectedOutputId() !== null) void midi.selectOutput(null);
            if (midi.getSelectedInputId() !== null) void midi.selectInput(null);
          }
        }

        if (transportFlashUntilMs > 0 && Date.now() > transportFlashUntilMs) {
          transportFlashUntilMs = 0;
          transportFlash = "none";
        }
        const safeElapsedMs = Math.min(elapsedMs, MAX_CATCHUP_MS);
        const prevPulse = state.transport.ppqnPulse;

        if (state.runtimeConfig.midi.syncMode === "external" && state.runtimeConfig.midi.clockInEnabled) {
          while (extMsgs.length > 0) {
            const m = extMsgs.shift();
            if (!m) break;
            const di: DeviceInput = m === "start" ? { type: "midi_start" } : m === "continue" ? { type: "midi_continue" } : { type: "midi_stop" };
            const r = routeInput(state, di, behavior);
            state = r.state;
            enqueueEvents(r.events, nowMs + LOOKAHEAD_MS);
            applyEffects(r.effects);
          }
          if (extPulses > 0) {
            const pulses = extPulses;
            extPulses = 0;
            const r = routeInput(state, { type: "midi_clock", pulses }, behavior);
            state = r.state;
            enqueueEvents(r.events, nowMs + LOOKAHEAD_MS);
            applyEffects(r.effects);
          }
        } else {
          const result = tick(state, behavior, safeElapsedMs / 1000);
          state = result.state;
          enqueueEvents(result.events, nowMs + LOOKAHEAD_MS);
          applyEffects(result.effects);
        }

        applyBeatFlash(prevPulse, state.transport.ppqnPulse);
        sendMidiTransportIfNeeded(nowMs);
        flushDueEvents(nowMs);
        flushDueMidi(nowMs);
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

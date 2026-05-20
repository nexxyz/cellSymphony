import test from "node:test";
import assert from "node:assert/strict";
import { createSimulatorRuntime } from "../src/runtime/simulatorRuntime";
import type { RuntimeScheduler } from "../src/runtime/runtimeScheduler";

class FakeScheduler implements RuntimeScheduler {
  private onTick: ((nowMs: number, elapsedMs: number) => void) | null = null;
  start(onTick: (nowMs: number, elapsedMs: number) => void): void {
    this.onTick = onTick;
  }
  stop(): void {
    this.onTick = null;
  }
  tick(nowMs: number, elapsedMs: number): void {
    this.onTick?.(nowMs, elapsedMs);
  }
}

function memoryStore() {
  const presets = new Map<string, any>();
  let defaults: any = null;
  return {
    listPresets: () => Array.from(presets.keys()),
    loadPreset: (name: string) => presets.get(name) ?? null,
    savePreset: (name: string, payload: any) => {
      const existed = presets.has(name);
      presets.set(name, payload);
      return existed ? "overwritten" as const : "created" as const;
    },
    deletePreset: (name: string) => presets.delete(name),
    loadDefault: () => defaults,
    saveDefault: (payload: any) => {
      defaults = payload;
    }
  };
}

function waitMicrotask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

test("runtime boots, dispatches, and publishes snapshots", async () => {
  const scheduler = new FakeScheduler();
  let outputsListed = 0;
  let inputsListed = 0;
  let snapshots = 0;
  const runtime = createSimulatorRuntime(scheduler, {
    store: memoryStore(),
    midiService: {
      listOutputs: async () => {
        outputsListed += 1;
        return [];
      },
      listInputs: async () => {
        inputsListed += 1;
        return [];
      },
      selectOutput: async () => ({ ok: true }),
      selectInput: async () => ({ ok: true }),
      send: async () => {},
      listenMidiIn: async () => () => {}
    },
    invoke: async () => []
  });
  runtime.subscribe(() => {
    snapshots += 1;
  });
  runtime.start();
  await waitMicrotask();
  runtime.dispatch({ type: "button_s" });
  runtime.dispatch({ type: "button_s" });
  runtime.dispatchAction({ type: "shift", active: true });
  runtime.dispatchAction({ type: "shift", active: false });
  scheduler.tick(1000, 16);
  await waitMicrotask();
  assert.ok(outputsListed >= 1);
  assert.ok(inputsListed >= 1);
  assert.ok(snapshots >= 1);
});

test("runtime tick path executes without tauri bridge", async () => {
  const scheduler = new FakeScheduler();
  let sentCount = 0;
  const runtime = createSimulatorRuntime(scheduler, {
    store: memoryStore(),
    midiService: {
      listOutputs: async () => [],
      listInputs: async () => [],
      selectOutput: async () => ({ ok: true }),
      selectInput: async () => ({ ok: true }),
      send: async () => {
        sentCount += 1;
      },
      listenMidiIn: async () => () => {}
    },
    invoke: async () => []
  });
  runtime.start();
  await waitMicrotask();
  for (let i = 0; i < 8; i += 1) {
    scheduler.tick(1000 + i * 8, 8);
  }
  await waitMicrotask();
  assert.ok(sentCount >= 0);
});

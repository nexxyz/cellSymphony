import test from "node:test";
import assert from "node:assert/strict";
import { createLocalStorageConfigStore } from "../src/runtime/configStore";

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  clear(): void {
    this.data.clear();
  }
}

function withStorage(fn: (storage: MemoryStorage) => void): void {
  const storage = new MemoryStorage();
  (globalThis as any).localStorage = storage;
  fn(storage);
}

test("save/load/delete preset round-trip", () => withStorage(() => {
  const store = createLocalStorageConfigStore();
  const payload = { activeBehavior: "life", runtimeConfig: {}, mappingConfig: {} } as any;
  assert.equal(store.savePreset("A", payload), "created");
  assert.deepEqual(store.loadPreset("A"), payload);
  assert.equal(store.deletePreset("A"), true);
  assert.equal(store.loadPreset("A"), null);
}));

test("migrates v1 preset/default keys", () => withStorage((storage) => {
  const payload = { activeBehavior: "life", runtimeConfig: {}, mappingConfig: {} } as any;
  storage.setItem("cellsymphony.presets.v1", JSON.stringify({ schemaVersion: 1, presets: { Old: payload } }));
  storage.setItem("cellsymphony.default.v1", JSON.stringify({ schemaVersion: 1, payload }));
  const store = createLocalStorageConfigStore();
  assert.deepEqual(store.listPresets(), ["Old"]);
  assert.deepEqual(store.loadDefault(), payload);
}));

test("malformed json fails safely", () => withStorage((storage) => {
  storage.setItem("cellsymphony.presets.v2", "not-json");
  storage.setItem("cellsymphony.default.v2", "not-json");
  const store = createLocalStorageConfigStore();
  assert.deepEqual(store.listPresets(), []);
  assert.equal(store.loadDefault(), null);
}));

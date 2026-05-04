import type { ConfigPayload } from "@cellsymphony/platform-core";

type PresetsV1 = {
  schemaVersion: 1;
  presets: Record<string, ConfigPayload>;
};

type DefaultV1 = {
  schemaVersion: 1;
  payload: ConfigPayload;
};

const PRESETS_KEY = "cellsymphony.presets.v1";
const DEFAULT_KEY = "cellsymphony.default.v1";

function safeParseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readPresets(): PresetsV1 {
  const parsed = safeParseJson(localStorage.getItem(PRESETS_KEY));
  if (parsed && typeof parsed === "object" && (parsed as any).schemaVersion === 1 && typeof (parsed as any).presets === "object") {
    return { schemaVersion: 1, presets: { ...(parsed as any).presets } };
  }
  // Back-compat: tolerate a bare map of name -> payload.
  if (parsed && typeof parsed === "object" && !(parsed as any).schemaVersion) {
    return { schemaVersion: 1, presets: { ...(parsed as any) } };
  }
  return { schemaVersion: 1, presets: {} };
}

function writePresets(next: PresetsV1) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(next));
}

function readDefault(): DefaultV1 | null {
  const parsed = safeParseJson(localStorage.getItem(DEFAULT_KEY));
  if (parsed && typeof parsed === "object" && (parsed as any).schemaVersion === 1 && (parsed as any).payload) {
    return parsed as DefaultV1;
  }
  // Back-compat: tolerate direct payload.
  if (parsed && typeof parsed === "object" && !(parsed as any).schemaVersion) {
    return { schemaVersion: 1, payload: parsed as ConfigPayload };
  }
  return null;
}

function writeDefault(next: DefaultV1) {
  localStorage.setItem(DEFAULT_KEY, JSON.stringify(next));
}

export type ConfigStore = {
  listPresets(): string[];
  loadPreset(name: string): ConfigPayload | null;
  savePreset(name: string, payload: ConfigPayload): "created" | "overwritten";
  deletePreset(name: string): boolean;
  loadDefault(): ConfigPayload | null;
  saveDefault(payload: ConfigPayload): void;
};

export function createLocalStorageConfigStore(): ConfigStore {
  return {
    listPresets() {
      const { presets } = readPresets();
      return Object.keys(presets);
    },
    loadPreset(name) {
      const { presets } = readPresets();
      return presets[name] ?? null;
    },
    savePreset(name, payload) {
      const cur = readPresets();
      const existed = Object.prototype.hasOwnProperty.call(cur.presets, name);
      cur.presets[name] = payload;
      writePresets(cur);
      return existed ? "overwritten" : "created";
    },
    deletePreset(name) {
      const cur = readPresets();
      const existed = Object.prototype.hasOwnProperty.call(cur.presets, name);
      if (!existed) return false;
      delete cur.presets[name];
      writePresets(cur);
      return true;
    },
    loadDefault() {
      const cur = readDefault();
      return cur?.payload ?? null;
    },
    saveDefault(payload) {
      writeDefault({ schemaVersion: 1, payload });
    }
  };
}

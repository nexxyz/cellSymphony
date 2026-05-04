import type { ConfigPayload } from "@cellsymphony/platform-core";

type PresetsV1 = {
  schemaVersion: 1;
  presets: Record<string, ConfigPayload>;
};

type PresetsV2 = {
  schemaVersion: 2;
  presets: Record<string, ConfigPayload>;
};

type DefaultV1 = {
  schemaVersion: 1;
  payload: ConfigPayload;
};

type DefaultV2 = {
  schemaVersion: 2;
  payload: ConfigPayload;
};

const PRESETS_KEY = "cellsymphony.presets.v2";
const DEFAULT_KEY = "cellsymphony.default.v2";
const PRESETS_KEY_V1 = "cellsymphony.presets.v1";
const DEFAULT_KEY_V1 = "cellsymphony.default.v1";

function safeParseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readPresets(): PresetsV2 {
  const parsed = safeParseJson(localStorage.getItem(PRESETS_KEY));
  if (parsed && typeof parsed === "object" && (parsed as any).schemaVersion === 2 && typeof (parsed as any).presets === "object") {
    return { schemaVersion: 2, presets: { ...(parsed as any).presets } };
  }

  // Migrate from v1 key if present.
  const v1 = safeParseJson(localStorage.getItem(PRESETS_KEY_V1));
  if (v1 && typeof v1 === "object" && (v1 as any).schemaVersion === 1 && typeof (v1 as any).presets === "object") {
    const migrated: PresetsV2 = { schemaVersion: 2, presets: { ...(v1 as any).presets } };
    localStorage.setItem(PRESETS_KEY, JSON.stringify(migrated));
    return migrated;
  }
  // Back-compat: tolerate a bare map of name -> payload.
  if (v1 && typeof v1 === "object" && !(v1 as any).schemaVersion) {
    const migrated: PresetsV2 = { schemaVersion: 2, presets: { ...(v1 as any) } };
    localStorage.setItem(PRESETS_KEY, JSON.stringify(migrated));
    return migrated;
  }

  return { schemaVersion: 2, presets: {} };
}

function writePresets(next: PresetsV2) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(next));
}

function readDefault(): DefaultV2 | null {
  const parsed = safeParseJson(localStorage.getItem(DEFAULT_KEY));
  if (parsed && typeof parsed === "object" && (parsed as any).schemaVersion === 2 && (parsed as any).payload) {
    return parsed as DefaultV2;
  }

  // Migrate from v1 key if present.
  const v1 = safeParseJson(localStorage.getItem(DEFAULT_KEY_V1));
  if (v1 && typeof v1 === "object" && (v1 as any).schemaVersion === 1 && (v1 as any).payload) {
    const migrated: DefaultV2 = { schemaVersion: 2, payload: (v1 as any).payload as ConfigPayload };
    localStorage.setItem(DEFAULT_KEY, JSON.stringify(migrated));
    return migrated;
  }

  // Back-compat: tolerate direct payload.
  if (v1 && typeof v1 === "object" && !(v1 as any).schemaVersion) {
    const migrated: DefaultV2 = { schemaVersion: 2, payload: v1 as ConfigPayload };
    localStorage.setItem(DEFAULT_KEY, JSON.stringify(migrated));
    return migrated;
  }

  return null;
}

function writeDefault(next: DefaultV2) {
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
      writeDefault({ schemaVersion: 2, payload });
    }
  };
}

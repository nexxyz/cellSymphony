import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type PlatformCapabilities = {
  gridWidth: number;
  gridHeight: number;
  partCount: number;
  instrumentCount: number;
  sampleSlotCount: number;
};

function toPositiveInt(value: unknown, key: keyof PlatformCapabilities): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`Invalid platform capability '${key}': expected positive integer, got ${String(value)}`);
  }
  return n;
}

export function validatePlatformCapabilities(raw: unknown): PlatformCapabilities {
  const source = (raw ?? {}) as Record<string, unknown>;
  return {
    gridWidth: toPositiveInt(source.gridWidth, "gridWidth"),
    gridHeight: toPositiveInt(source.gridHeight, "gridHeight"),
    partCount: toPositiveInt(source.partCount, "partCount"),
    instrumentCount: toPositiveInt(source.instrumentCount, "instrumentCount"),
    sampleSlotCount: toPositiveInt(source.sampleSlotCount, "sampleSlotCount")
  };
}

function loadCapabilitiesJson(): unknown {
  const fromEnv = process.env.CELLSYMPHONY_CAPS_PATH;
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    ...(fromEnv ? [fromEnv] : []),
    resolve(process.cwd(), "config", "platform-capabilities.json"),
    resolve(here, "..", "..", "..", "config", "platform-capabilities.json")
  ];
  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    try {
      const raw = readFileSync(filePath, "utf8");
      return JSON.parse(raw);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load platform capabilities from '${filePath}': ${reason}`);
    }
  }
  throw new Error("Platform capabilities file not found. Expected config/platform-capabilities.json");
}

export const PLATFORM_CAPS: PlatformCapabilities = validatePlatformCapabilities(loadCapabilitiesJson());

export function clampPartIndex(value: unknown): number {
  return Math.max(0, Math.min(PLATFORM_CAPS.partCount - 1, Number(value) | 0));
}

export function clampInstrumentIndex(value: unknown): number {
  return Math.max(0, Math.min(PLATFORM_CAPS.instrumentCount - 1, Number(value) | 0));
}

export function clampSampleSlotIndex(value: unknown): number {
  return Math.max(0, Math.min(PLATFORM_CAPS.sampleSlotCount - 1, Number(value) | 0));
}

export function partIndexOptions(): string[] {
  return Array.from({ length: PLATFORM_CAPS.partCount }, (_, i) => String(i));
}

export function instrumentIndexOptions(): string[] {
  return Array.from({ length: PLATFORM_CAPS.instrumentCount }, (_, i) => String(i));
}

export function sampleSlotOptions(): string[] {
  return Array.from({ length: PLATFORM_CAPS.sampleSlotCount }, (_, i) => String(i));
}

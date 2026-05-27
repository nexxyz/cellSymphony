import type { LedCell } from "@cellsymphony/device-contracts";
import type { MomentaryFxType } from "./platformTypes";

export const MOMENTARY_FX_TYPES: MomentaryFxType[] = ["none", "stutter", "freeze", "filter_sweep", "pitch_shift"];

export function defaultMomentaryFxParams(fxType: MomentaryFxType): Record<string, unknown> {
  if (fxType === "stutter") return { rateHz: 8, depthPct: 100 };
  if (fxType === "freeze") return { releaseMs: 500, mixPct: 100 };
  if (fxType === "filter_sweep") return { cutoffPct: 35, resonancePct: 70, sweepInMs: 200, sweepOutMs: 500 };
  if (fxType === "pitch_shift") return { semitones: 7, cents: 0, mixPct: 100 };
  return {};
}

export function momentaryFxColor(fxType: MomentaryFxType): LedCell {
  if (fxType === "stutter") return { r: 255, g: 220, b: 0 };
  if (fxType === "freeze") return { r: 0, g: 220, b: 220 };
  if (fxType === "filter_sweep") return { r: 255, g: 120, b: 0 };
  if (fxType === "pitch_shift") return { r: 255, g: 0, b: 220 };
  return { r: 20, g: 20, b: 60 };
}

export function isMomentaryFxType(value: unknown): value is MomentaryFxType {
  return typeof value === "string" && (MOMENTARY_FX_TYPES as string[]).includes(value);
}

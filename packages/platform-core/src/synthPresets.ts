import type { RuntimeConfig } from "./platformTypes";

export type SynthPresetId = "init" | "soft_pad" | "bright_pluck" | "bass_mono" | "hollow_pwm" | "lead" | "bell" | "perc_hit";

export type SynthPreset = {
  id: SynthPresetId;
  label: string;
  synth: RuntimeConfig["instruments"][number]["synth"];
};

const mkEnv = (attackMs: number, decayMs: number, sustainPct: number, releaseMs: number) => ({ attackMs, decayMs, sustainPct, releaseMs });
const mkOsc = (
  waveform: "sine" | "saw" | "square" | "pulse" | "triangle",
  levelPct: number,
  octave: -2 | -1 | 0 | 1 | 2,
  detuneCents: number,
  pulseWidthPct: number
) => ({ waveform, levelPct, octave, detuneCents, pulseWidthPct });

export const SYNTH_PRESETS: SynthPreset[] = [
  {
    id: "init",
    label: "Init",
    synth: {
      osc1: mkOsc("saw", 80, 0, 0, 50),
      osc2: mkOsc("square", 72, 0, 0, 50),
      amp: { gainPct: 80, velocitySensitivityPct: 100 },
      ampEnv: mkEnv(5, 120, 70, 180),
      filter: { type: "lowpass", cutoffHz: 8000, resonance: 20, envAmountPct: 0, keyTrackingPct: 0 },
      filterEnv: mkEnv(5, 120, 70, 180)
    }
  },
  {
    id: "soft_pad",
    label: "Soft Pad",
    synth: {
      osc1: mkOsc("triangle", 78, 0, -3, 50),
      osc2: mkOsc("pulse", 64, 0, 3, 42),
      amp: { gainPct: 72, velocitySensitivityPct: 85 },
      ampEnv: mkEnv(240, 360, 78, 460),
      filter: { type: "lowpass", cutoffHz: 3800, resonance: 18, envAmountPct: 28, keyTrackingPct: 20 },
      filterEnv: mkEnv(190, 420, 72, 500)
    }
  },
  {
    id: "bright_pluck",
    label: "Bright Pluck",
    synth: {
      osc1: mkOsc("saw", 86, 0, 0, 50),
      osc2: mkOsc("pulse", 52, 1, 6, 30),
      amp: { gainPct: 84, velocitySensitivityPct: 100 },
      ampEnv: mkEnv(3, 120, 18, 70),
      filter: { type: "lowpass", cutoffHz: 7200, resonance: 34, envAmountPct: 54, keyTrackingPct: 34 },
      filterEnv: mkEnv(2, 180, 16, 120)
    }
  },
  {
    id: "bass_mono",
    label: "Bass Mono",
    synth: {
      osc1: mkOsc("saw", 84, -1, 0, 50),
      osc2: mkOsc("square", 68, -1, -4, 50),
      amp: { gainPct: 88, velocitySensitivityPct: 72 },
      ampEnv: mkEnv(5, 160, 56, 120),
      filter: { type: "lowpass", cutoffHz: 2100, resonance: 30, envAmountPct: 22, keyTrackingPct: 24 },
      filterEnv: mkEnv(7, 170, 44, 150)
    }
  },
  {
    id: "hollow_pwm",
    label: "Hollow PWM",
    synth: {
      osc1: mkOsc("pulse", 74, 0, -6, 34),
      osc2: mkOsc("pulse", 74, 0, 6, 66),
      amp: { gainPct: 82, velocitySensitivityPct: 96 },
      ampEnv: mkEnv(9, 260, 60, 180),
      filter: { type: "bandpass", cutoffHz: 2500, resonance: 48, envAmountPct: 30, keyTrackingPct: 28 },
      filterEnv: mkEnv(5, 220, 40, 180)
    }
  },
  {
    id: "lead",
    label: "Lead",
    synth: {
      osc1: mkOsc("saw", 88, 0, 5, 50),
      osc2: mkOsc("triangle", 64, 1, -2, 50),
      amp: { gainPct: 85, velocitySensitivityPct: 100 },
      ampEnv: mkEnv(2, 130, 26, 110),
      filter: { type: "highpass", cutoffHz: 650, resonance: 24, envAmountPct: 46, keyTrackingPct: 30 },
      filterEnv: mkEnv(3, 140, 24, 130)
    }
  },
  {
    id: "bell",
    label: "Bell",
    synth: {
      osc1: mkOsc("sine", 76, 0, 0, 50),
      osc2: mkOsc("triangle", 60, 1, 12, 50),
      amp: { gainPct: 76, velocitySensitivityPct: 100 },
      ampEnv: mkEnv(1, 540, 0, 360),
      filter: { type: "notch", cutoffHz: 3000, resonance: 52, envAmountPct: 34, keyTrackingPct: 12 },
      filterEnv: mkEnv(1, 380, 0, 280)
    }
  },
  {
    id: "perc_hit",
    label: "Perc Hit",
    synth: {
      osc1: mkOsc("square", 84, 0, 0, 50),
      osc2: mkOsc("pulse", 48, 1, 0, 20),
      amp: { gainPct: 88, velocitySensitivityPct: 100 },
      ampEnv: mkEnv(0, 90, 0, 120),
      filter: { type: "lowpass", cutoffHz: 4200, resonance: 26, envAmountPct: 72, keyTrackingPct: 8 },
      filterEnv: mkEnv(0, 120, 0, 140)
    }
  }
];

export function getSynthPreset(id: SynthPresetId): SynthPreset | null {
  return SYNTH_PRESETS.find((p) => p.id === id) ?? null;
}

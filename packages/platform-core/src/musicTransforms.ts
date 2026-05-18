import { GRID_HEIGHT, GRID_WIDTH } from "@cellsymphony/device-contracts";
import type { MusicalEvent } from "@cellsymphony/musical-events";
import type { RootName, RuntimeConfig, ScaleId, ValueLaneConfig } from "./index";

export function applyModulation(intents: { x: number; y: number; degree: number; kind: any }[], events: MusicalEvent[], cfg: RuntimeConfig): MusicalEvent[] {
  const out: MusicalEvent[] = [];
  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    const intent = intents[i] ?? intents[intents.length - 1];
    if (!intent) {
      out.push(event);
      continue;
    }
    const targetChannel = event.type === "note_on" ? event.channel : 0;
    const ccs = ccFromIntent(intent, cfg, targetChannel);
    out.push(...ccs);
    if (event.type === "note_on") {
      const note = pitchFromIntent(intent, cfg, event.note);
      const vel = velocityFromIntent(intent, cfg);
      if (vel !== null) {
        out.push({ ...event, note, velocity: vel });
        continue;
      }
      out.push({ ...event, note });
      continue;
    }
    out.push(event);
  }
  return applyGlobalSound(out, cfg);
}

export function applyGlobalSound(events: MusicalEvent[], cfg: RuntimeConfig): MusicalEvent[] {
  const sound = (cfg as any).sound;
  const scale = Math.max(0, Math.min(2, Number(sound?.velocityScalePct ?? 100) / 100));
  const curve: "linear" | "soft" | "hard" = sound?.velocityCurve ?? "linear";
  const noteLen = Math.max(1, Math.min(10_000, Number(sound?.noteLengthMs ?? 120)));

  return events.map((e) => {
    if (e.type !== "note_on") return e;
    const v0 = Math.max(1, Math.min(127, e.velocity));
    const n = v0 / 127;
    const shaped = curve === "soft" ? Math.sqrt(n) : curve === "hard" ? n * n : n;
    const v1 = Math.max(1, Math.min(127, Math.round(shaped * 127 * scale)));
    return { ...e, velocity: v1, durationMs: e.durationMs ?? noteLen };
  });
}

export function pitchFromIntent(intent: { x: number; y: number }, cfg: RuntimeConfig, fallbackNote: number): number {
  const xNorm = normalizedAxis(intent.x, GRID_WIDTH, 0);
  const yNorm = normalizedAxis(intent.y, GRID_HEIGHT, 0);
  const xPos = Math.round(xNorm * (GRID_WIDTH - 1));
  const yPos = Math.round(yNorm * (GRID_HEIGHT - 1));
  const xDelta = cfg.x.pitch.enabled ? xPos * cfg.x.pitch.steps : 0;
  const yDelta = cfg.y.pitch.enabled ? yPos * cfg.y.pitch.steps : 0;
  if (!cfg.x.pitch.enabled && !cfg.y.pitch.enabled) return fallbackNote;
  const low = Math.min(cfg.pitch.lowestNote, cfg.pitch.highestNote);
  const high = Math.max(cfg.pitch.lowestNote, cfg.pitch.highestNote);
  const scaleNotes = buildScaleNotes(cfg.pitch.scale, cfg.pitch.root, low, high);
  if (scaleNotes.length === 0) return clamp(fallbackNote, low, high);
  const startIndex = nearestScaleIndex(scaleNotes, cfg.pitch.startingNote);
  let targetIndex = startIndex + xDelta + yDelta;
  if (cfg.pitch.outOfRange === "clamp") {
    targetIndex = clamp(targetIndex, 0, scaleNotes.length - 1);
  } else {
    targetIndex = mod(targetIndex, scaleNotes.length);
  }
  return scaleNotes[targetIndex] ?? clamp(fallbackNote, low, high);
}

function velocityFromIntent(intent: { x: number; y: number }, cfg: RuntimeConfig): number | null {
  const vals: number[] = [];
  if (cfg.x.velocity.enabled) vals.push(valueFromAxis(intent.x, GRID_WIDTH, cfg.x.velocity));
  if (cfg.y.velocity.enabled) vals.push(valueFromAxis(intent.y, GRID_HEIGHT, cfg.y.velocity));
  if (vals.length === 0) return null;
  return clamp(Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), 1, 127);
}

function ccFromIntent(intent: { x: number; y: number }, cfg: RuntimeConfig, channel: number): MusicalEvent[] {
  const events: MusicalEvent[] = [];
  const pushCc = (controller: number, source: number, min: number, max: number) => {
    const scaled = clamp(Math.round(min + source * (max - min)), 0, 127);
    events.push({ type: "cc", channel: clamp(channel, 0, 15), controller, value: scaled });
  };
  if (cfg.x.filterCutoff.enabled) pushCc(74, normalizedAxis(intent.x, GRID_WIDTH, cfg.x.filterCutoff.gridOffset), cfg.x.filterCutoff.from, cfg.x.filterCutoff.to);
  if (cfg.y.filterCutoff.enabled) pushCc(74, normalizedAxis(intent.y, GRID_HEIGHT, cfg.y.filterCutoff.gridOffset), cfg.y.filterCutoff.from, cfg.y.filterCutoff.to);
  if (cfg.x.filterResonance.enabled) pushCc(71, normalizedAxis(intent.x, GRID_WIDTH, cfg.x.filterResonance.gridOffset), cfg.x.filterResonance.from, cfg.x.filterResonance.to);
  if (cfg.y.filterResonance.enabled) pushCc(71, normalizedAxis(intent.y, GRID_HEIGHT, cfg.y.filterResonance.gridOffset), cfg.y.filterResonance.from, cfg.y.filterResonance.to);
  return events;
}

function valueFromAxis(index: number, size: number, lane: ValueLaneConfig): number {
  const norm = normalizedAxis(index, size, lane.gridOffset);
  return lane.from + norm * (lane.to - lane.from);
}

function normalizedAxis(index: number, size: number, gridOffset: number): number {
  const shifted = mod(index + gridOffset, size);
  return shifted / Math.max(1, size - 1);
}

function buildScaleNotes(scale: ScaleId, root: RootName, low: number, high: number): number[] {
  const intervals = scaleIntervals(scale);
  const rootPc = rootPitchClass(root);
  const notes: number[] = [];
  for (let n = clamp(low, 0, 127); n <= clamp(high, 0, 127); n += 1) {
    const pc = mod(n - rootPc, 12);
    if (intervals.includes(pc)) notes.push(n);
  }
  return notes;
}

function nearestScaleIndex(notes: number[], target: number): number {
  let bestIdx = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < notes.length; i += 1) {
    const d = Math.abs(notes[i] - target);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function rootPitchClass(root: RootName): number {
  const map: Record<RootName, number> = {
    C: 0,
    "C#": 1,
    D: 2,
    "D#": 3,
    E: 4,
    F: 5,
    "F#": 6,
    G: 7,
    "G#": 8,
    A: 9,
    "A#": 10,
    B: 11
  };
  return map[root];
}

function scaleIntervals(scale: ScaleId): number[] {
  switch (scale) {
    case "chromatic":
      return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    case "major":
      return [0, 2, 4, 5, 7, 9, 11];
    case "natural_minor":
      return [0, 2, 3, 5, 7, 8, 10];
    case "dorian":
      return [0, 2, 3, 5, 7, 9, 10];
    case "mixolydian":
      return [0, 2, 4, 5, 7, 9, 10];
    case "major_pentatonic":
      return [0, 2, 4, 7, 9];
    case "minor_pentatonic":
      return [0, 3, 5, 7, 10];
    case "harmonic_minor":
      return [0, 2, 3, 5, 7, 8, 11];
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function mod(value: number, base: number): number {
  return ((value % base) + base) % base;
}

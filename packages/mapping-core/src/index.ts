import type { CellTransition } from "@cellsymphony/interpretation-core";
import type { MusicalEvent } from "@cellsymphony/musical-events";
import defaults from "./config/default-mapping.json";

export type TriggerTarget = {
  channel: number;
  velocity: number;
  durationMs: number;
};

export type MappingConfig = {
  baseMidiNote: number;
  maxMidiNote: number;
  scale: number[];
  rowStepDegrees: number;
  columnStepDegrees: number;
  birth: TriggerTarget;
  death: TriggerTarget;
};

export function loadDefaultMappingConfig(): MappingConfig {
  return validateConfig(defaults as MappingConfig);
}

export function mapTransitionsToMusicalEvents(
  transitions: CellTransition[],
  gridHeight: number,
  config: MappingConfig
): MusicalEvent[] {
  const safe = validateConfig(config);
  return transitions.map((transition) => {
    const note = toPentatonicNote(transition.x, transition.y, gridHeight, safe);
    const target = transition.kind === "birth" ? safe.birth : safe.death;
    return {
      type: "note_on",
      channel: target.channel,
      note,
      velocity: target.velocity,
      durationMs: target.durationMs
    } satisfies MusicalEvent;
  });
}

function toPentatonicNote(x: number, y: number, gridHeight: number, config: MappingConfig): number {
  const rowFromBottom = Math.max(0, gridHeight - 1 - y);
  const degree = rowFromBottom * config.rowStepDegrees + x * config.columnStepDegrees;
  const scaleLen = config.scale.length;
  const scaleIndex = mod(degree, scaleLen);
  const octave = Math.floor(degree / scaleLen);
  const note = config.baseMidiNote + octave * 12 + config.scale[scaleIndex];
  return clamp(note, config.baseMidiNote, config.maxMidiNote);
}

function validateConfig(config: MappingConfig): MappingConfig {
  if (config.scale.length === 0) {
    throw new Error("Mapping scale must contain at least one degree.");
  }
  const baseMidiNote = clamp(Math.floor(config.baseMidiNote), 0, 127);
  const maxMidiNote = clamp(Math.floor(config.maxMidiNote), baseMidiNote, 127);
  return {
    ...config,
    baseMidiNote,
    maxMidiNote,
    scale: config.scale.map((step) => clamp(Math.floor(step), 0, 11)),
    rowStepDegrees: Math.max(0, Math.floor(config.rowStepDegrees)),
    columnStepDegrees: Math.max(0, Math.floor(config.columnStepDegrees)),
    birth: sanitizeTarget(config.birth),
    death: sanitizeTarget(config.death)
  };
}

function sanitizeTarget(target: TriggerTarget): TriggerTarget {
  return {
    channel: clamp(Math.floor(target.channel), 0, 15),
    velocity: clamp(Math.floor(target.velocity), 1, 127),
    durationMs: clamp(Math.floor(target.durationMs), 1, 8000)
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mod(value: number, base: number): number {
  return ((value % base) + base) % base;
}

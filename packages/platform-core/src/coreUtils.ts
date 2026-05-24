import { PLATFORM_CAPS } from "./platformCaps";
import type { FxBusConfig, FxBusEffectType, PartConfig } from "./platformTypes";
import type { RuntimeConfig } from "./platformTypes";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function mod(value: number, base: number): number {
  return ((value % base) + base) % base;
}

export function fitOledText(text: string, columns: number): string {
  return fitOledTextToWidth(text, columns);
}

export function fitOledTextToWidth(text: string, width: number): string {
  if (text.length <= width) return text;
  if (width <= 3) return text.slice(0, width);
  return `${text.slice(0, width - 3)}...`;
}

export function fitOledMenuLine(line: string, columns: number): string {
  if (!line.startsWith("@@")) return fitOledText(line, columns);
  if (line.startsWith("@@> ")) {
    return `@@> ${fitOledTextToWidth(line.slice(4), columns - 2)}`;
  }
  return `@@${fitOledTextToWidth(line.slice(2), columns)}`;
}

export function wrapOledText(text: string, width: number): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length === 0) return [""];
  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";
  const pushCurrent = () => {
    if (current.length > 0) lines.push(current);
    current = "";
  };
  for (const word of words) {
    if (word.length > width) {
      pushCurrent();
      for (let i = 0; i < word.length; i += width) {
        lines.push(word.slice(i, i + width));
      }
      continue;
    }
    if (current.length === 0) {
      current = word;
      continue;
    }
    if ((current.length + 1 + word.length) <= width) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  pushCurrent();
  return lines;
}

export function readNestedValue(root: unknown, key: string): unknown {
  const parts = key.split(".");
  let cur: any = root;
  for (const p of parts) cur = cur[p];
  return cur;
}

export function writeNestedValue(root: unknown, key: string, value: unknown): unknown {
  const clone = structuredClone(root);
  const parts = key.split(".");
  let cursor: any = clone;
  for (let i = 0; i < parts.length - 1; i += 1) cursor = cursor[parts[i]];
  const leaf = parts[parts.length - 1];
  cursor[leaf] = typeof cursor[leaf] === "number" ? Number(value) : value;
  return clone;
}

export function readValue<TConfig extends object>(cfg: TConfig, key: string): unknown {
  const parts = key.split(".");
  let cur: any = cfg;
  for (const p of parts) cur = cur[p];
  return cur;
}

export function writeValue<TConfig extends object>(cfg: TConfig, key: string, value: unknown): TConfig {
  const clone = structuredClone(cfg) as TConfig;
  const parts = key.split(".");
  let cursor: any = clone;
  for (let i = 0; i < parts.length - 1; i += 1) cursor = cursor[parts[i]];
  cursor[parts[parts.length - 1]] = value;
  return clone;
}

export function deriveBusAutoName(bus: FxBusConfig): string {
  const parts: string[] = [];
  if (bus.slot1.type !== "none") parts.push(bus.slot1.type);
  if (bus.slot2.type !== "none") parts.push(bus.slot2.type);
  if (parts.length === 0) return "(none)";
  return parts.join("+");
}

export function derivePartAutoName(part: PartConfig): string {
  return part.l1.behaviorId;
}

export function deriveInstAutoName(instrument: { type: string }): string {
  if (instrument.type === "midi") return "MIDI";
  if (instrument.type === "sample") return "sample";
  return "synth";
}

export function fxBusLabel(busIdx: number, bus: FxBusConfig): string {
  return `B${busIdx + 1}: ${bus.name}`;
}

export function partLabel(partIdx: number, part: PartConfig): string {
  return `P${partIdx + 1}: ${part.name}`;
}

export function instrumentLabel(state: { runtimeConfig: { instruments: Array<{ name: string }> } }, idx: number): string {
  const inst: any = (state.runtimeConfig as any).instruments?.[idx] ?? {};
  return `I${idx + 1}: ${inst.name ?? "synth"}`;
}

export function formatDisplayValue(key: string, value: unknown, runtimeConfig?: RuntimeConfig): string {
  if (key === "mapping.activate.channel" || key === "mapping.stable.channel" || key === "mapping.deactivate.channel" || key === "mapping.scanned.channel" || key === "mapping.scanned_empty.channel" || /\.l2\.mapping\.(activate|stable|deactivate|scanned|scanned_empty)\.slot$/.test(key)) {
    const n = clamp(Math.floor(Number(value)), 0, 15);
    const parts = runtimeConfig?.parts ?? [];
    const inst = runtimeConfig?.instruments?.[n];
    if (inst) return `${n + 1}: ${instrumentLabel({ runtimeConfig: runtimeConfig as any }, n)}`;
    return String(n + 1);
  }
  if (/^instruments\.\d+\.midi\.channel$/.test(key)) {
    const n = clamp(Math.floor(Number(value)), 0, 15);
    return String(n + 1);
  }
  if (/^instruments\.\d+\.type$/.test(key)) {
    if (value === "midi") return "MIDI only";
    if (value === "sample") return "sample";
    return "synth";
  }
  if (key === "masterVolume") return `Vol: ${value}%`;
  if (key === "displayBrightness") return `OLED ${value}%`;
  if (key === "gridBrightness") return `Grid ${value}%`;
  if (key === "buttonBrightness") return `Btn ${value}%`;
  if (key === "screenSleepSeconds") return Number(value) <= 0 ? "Sleep: Off" : `Sleep: ${value}s`;
  if (key === "activeBehavior") return String(value);
  if (key === "activePartIndex") {
    const n = clamp(Math.floor(Number(value)), 0, PLATFORM_CAPS.partCount - 1);
    const parts = runtimeConfig?.parts ?? [];
    if (parts[n]) return partLabel(n, parts[n]);
    return `Part ${n + 1}`;
  }
  if (/^instruments\.\d+\.sample\.selectedSlot$/.test(key)) {
    const n = clamp(Math.floor(Number(value)), 0, PLATFORM_CAPS.sampleSlotCount - 1);
    return String(n + 1);
  }
  if (key === "scanMode" || key.endsWith(".l2.scanMode")) return value === "immediate" ? "no scan" : "scanning";
  if (key === "scanAxis" || key.endsWith(".l2.scanAxis")) return value === "columns" ? "cols" : "rows";
  if (key === "scanDirection" || key.endsWith(".l2.scanDirection")) return value === "forward" ? "fwd" : "rev";
  if (key === "pitch.startingNote" || key === "pitch.lowestNote" || key === "pitch.highestNote" || key.endsWith(".l2.pitch.startingNote") || key.endsWith(".l2.pitch.lowestNote") || key.endsWith(".l2.pitch.highestNote")) {
    return formatNoteWithMidi(Number(value));
  }
  if (key === "pitch.outOfRange" || key.endsWith(".l2.pitch.outOfRange")) return value === "wrap" ? "wrap" : "clamp";
  if (key === "pitch.scale" || key.endsWith(".l2.pitch.scale")) return formatScaleName(String(value));
  if (key === "pitch.root" || key.endsWith(".l2.pitch.root")) return String(value);
  if (/^instruments\.\d+\.mixer\.route$/.test(key)) {
    const raw = String(value);
    if (raw === "direct") return "direct";
    const m = /^fx_bus_(\d+)$/.exec(raw);
    if (m && runtimeConfig?.mixer?.buses) {
      const busIdx = Number(m[1]) - 1;
      const bus = runtimeConfig.mixer.buses[busIdx];
      if (bus) return fxBusLabel(busIdx, bus);
    }
    return raw;
  }
  if (key === "transport.playing") return value === true || value === "true" ? "Play" : "Stop";
  if (typeof value === "boolean") return value ? "On" : "Off";
  return String(value);
}

function formatNoteWithMidi(note: number): string {
  const n = clamp(Math.round(note), 0, 127);
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const name = names[n % 12];
  const octave = Math.floor(n / 12) - 1;
  return `${name}${octave} (${n})`;
}

function formatScaleName(scale: string): string {
  const map: Record<string, string> = {
    chromatic: "Chromatic",
    major: "Major",
    natural_minor: "Natural Minor",
    dorian: "Dorian",
    mixolydian: "Mixolydian",
    major_pentatonic: "Maj Pentatonic",
    minor_pentatonic: "Min Pentatonic",
    harmonic_minor: "Harm Minor"
  };
  return map[scale] ?? scale;
}

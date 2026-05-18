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

export function formatDisplayValue(key: string, value: unknown): string {
  if (key === "masterVolume") return `Vol: ${value}%`;
  if (key === "displayBrightness") return `OLED ${value}%`;
  if (key === "gridBrightness") return `Grid ${value}%`;
  if (key === "buttonBrightness") return `Btn ${value}%`;
  if (key === "screenSleepSeconds") return Number(value) <= 0 ? "Sleep: Off" : `Sleep: ${value}s`;
  if (key === "activeBehavior") return String(value);
  if (key === "scanMode") return value === "immediate" ? "Immediate" : "Scanning";
  if (key === "scanAxis") return value === "columns" ? "Cols" : "Rows";
  if (key === "scanDirection") return value === "forward" ? "Fwd" : "Rev";
  if (key === "pitch.startingNote" || key === "pitch.lowestNote" || key === "pitch.highestNote") {
    return formatNoteWithMidi(Number(value));
  }
  if (key === "pitch.outOfRange") return value === "wrap" ? "Wrap" : "Clamp";
  if (key === "pitch.scale") return formatScaleName(String(value));
  if (key === "pitch.root") return String(value);
  if (key === "transport.playing") return value === true || value === "true" ? "Play" : "Stop";
  if (key === "eventParity") return value === "none" ? "All" : "Odd/Even";
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

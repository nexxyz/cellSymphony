import { GRID_HEIGHT, GRID_WIDTH, type LedCell } from "@cellsymphony/device-contracts";
import type { MusicalEvent } from "@cellsymphony/musical-events";
import { clamp } from "./coreUtils";

export function dedupeSimultaneousNotes(events: MusicalEvent[]): MusicalEvent[] {
  const out: MusicalEvent[] = [];
  const seen = new Map<string, number>();
  for (const event of events) {
    if (event.type !== "note_on") {
      out.push(event);
      continue;
    }
    const key = `${event.channel}:${event.note}`;
    const idx = seen.get(key);
    if (idx === undefined) {
      seen.set(key, out.length);
      out.push(event);
      continue;
    }
    const existing = out[idx];
    if (existing.type === "note_on") {
      out[idx] = { ...existing, velocity: Math.max(existing.velocity, event.velocity), durationMs: Math.max(existing.durationMs ?? 0, event.durationMs ?? 0) };
    }
  }
  return out;
}

export function toGridSnapshot(model: { cells: boolean[] }): { width: number; height: number; cells: boolean[] } {
  return { width: GRID_WIDTH, height: GRID_HEIGHT, cells: model.cells };
}

export function cellsToLeds(
  cells: boolean[],
  triggerTypes: import("@cellsymphony/behavior-api").CellTriggerType[] | undefined,
  scanCursor: { axis: "rows" | "columns"; index: number } | null,
  brightness: number
): LedCell[] {
  const b = clamp(brightness, 0.1, 1);
  const OFF_BG: LedCell = { r: 15, g: 15, b: 22 };
  const OFF_CURSOR: LedCell = { r: 70, g: 70, b: 76 };
  return cells.map((alive, i) => {
    const x = i % GRID_WIDTH;
    const y = Math.floor(i / GRID_WIDTH);
    const inCursor = scanCursor !== null && ((scanCursor.axis === "columns" && x === scanCursor.index) || (scanCursor.axis === "rows" && y === scanCursor.index));
    if (!alive) return scaleLed(inCursor ? OFF_CURSOR : OFF_BG, b);
    const type = triggerTypes?.[i] ?? "stable";
    switch (type) {
      case "activate":
        return scaleLed({ r: 255, g: 255, b: 255 }, b);
      case "deactivate":
        return scaleLed({ r: 128, g: 128, b: 128 }, b);
      case "scanned":
        return scaleLed({ r: 255, g: 0, b: 0 }, b);
      default:
        return scaleLed({ r: 0, g: 255, b: 120 }, b);
    }
  });
}

function scaleLed(cell: LedCell, brightness: number): LedCell {
  return {
    r: Math.round(cell.r * brightness),
    g: Math.round(cell.g * brightness),
    b: Math.round(cell.b * brightness)
  };
}

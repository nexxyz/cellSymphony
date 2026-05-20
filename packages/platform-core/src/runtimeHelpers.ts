import { GRID_HEIGHT, GRID_WIDTH, type LedCell } from "@cellsymphony/device-contracts";
import type { MusicalEvent } from "@cellsymphony/musical-events";
import { clamp } from "./coreUtils";
import { GRID_DOMAIN } from "./gridDomain";
import { PLATFORM_CAPS } from "./platformCaps";

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
  brightness: number,
  fnHeld: boolean = false,
  activePartIndex: number = 0
): LedCell[] {
  const b = clamp(brightness, 0.1, 1);
  const OFF_BG: LedCell = { r: 15, g: 15, b: 22 };
  const OFF_CURSOR: LedCell = { r: 70, g: 70, b: 76 };
  const out = Array.from({ length: GRID_WIDTH * GRID_HEIGHT }, () => scaleLed(OFF_BG, b));
  for (let yWorld = 0; yWorld < GRID_HEIGHT; yWorld += 1) {
    for (let x = 0; x < GRID_WIDTH; x += 1) {
      const worldIndex = GRID_DOMAIN.indexOf({ x, y: yWorld });
      const screenIndex = GRID_DOMAIN.toDisplayIndex({ x, y: yWorld });
      const alive = !!cells[worldIndex];
      const inCursor = scanCursor !== null && ((scanCursor.axis === "columns" && x === scanCursor.index) || (scanCursor.axis === "rows" && yWorld === scanCursor.index));
      if (!alive) {
        out[screenIndex] = scaleLed(inCursor ? OFF_CURSOR : OFF_BG, b);
        continue;
      }
      const type = triggerTypes?.[worldIndex] ?? "stable";
      switch (type) {
        case "activate":
          out[screenIndex] = scaleLed({ r: 255, g: 255, b: 255 }, b);
          break;
        case "deactivate":
          out[screenIndex] = scaleLed({ r: 128, g: 128, b: 128 }, b);
          break;
        case "scanned":
          out[screenIndex] = scaleLed({ r: 255, g: 0, b: 0 }, b);
          break;
        default:
          out[screenIndex] = scaleLed({ r: 0, g: 255, b: 120 }, b);
      }
    }
  }
  if (fnHeld) {
    const layerCount = Math.min(PLATFORM_CAPS.partCount, GRID_HEIGHT);
    for (let layer = 0; layer < layerCount; layer += 1) {
      const screenIndex = GRID_DOMAIN.toDisplayIndex({ x: 0, y: layer });
      const isActive = layer === activePartIndex;
      out[screenIndex] = scaleLed(isActive ? { r: 0, g: 210, b: 0 } : { r: 90, g: 90, b: 90 }, b);
    }
  }
  return out;
}

export function sampleAssignmentToLeds(
  assignments: Array<{ x: number; y: number; sampleSlot: number; level?: "high" | "medium" | "low" }>,
  selectedSampleSlot: number,
  velocityLevelsEnabled: boolean,
  brightness: number
): LedCell[] {
  const b = Math.max(0, Math.min(1, brightness));
  const out: LedCell[] = Array.from({ length: GRID_WIDTH * GRID_HEIGHT }, () => ({ r: 0, g: 0, b: 0 }));
  for (const a of assignments) {
    if (a.x < 0 || a.x >= GRID_WIDTH || a.y < 0 || a.y >= GRID_HEIGHT) continue;
    const screenIndex = GRID_DOMAIN.toDisplayIndex({ x: a.x, y: a.y });
    if (a.sampleSlot !== selectedSampleSlot) {
      out[screenIndex] = scaleLed({ r: 70, g: 70, b: 70 }, b);
      continue;
    }
    if (!velocityLevelsEnabled) {
      out[screenIndex] = scaleLed({ r: 220, g: 220, b: 220 }, b);
      continue;
    }
    if (a.level === "high") out[screenIndex] = scaleLed({ r: 220, g: 0, b: 0 }, b);
    else if (a.level === "medium") out[screenIndex] = scaleLed({ r: 220, g: 180, b: 0 }, b);
    else out[screenIndex] = scaleLed({ r: 0, g: 220, b: 0 }, b);
  }
  return out;
}

function scaleLed(cell: LedCell, brightness: number): LedCell {
  return {
    r: Math.round(cell.r * brightness),
    g: Math.round(cell.g * brightness),
    b: Math.round(cell.b * brightness)
  };
}

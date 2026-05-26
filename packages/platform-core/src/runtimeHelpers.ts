import { getBehavior } from "@cellsymphony/behavior-api";
import { GRID_HEIGHT, GRID_WIDTH, type LedCell } from "@cellsymphony/device-contracts";
import type { MusicalEvent } from "@cellsymphony/musical-events";
import { clamp, mod } from "./coreUtils";
import { GRID_DOMAIN } from "./gridDomain";
import { PLATFORM_CAPS } from "./platformCaps";
import type { PlatformState } from "./platformTypes";

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

export function ghostCellsForInactiveParts<TState>(state: PlatformState<TState>, activePart: number, cellCount: number): boolean[] {
  const out = Array.from({ length: cellCount }, () => false);
  const parts: any[] = Array.isArray((state.runtimeConfig as any).parts) ? (state.runtimeConfig as any).parts : [];
  const partStates: any[] = Array.isArray((state as any).partStates) ? ((state as any).partStates as any[]) : [];
  for (let idx = 0; idx < parts.length; idx += 1) {
    if (idx === activePart) continue;
    const behavior = getBehavior(String(parts[idx]?.l1?.behaviorId ?? "none"));
    if (!behavior || partStates[idx] === undefined) continue;
    const cells = behavior.renderModel(partStates[idx]).cells;
    for (let i = 0; i < Math.min(cellCount, cells.length); i += 1) out[i] ||= Boolean(cells[i]);
  }
  return out;
}

export function cellsToLeds(
  cells: boolean[],
  triggerTypes: import("@cellsymphony/behavior-api").CellTriggerType[] | undefined,
  scanCursor: { axis: "rows" | "columns"; index: number; sections?: unknown } | null,
  brightness: number,
  fnHeld: boolean = false,
  activePartIndex: number = 0,
  ghostCells?: boolean[]
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
      const inCursor = scanCursor !== null && isInScanCursor(x, yWorld, scanCursor);
      if (!alive) {
        if (ghostCells?.[worldIndex]) {
          out[screenIndex] = scaleLed(inCursor ? { r: 45, g: 70, b: 55 } : { r: 0, g: 46, b: 25 }, b);
          continue;
        }
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

function isInScanCursor(x: number, y: number, cursor: { axis: "rows" | "columns"; index: number; sections?: unknown }): boolean {
  const sections = cursor.sections === "2" ? 2 : cursor.sections === "4" ? 4 : cursor.sections === "8" ? 8 : 1;
  if (sections <= 1) return (cursor.axis === "columns" && x === cursor.index) || (cursor.axis === "rows" && y === cursor.index);
  if (cursor.axis === "rows") {
    const sectionHeight = Math.max(1, Math.floor(GRID_HEIGHT / sections));
    const step = mod(cursor.index, GRID_WIDTH * sections);
    const section = Math.floor(step / GRID_WIDTH);
    return x === step % GRID_WIDTH && y >= section * sectionHeight && y < (section + 1) * sectionHeight;
  }
  const sectionWidth = Math.max(1, Math.floor(GRID_WIDTH / sections));
  const step = mod(cursor.index, GRID_HEIGHT * sections);
  const section = Math.floor(step / GRID_HEIGHT);
  return y === step % GRID_HEIGHT && x >= section * sectionWidth && x < (section + 1) * sectionWidth;
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

export function touchModeToLeds<TState>(state: PlatformState<TState>, brightness: number): LedCell[] | null {
  const mode = state.system.touchMode;
  if (mode === "none") return null;
  const b = clamp(brightness, 0.1, 1);
  const out: LedCell[] = Array.from({ length: GRID_WIDTH * GRID_HEIGHT }, () => scaleLed({ r: 8, g: 8, b: 14 }, b));
  const instruments = Array.isArray((state.runtimeConfig as any).instruments) ? ((state.runtimeConfig as any).instruments as any[]) : [];

  if (mode === "mix") {
    const count = Math.min(instruments.length, GRID_WIDTH);
    for (let x = 0; x < count; x += 1) {
      const inst = instruments[x] ?? {};
      const mixer = inst.mixer ?? {};
      const y = clamp(Math.round(clamp(Number(mixer.volume ?? 100), 0, 100) / 100 * (GRID_HEIGHT - 1)), 0, GRID_HEIGHT - 1);
      const routedToFx = typeof mixer.route === "string" && mixer.route.startsWith("fx_bus_");
      const color = routedToFx ? { r: 180, g: 0, b: 220 } : { r: 0, g: 220, b: 90 };
      out[GRID_DOMAIN.toDisplayIndex({ x, y })] = scaleLed(color, b);
    }
    return out;
  }

  if (mode === "pan") {
    const count = Math.min(instruments.length, GRID_HEIGHT);
    for (let y = 0; y < count; y += 1) {
      const panPos = clamp(Math.round(Number(instruments[y]?.mixer?.panPos ?? Math.floor(GRID_WIDTH / 2))), 0, GRID_WIDTH - 1);
      out[GRID_DOMAIN.toDisplayIndex({ x: panPos, y })] = scaleLed({ r: 255, g: 170, b: 0 }, b);
    }
    return out;
  }

  for (let y = 0; y < GRID_HEIGHT; y += 1) {
    const x = y % 2 === 0 ? 2 : 5;
    out[GRID_DOMAIN.toDisplayIndex({ x, y })] = scaleLed({ r: 55, g: 55, b: 180 }, b);
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

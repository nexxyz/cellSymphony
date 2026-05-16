export type GridSnapshot = {
  width: number;
  height: number;
  cells: boolean[];
};

export type CellTransitionKind = "activate" | "deactivate";
export type CellTriggerKind = CellTransitionKind | "stable" | "scanned";

export type CellTransition = {
  x: number;
  y: number;
  kind: CellTransitionKind;
};

export type TickStrategy =
  | { mode: "whole_grid_transitions"; parity: "none" | "activate_even_deactivate_odd" }
  | { mode: "whole_grid_active" }
  | { mode: "scan_column_active" }
  | { mode: "scan_row_active" };

export type AxisStrategy =
  | { mode: "scale_step"; step: number }
  | { mode: "timing_only" }
  | { mode: "ignore" };

export type InterpretationProfile = {
  id: string;
  event: { enabled: boolean; parity: "none" | "activate_even_deactivate_odd" };
  state: { enabled: boolean; tick: TickStrategy };
  x: AxisStrategy;
  y: AxisStrategy;
};

export type CellTriggerIntent = {
  x: number;
  y: number;
  kind: CellTriggerKind;
  degree: number;
};

export function extractTransitions(previous: GridSnapshot, next: GridSnapshot): CellTransition[] {
  const transitions: CellTransition[] = [];
  const len = Math.min(previous.cells.length, next.cells.length);
  for (let i = 0; i < len; i += 1) {
    const before = previous.cells[i];
    const after = next.cells[i];
    if (before === after) {
      continue;
    }
    const x = i % previous.width;
    const y = Math.floor(i / previous.width);
    transitions.push({ x, y, kind: after ? "activate" : "deactivate" });
  }
  return transitions;
}

export function interpretGrid(
  previous: GridSnapshot,
  next: GridSnapshot,
  tick: number,
  profile: InterpretationProfile
): CellTriggerIntent[] {
  const eventCandidates = profile.event.enabled
    ? selectEventCandidates(previous, next, tick, profile.event.parity)
    : [];
  const stateCandidates = profile.state.enabled
    ? selectStateCandidates(next, tick, profile.state.tick)
    : [];

  return [...eventCandidates, ...stateCandidates].map((intent) => ({
    ...intent,
    degree: computeDegree(next.height, intent.x, intent.y, profile)
  }));
}

export function applyParityGating(transitions: CellTransition[], tick: number): CellTransition[] {
  const evenTick = tick % 2 === 0;
  if (evenTick) {
    return transitions.filter((transition) => transition.kind === "activate");
  }
  return transitions.filter((transition) => transition.kind === "deactivate");
}

function selectEventCandidates(
  previous: GridSnapshot,
  next: GridSnapshot,
  tick: number,
  parity: "none" | "activate_even_deactivate_odd"
): Array<{ x: number; y: number; kind: CellTriggerKind }> {
  const transitions = extractTransitions(previous, next);
  if (parity === "activate_even_deactivate_odd") {
    return applyParityGating(transitions, tick);
  }
  return transitions;
}

function selectStateCandidates(
  next: GridSnapshot,
  tick: number,
  strategy: TickStrategy
): Array<{ x: number; y: number; kind: CellTriggerKind }> {
  if (strategy.mode === "whole_grid_active") {
    const out: Array<{ x: number; y: number; kind: CellTriggerKind }> = [];
    for (let y = 0; y < next.height; y += 1) {
      for (let x = 0; x < next.width; x += 1) {
        if (next.cells[y * next.width + x]) {
          out.push({ x, y, kind: "scanned" });
        }
      }
    }
    return out;
  }

  if (strategy.mode === "scan_column_active") {
    const column = tick % next.width;
    const out: Array<{ x: number; y: number; kind: CellTriggerKind }> = [];
    for (let y = 0; y < next.height; y += 1) {
      if (next.cells[y * next.width + column]) {
        out.push({ x: column, y, kind: "scanned" });
      }
    }
    return out;
  }

  if (strategy.mode === "whole_grid_transitions") {
    return [];
  }

  const row = tick % next.height;
  const out: Array<{ x: number; y: number; kind: CellTriggerKind }> = [];
  for (let x = 0; x < next.width; x += 1) {
    if (next.cells[row * next.width + x]) {
      out.push({ x, y: row, kind: "scanned" });
    }
  }
  return out;
}

function computeDegree(gridHeight: number, x: number, y: number, profile: InterpretationProfile): number {
  const rowFromBottom = Math.max(0, gridHeight - 1 - y);
  const xPart = axisValue(profile.x, x);
  const yPart = axisValue(profile.y, rowFromBottom);
  return xPart + yPart;
}

function axisValue(strategy: AxisStrategy, value: number): number {
  if (strategy.mode === "scale_step") {
    return value * Math.max(0, Math.floor(strategy.step));
  }
  return 0;
}

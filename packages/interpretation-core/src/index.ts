export type GridSnapshot = {
  width: number;
  height: number;
  cells: boolean[];
};

export type CellTransitionKind = "birth" | "death";
export type CellTriggerKind = CellTransitionKind | "state_on";

export type CellTransition = {
  x: number;
  y: number;
  kind: CellTransitionKind;
};

export type TickStrategy =
  | { mode: "whole_grid_transitions"; parity: "none" | "birth_even_death_odd" }
  | { mode: "whole_grid_active" }
  | { mode: "scan_column_active" }
  | { mode: "scan_row_active" };

export type AxisStrategy =
  | { mode: "scale_step"; step: number }
  | { mode: "timing_only" }
  | { mode: "ignore" };

export type InterpretationProfile = {
  id: string;
  event: { enabled: boolean; parity: "none" | "birth_even_death_odd" };
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

export const PROFILE_LIFE_DEFAULT: InterpretationProfile = {
  id: "life_default",
  event: { enabled: true, parity: "birth_even_death_odd" },
  state: { enabled: false, tick: { mode: "scan_column_active" } },
  x: { mode: "scale_step", step: 1 },
  y: { mode: "scale_step", step: 3 }
};

export const PROFILE_COLUMN_SEQUENCER_BASIC: InterpretationProfile = {
  id: "column_sequencer_basic",
  event: { enabled: true, parity: "none" },
  state: { enabled: true, tick: { mode: "scan_column_active" } },
  x: { mode: "timing_only" },
  y: { mode: "scale_step", step: 1 }
};

export const INTERPRETATION_PROFILES: InterpretationProfile[] = [
  PROFILE_LIFE_DEFAULT,
  PROFILE_COLUMN_SEQUENCER_BASIC
];

export function extractBirthDeathTransitions(previous: GridSnapshot, next: GridSnapshot): CellTransition[] {
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
    transitions.push({ x, y, kind: after ? "birth" : "death" });
  }
  return transitions;
}

export function interpretTransitions(
  previous: GridSnapshot,
  next: GridSnapshot,
  tick: number,
  mode: "birth_death" | "birth_death_parity" = "birth_death_parity"
): CellTransition[] {
  const transitions = extractBirthDeathTransitions(previous, next);
  if (mode === "birth_death") {
    return transitions;
  }
  return applyBirthDeathParityGating(transitions, tick);
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

export function applyBirthDeathParityGating(transitions: CellTransition[], tick: number): CellTransition[] {
  const evenTick = tick % 2 === 0;
  if (evenTick) {
    return transitions.filter((transition) => transition.kind === "birth");
  }
  return transitions.filter((transition) => transition.kind === "death");
}

function selectEventCandidates(
  previous: GridSnapshot,
  next: GridSnapshot,
  tick: number,
  parity: "none" | "birth_even_death_odd"
): Array<{ x: number; y: number; kind: CellTriggerKind }> {
  const transitions = extractBirthDeathTransitions(previous, next);
  if (parity === "birth_even_death_odd") {
    return applyBirthDeathParityGating(transitions, tick);
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
          out.push({ x, y, kind: "state_on" });
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
        out.push({ x: column, y, kind: "state_on" });
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
      out.push({ x, y: row, kind: "state_on" });
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

export type GridSnapshot = {
  width: number;
  height: number;
  cells: boolean[];
};

export type CellTransitionKind = "birth" | "death";

export type CellTransition = {
  x: number;
  y: number;
  kind: CellTransitionKind;
};

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

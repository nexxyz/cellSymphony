export type GridCell = { x: number; y: number };

export type GridDomain = {
  width: number;
  height: number;
  toLogicalCell(inputCell: GridCell): GridCell;
  toDisplayCell(logicalCell: GridCell): GridCell;
  indexOf(logicalCell: GridCell): number;
  cellOf(index: number): GridCell;
  toLogicalIndex(inputCell: GridCell): number;
  toDisplayIndex(logicalCell: GridCell): number;
  displayCellOf(index: number): GridCell;
  get(cells: boolean[], logicalCell: GridCell): boolean;
  set(cells: boolean[], logicalCell: GridCell, value: boolean): boolean[];
  toggle(cells: boolean[], logicalCell: GridCell): boolean[];
};

export function createGridDomain(width: number, height: number): GridDomain {
  const clampX = (x: number) => clampInt(x, 0, width - 1);
  const clampY = (y: number) => clampInt(y, 0, height - 1);

  const toLogicalCell = (inputCell: GridCell): GridCell => ({
    x: clampX(inputCell.x),
    y: clampY((height - 1) - inputCell.y)
  });

  const toDisplayCell = (logicalCell: GridCell): GridCell => ({
    x: clampX(logicalCell.x),
    y: clampY((height - 1) - logicalCell.y)
  });

  const indexOf = (logicalCell: GridCell): number => clampY(logicalCell.y) * width + clampX(logicalCell.x);

  const cellOf = (index: number): GridCell => {
    const i = clampInt(index, 0, width * height - 1);
    return { x: i % width, y: Math.floor(i / width) };
  };

  const toLogicalIndex = (inputCell: GridCell): number => indexOf(toLogicalCell(inputCell));

  const toDisplayIndex = (logicalCell: GridCell): number => {
    const display = toDisplayCell(logicalCell);
    return display.y * width + display.x;
  };

  const displayCellOf = (index: number): GridCell => toDisplayCell(cellOf(index));

  const get = (cells: boolean[], logicalCell: GridCell): boolean => !!cells[indexOf(logicalCell)];

  const set = (cells: boolean[], logicalCell: GridCell, value: boolean): boolean[] => {
    const idx = indexOf(logicalCell);
    const next = cells.slice();
    next[idx] = value;
    return next;
  };

  const toggle = (cells: boolean[], logicalCell: GridCell): boolean[] => {
    const idx = indexOf(logicalCell);
    const next = cells.slice();
    next[idx] = !next[idx];
    return next;
  };

  return { width, height, toLogicalCell, toDisplayCell, indexOf, cellOf, toLogicalIndex, toDisplayIndex, displayCellOf, get, set, toggle };
}

function clampInt(value: number, min: number, max: number): number {
  const n = Math.floor(value);
  return Math.max(min, Math.min(max, n));
}

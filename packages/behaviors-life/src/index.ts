import type { BehaviorEngine } from "@cellsymphony/behavior-api";
import { GRID_HEIGHT, GRID_WIDTH, type DeviceInput } from "@cellsymphony/device-contracts";

export type LifeState = {
  width: typeof GRID_WIDTH;
  height: typeof GRID_HEIGHT;
  cells: boolean[];
  generation: number;
};

export type LifeConfig = {
  width?: typeof GRID_WIDTH;
  height?: typeof GRID_HEIGHT;
};

export const lifeBehavior: BehaviorEngine<LifeState, LifeConfig> = {
  id: "life",
  init(): LifeState {
    return {
      width: GRID_WIDTH,
      height: GRID_HEIGHT,
      cells: new Array(GRID_WIDTH * GRID_HEIGHT).fill(false),
      generation: 0
    };
  },
  onInput(state, input: DeviceInput) {
    if (input.type !== "grid_press") {
      return state;
    }
    if (input.x < 0 || input.x >= GRID_WIDTH || input.y < 0 || input.y >= GRID_HEIGHT) {
      return state;
    }
    const i = input.y * GRID_WIDTH + input.x;
    const nextCells = state.cells.slice();
    nextCells[i] = !nextCells[i];
    return {
      ...state,
      cells: nextCells
    };
  },
  onTick(state, context) {
    const nextCells = state.cells.slice();
    let aliveCount = 0;
    for (let y = 0; y < GRID_HEIGHT; y += 1) {
      for (let x = 0; x < GRID_WIDTH; x += 1) {
        const i = y * GRID_WIDTH + x;
        const alive = state.cells[i];
        const neighbors = countNeighbors(state.cells, x, y);
        nextCells[i] = alive ? neighbors === 2 || neighbors === 3 : neighbors === 3;
        if (nextCells[i]) {
          aliveCount += 1;
        }
      }
    }
    if (aliveCount > 0 && aliveCount % 12 === 0) {
      context.emit({ type: "note_on", channel: 0, note: 60 + (aliveCount % 12), velocity: 90, durationMs: 120 });
    }
    return {
      ...state,
      cells: nextCells,
      generation: state.generation + 1
    };
  },
  renderModel(state) {
    return {
      name: "Game of Life",
      statusLine: `Gen ${state.generation}`,
      cells: state.cells
    };
  },
  serialize(state) {
    return state;
  },
  deserialize(data) {
    const parsed = data as LifeState;
    return parsed;
  }
};

function countNeighbors(cells: boolean[], x: number, y: number): number {
  let count = 0;
  for (let oy = -1; oy <= 1; oy += 1) {
    for (let ox = -1; ox <= 1; ox += 1) {
      if (ox === 0 && oy === 0) {
        continue;
      }
      const nx = x + ox;
      const ny = y + oy;
      if (nx < 0 || nx >= GRID_WIDTH || ny < 0 || ny >= GRID_HEIGHT) {
        continue;
      }
      if (cells[ny * GRID_WIDTH + nx]) {
        count += 1;
      }
    }
  }
  return count;
}

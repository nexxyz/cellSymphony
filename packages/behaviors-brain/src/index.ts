import type { BehaviorEngine, CellTriggerType } from "@cellsymphony/behavior-api";
import { GRID_HEIGHT, GRID_WIDTH, type DeviceInput } from "@cellsymphony/device-contracts";

const CELL_COUNT = GRID_WIDTH * GRID_HEIGHT;

export type BrainState = {
  cells: number[];
  generation: number;
  triggerTypes: CellTriggerType[];
  fireThreshold: number;
  randomSeedCells: number;
  tickCounter: number;
};

export type BrainConfig = {
  fireThreshold?: number;
  randomSeedCells?: number;
};

function idx(x: number, y: number): number {
  return y * GRID_WIDTH + x;
}

function aliveNeighbors(cells: number[], x: number, y: number): number {
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (cells[idx((x + dx + GRID_WIDTH) % GRID_WIDTH, (y + dy + GRID_HEIGHT) % GRID_HEIGHT)] === 1) n++;
    }
  }
  return n;
}

export const brainBehavior: BehaviorEngine<BrainState, BrainConfig> = {
  id: "brain",
  init(config) {
    return {
      cells: new Array(CELL_COUNT).fill(0),
      generation: 0,
      triggerTypes: new Array(CELL_COUNT).fill("none") as CellTriggerType[],
      fireThreshold: config.fireThreshold ?? 2,
      randomSeedCells: config.randomSeedCells ?? 0,
      tickCounter: 0,
    };
  },
  onInput(state, input: DeviceInput) {
    if (input.type === "behavior_action" && input.actionType === "seedRandom") {
      const cells = state.cells.slice();
      const tt = state.triggerTypes.slice();
      for (let r = 0; r < 5; r++) {
        const rx = Math.floor(Math.random() * GRID_WIDTH);
        const ry = Math.floor(Math.random() * GRID_HEIGHT);
        const ri = idx(rx, ry);
        if (cells[ri] === 0) {
          cells[ri] = 1;
          tt[ri] = "activate";
        }
      }
      return { ...state, cells, triggerTypes: tt };
    }
    if (input.type !== "grid_press") return state;
    const i = idx(input.x, input.y);
    const next = state.cells.slice();
    next[i] = next[i] === 0 ? 1 : 0;
    return { ...state, cells: next };
  },
  onTick(state) {
    const next = new Array<number>(CELL_COUNT);
    const tt = new Array<CellTriggerType>(CELL_COUNT).fill("none");
    const tickCounter = state.tickCounter + 1;
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const i = idx(x, y);
        const c = state.cells[i];
        const n = aliveNeighbors(state.cells, x, y);
        if (c === 0) {
          if (n === state.fireThreshold) {
            next[i] = 1;
            tt[i] = "activate";
          } else {
            next[i] = 0;
          }
        } else if (c === 1) {
          next[i] = 2;
          tt[i] = "deactivate";
        } else {
          next[i] = 0;
        }
      }
    }

    if (state.randomSeedCells > 0) {
      for (let r = 0; r < state.randomSeedCells; r += 1) {
        const rx = Math.floor(Math.random() * GRID_WIDTH);
        const ry = Math.floor(Math.random() * GRID_HEIGHT);
        const ri = idx(rx, ry);
        if (next[ri] === 0) {
          next[ri] = 1;
          tt[ri] = "activate";
        }
      }
    }

    return { cells: next, generation: state.generation + 1, triggerTypes: tt, fireThreshold: state.fireThreshold, randomSeedCells: state.randomSeedCells, tickCounter };
  },
  renderModel(state) {
    return {
      name: "Brain",
      statusLine: `Gen ${state.generation}`,
      cells: state.cells.map(c => c === 1),
      triggerTypes: state.triggerTypes,
    };
  },
  configMenu() {
    return [
      { key: "fireThreshold", label: "Fire Threshold", type: "number", min: 1, max: 4, step: 1 },
      { key: "randomSeedCells", label: "Spawn Count", type: "number", min: 0, max: 20, step: 1 },
      { key: "seedRandom", label: "Seed Random", type: "action" },
    ];
  },
  serialize(state) { return state; },
  deserialize(data) { return data as BrainState; },
};

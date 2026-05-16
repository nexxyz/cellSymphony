import type { BehaviorEngine, CellTriggerType } from "@cellsymphony/behavior-api";
import { GRID_HEIGHT, GRID_WIDTH, type DeviceInput } from "@cellsymphony/device-contracts";

const CELL_COUNT = GRID_WIDTH * GRID_HEIGHT;

export type BounceState = {
  balls: Array<{ x: number; y: number; vx: number; vy: number }>;
  cells: boolean[];
  triggerTypes: CellTriggerType[];
  maxBalls: number;
};

export type BounceConfig = {
  maxBalls?: number;
};

function idx(x: number, y: number): number {
  return y * GRID_WIDTH + x;
}

export const bounceBehavior: BehaviorEngine<BounceState, BounceConfig> = {
  id: "bounce",
  init(config) {
    return {
      balls: [],
      cells: new Array(CELL_COUNT).fill(false),
      triggerTypes: new Array(CELL_COUNT).fill("none") as CellTriggerType[],
      maxBalls: config.maxBalls ?? 60,
    };
  },
  onInput(state, input: DeviceInput) {
    if (input.type === "behavior_action" && input.actionType === "addBall") {
      if (state.balls.length >= state.maxBalls) return state;
      return {
        ...state,
        balls: [...state.balls, {
          x: Math.floor(Math.random() * GRID_WIDTH),
          y: Math.floor(Math.random() * GRID_HEIGHT),
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
        }],
      };
    }
    if (input.type !== "grid_press") return state;
    if (state.balls.length >= state.maxBalls) return state;
    return {
      ...state,
      balls: [...state.balls, {
        x: input.x,
        y: input.y,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
      }],
    };
  },
  onTick(state) {
    const balls = state.balls.map(b => {
      let x = b.x + b.vx;
      let y = b.y + b.vy;
      let vx = b.vx;
      let vy = b.vy;
      if (x < 0) { x = -x; vx = -vx; }
      if (x >= GRID_WIDTH) { x = 2 * (GRID_WIDTH - 1) - x; vx = -vx; }
      if (y < 0) { y = -y; vy = -vy; }
      if (y >= GRID_HEIGHT) { y = 2 * (GRID_HEIGHT - 1) - y; vy = -vy; }
      return { x, y, vx, vy };
    });
    const cells = new Array<boolean>(CELL_COUNT).fill(false);
    for (const b of balls) {
      const cx = Math.min(GRID_WIDTH - 1, Math.max(0, Math.round(b.x)));
      const cy = Math.min(GRID_HEIGHT - 1, Math.max(0, Math.round(b.y)));
      cells[idx(cx, cy)] = true;
    }
    const tt = new Array<CellTriggerType>(CELL_COUNT).fill("none");
    for (let i = 0; i < CELL_COUNT; i++) {
      if (cells[i] && state.cells[i]) tt[i] = "stable";
      else if (cells[i]) tt[i] = "activate";
      else if (state.cells[i]) tt[i] = "deactivate";
    }
    return { balls, cells, triggerTypes: tt, maxBalls: state.maxBalls };
  },
  renderModel(state) {
    return {
      name: "Bounce",
      statusLine: `${state.balls.length} ball${state.balls.length !== 1 ? "s" : ""}`,
      cells: state.cells,
      triggerTypes: state.triggerTypes,
    };
  },
  configMenu() {
    return [
      { key: "maxBalls", label: "Max Balls", type: "number", min: 1, max: 100, step: 1 },
      { key: "addBall", label: "Add Ball", type: "action" },
    ];
  },
  serialize(state) { return state; },
  deserialize(data) { return data as BounceState; },
};

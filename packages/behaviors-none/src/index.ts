import type { BehaviorEngine } from "@cellsymphony/behavior-api";
import { GRID_DOMAIN, GRID_HEIGHT, GRID_WIDTH, type DeviceInput } from "@cellsymphony/device-contracts";

export type NoneState = {
  cells: boolean[];
};

const CELL_COUNT = GRID_WIDTH * GRID_HEIGHT;

export const noneBehavior: BehaviorEngine<NoneState, {}> = {
  id: "none",
  init() {
    return {
      cells: new Array(CELL_COUNT).fill(false)
    };
  },
  onInput(state, _input: DeviceInput) {
    return state;
  },
  onTick(state) {
    return state;
  },
  renderModel() {
    return {
      name: "none",
      statusLine: "Idle",
      cells: new Array(CELL_COUNT).fill(false)
    };
  },
  serialize(state) {
    return state;
  },
  deserialize(data) {
    return data as NoneState;
  }
};

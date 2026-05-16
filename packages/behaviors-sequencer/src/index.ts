import type { BehaviorEngine } from "@cellsymphony/behavior-api";
import { GRID_HEIGHT, GRID_WIDTH, type DeviceInput } from "@cellsymphony/device-contracts";

export type SequencerState = {
  width: typeof GRID_WIDTH;
  height: typeof GRID_HEIGHT;
  cells: boolean[];
};

export const sequencerBehavior: BehaviorEngine<SequencerState, {}> = {
  id: "sequencer",
  init() {
    return {
      width: GRID_WIDTH,
      height: GRID_HEIGHT,
      cells: new Array(GRID_WIDTH * GRID_HEIGHT).fill(false)
    };
  },
  onInput(state, input: DeviceInput) {
    if (input.type !== "grid_press") return state;
    const i = input.y * GRID_WIDTH + input.x;
    const nextCells = state.cells.slice();
    nextCells[i] = !nextCells[i];
    return { ...state, cells: nextCells };
  },
  onTick(state) {
    return state;
  },
  renderModel(state) {
    return {
      name: "Sequencer",
      statusLine: "Manual",
      cells: state.cells
    };
  },
  serialize(state) {
    return state;
  },
  deserialize(data) {
    return data as SequencerState;
  }
};

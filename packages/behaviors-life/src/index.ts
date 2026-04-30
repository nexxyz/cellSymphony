import type { BehaviorEngine } from "@cellsymphony/behavior-api";

export type LifeState = {
  width: 16;
  height: 16;
  cells: boolean[];
  generation: number;
};

export type LifeConfig = {
  width?: 16;
  height?: 16;
};

export const lifeBehavior: BehaviorEngine<LifeState, LifeConfig> = {
  id: "life",
  init(): LifeState {
    return {
      width: 16,
      height: 16,
      cells: new Array(16 * 16).fill(false),
      generation: 0
    };
  },
  onInput(state) {
    return state;
  },
  onTick(state) {
    return {
      ...state,
      generation: state.generation + 1
    };
  },
  renderModel(state) {
    return {
      name: "Game of Life",
      statusLine: `Gen ${state.generation}`
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

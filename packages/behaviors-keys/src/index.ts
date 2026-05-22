import type { BehaviorEngine, CellTriggerType } from "@cellsymphony/behavior-api";
import { GRID_DOMAIN, GRID_HEIGHT, GRID_WIDTH, type DeviceInput } from "@cellsymphony/device-contracts";

export type KeysConfig = {
  quantize?: "immediate" | "step";
};

export type KeysState = {
  cells: boolean[];
  triggerTypes: CellTriggerType[];
  heldCells: boolean[];
  quantize: "immediate" | "step";
};

const CELL_COUNT = GRID_WIDTH * GRID_HEIGHT;

function cellIndex(x: number, y: number): number {
  return GRID_DOMAIN.indexOf({ x, y });
}

export const keysBehavior: BehaviorEngine<KeysState, KeysConfig> = {
  id: "keys",
  interpretInputTransitions: true,

  init(config): KeysState {
    return {
      cells: new Array(CELL_COUNT).fill(false),
      triggerTypes: new Array(CELL_COUNT).fill("none"),
      heldCells: new Array(CELL_COUNT).fill(false),
      quantize: config.quantize ?? "immediate"
    };
  },

  onInput(state, input: DeviceInput) {
    if (input.type !== "grid_press" && input.type !== "grid_release") {
      return state;
    }

    if (input.x < 0 || input.x >= GRID_WIDTH || input.y < 0 || input.y >= GRID_HEIGHT) {
      return state;
    }

    const idx = cellIndex(input.x, input.y);
    const isPress = input.type === "grid_press";

    if (state.quantize === "immediate") {
      const cells = state.cells.slice();
      const triggerTypes = new Array<CellTriggerType>(CELL_COUNT).fill("none");

      if (isPress) {
        cells[idx] = true;
        triggerTypes[idx] = "activate";
      } else {
        cells[idx] = false;
        triggerTypes[idx] = "deactivate";
      }

      const heldCells = state.heldCells.slice();
      heldCells[idx] = isPress;

      return { ...state, cells, triggerTypes, heldCells };
    }

    const heldCells = state.heldCells.slice();
    heldCells[idx] = isPress;
    return { ...state, heldCells };
  },

  onTick(state) {
    if (state.quantize === "immediate") {
      const triggerTypes = new Array<CellTriggerType>(CELL_COUNT).fill("none");
      for (let i = 0; i < CELL_COUNT; i += 1) {
        triggerTypes[i] = state.cells[i] ? "stable" : "none";
      }
      return { ...state, triggerTypes };
    }

    const cells = state.cells.slice();
    const triggerTypes = new Array<CellTriggerType>(CELL_COUNT).fill("none");

    for (let i = 0; i < CELL_COUNT; i += 1) {
      const held = state.heldCells[i];
      const alive = state.cells[i];

      if (held && !alive) {
        cells[i] = true;
        triggerTypes[i] = "activate";
      } else if (!held && alive) {
        cells[i] = false;
        triggerTypes[i] = "deactivate";
      } else if (held && alive) {
        triggerTypes[i] = "stable";
      }
    }

    return { ...state, cells, triggerTypes };
  },

  renderModel(state) {
    return {
      name: "Keys",
      statusLine: state.quantize === "immediate" ? "Immediate" : "Quantized",
      cells: state.cells,
      triggerTypes: state.triggerTypes
    };
  },

  configMenu() {
    return [
      { key: "quantize", label: "Quantize", type: "enum", options: ["immediate", "step"] }
    ];
  },

  serialize(state) {
    return state;
  },

  deserialize(data) {
    return data as KeysState;
  }
};

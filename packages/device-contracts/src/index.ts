export type DeviceInput =
  | { type: "encoder_turn"; delta: -1 | 1 }
  | { type: "encoder_press" }
  | { type: "button_a" }
  | { type: "button_s" }
  | { type: "grid_press"; x: number; y: number };

export type DisplayFrame = {
  page: string;
  title: string;
  lines: string[];
};

export type LedCell = { r: number; g: number; b: number };
export type LedMatrixFrame = {
  width: 16;
  height: 16;
  cells: LedCell[];
};

export type TransportFrame = {
  playing: boolean;
  bpm: number;
  tick: number;
};

export type EngineFrame = {
  activeBehavior: string;
  cpuHintPercent: number;
};

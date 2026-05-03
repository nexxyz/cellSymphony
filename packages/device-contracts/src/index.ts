export type DeviceInput =
  | { type: "encoder_turn"; delta: -1 | 1; id?: "main" | "aux1" | "aux2" | "aux3" | "aux4" }
  | { type: "encoder_press"; id?: "main" | "aux1" | "aux2" | "aux3" | "aux4" }
  | { type: "button_a" }
  | { type: "button_s" }
  | { type: "button_shift" }
  | { type: "button_fn" }
  | { type: "grid_press"; x: number; y: number };

export const PAGES = ["Transport", "Rule", "Mapping", "Sound", "Samples", "Project"] as const;
export type PageId = (typeof PAGES)[number];

export type DisplayFrame = {
  page: PageId;
  title: string;
  lines: string[];
  editing: boolean;
};

export type LedCell = { r: number; g: number; b: number };
export const GRID_WIDTH = 8 as const;
export const GRID_HEIGHT = 8 as const;
export type LedMatrixFrame = {
  width: typeof GRID_WIDTH;
  height: typeof GRID_HEIGHT;
  cells: LedCell[];
};

export type TransportFrame = {
  playing: boolean;
  bpm: number;
  tick: number;
  ppqnPulse: number;
};

export type EngineFrame = {
  activeBehavior: string;
  cpuHintPercent: number;
};

export type SimulatorFrame = {
  display: DisplayFrame;
  leds: LedMatrixFrame;
  transport: TransportFrame;
  activeBehavior: string;
};

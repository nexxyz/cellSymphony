import type { SimulatorFrame } from "@cellsymphony/device-contracts";
import type { MusicalEvent } from "@cellsymphony/musical-events";

export type InputAction =
  | { type: "device_input"; input: import("@cellsymphony/device-contracts").DeviceInput }
  | { type: "emergency_brake" }
  | { type: "shift"; active: boolean };

export type TransportIndicator = {
  icon: "play" | "pause" | "stop";
  flash: "none" | "beat" | "measure";
  eventBlipUntilMs: number;
};

export type NeoKeyLeds = {
  back: "off" | "solid_red";
  space: "off" | "beat" | "measure";
  shift: "off" | "solid_yellow";
  fn: "off";
};

export type SimulatorSnapshot = {
  frame: SimulatorFrame;
  oledLines: string[];
  transportIndicator: TransportIndicator;
  neoKeyLeds: NeoKeyLeds;
  displayBrightness: number;
  buttonBrightness: number;
  masterVolume: number;
};

export type RuntimeListener = (snapshot: SimulatorSnapshot) => void;
export type EventsListener = (events: MusicalEvent[]) => void;

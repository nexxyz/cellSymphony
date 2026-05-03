import type { SimulatorFrame } from "@cellsymphony/device-contracts";
import type { MusicalEvent } from "@cellsymphony/musical-events";

export type InputAction =
  | { type: "device_input"; input: import("@cellsymphony/device-contracts").DeviceInput }
  | { type: "emergency_brake" };

export type TransportIndicator = {
  icon: "play" | "stop";
  flash: "none" | "beat" | "measure";
  eventBlipUntilMs: number;
};

export type NeoKeyLeds = {
  back: "off" | "solid_red";
  space: "off" | "beat" | "measure";
  shift: "off";
  fn: "off";
};

export type SimulatorSnapshot = {
  frame: SimulatorFrame;
  oledLines: string[];
  transportIndicator: TransportIndicator;
  neoKeyLeds: NeoKeyLeds;
};

export type RuntimeListener = (snapshot: SimulatorSnapshot) => void;
export type EventsListener = (events: MusicalEvent[]) => void;

import type { SimulatorFrame } from "@cellsymphony/device-contracts";
import type { MusicalEvent } from "@cellsymphony/musical-events";

export type SimulatorSnapshot = {
  frame: SimulatorFrame;
  oledLines: string[];
};

export type RuntimeListener = (snapshot: SimulatorSnapshot) => void;
export type EventsListener = (events: MusicalEvent[]) => void;

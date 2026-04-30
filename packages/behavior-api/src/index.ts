import type { DeviceInput } from "@cellsymphony/device-contracts";
import type { MusicalEvent } from "@cellsymphony/musical-events";

export type BehaviorContext = {
  bpm: number;
  emit: (event: MusicalEvent) => void;
};

export type BehaviorRenderModel = {
  name: string;
  statusLine: string;
};

export interface BehaviorEngine<State, Config> {
  id: string;
  init(config: Config): State;
  onInput(state: State, input: DeviceInput, context: BehaviorContext): State;
  onTick(state: State, context: BehaviorContext): State;
  renderModel(state: State): BehaviorRenderModel;
  serialize(state: State): unknown;
  deserialize(data: unknown): State;
}

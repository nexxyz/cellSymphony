import { GRID_HEIGHT, GRID_WIDTH } from "@cellsymphony/device-contracts";
import type { MusicalEvent } from "@cellsymphony/musical-events";
import type { PlatformState } from "./platformTypes";
import { PLATFORM_CAPS, clampPartIndex } from "./platformCaps";

export function emergencyBrakeState<TState>(state: PlatformState<TState>): { state: PlatformState<TState>; events: MusicalEvent[] } {
  const activePart = clampPartIndex((state.runtimeConfig as any).activePartIndex ?? 0);
  const activePartCfg = (state.runtimeConfig as any).parts?.[activePart]?.l2;
  const axis = activePartCfg?.scanAxis ?? state.runtimeConfig.scanAxis;
  const direction = activePartCfg?.scanDirection ?? state.runtimeConfig.scanDirection;
  const size = axis === "columns" ? GRID_WIDTH : GRID_HEIGHT;
  const origin = direction === "forward" ? 0 : size - 1;
  const events: MusicalEvent[] = [];
  for (let channel = 0; channel < 16; channel += 1) {
    events.push({ type: "cc", channel, controller: 120, value: 0 });
    events.push({ type: "cc", channel, controller: 123, value: 0 });
  }
  return {
    state: {
      ...state,
      transport: { ...state.transport, playing: false, ppqnPulse: 0 },
      system: { ...state.system, stopLatched: true, transportFlash: "none", transportFlashUntilMs: 0, heldNotes: [] },
      scanIndex: origin,
      scanPulseAccumulator: 0,
      algorithmPulseAccumulator: 0,
      ppqnPulseRemainder: 0,
      partScanIndex: Array.from({ length: PLATFORM_CAPS.partCount }, () => 0),
      partScanPulseAccumulator: Array.from({ length: PLATFORM_CAPS.partCount }, () => 0),
      partAlgorithmPulseAccumulator: Array.from({ length: PLATFORM_CAPS.partCount }, () => 0)
    },
    events
  };
}

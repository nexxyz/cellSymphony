import { PLATFORM_CAPS } from "./platformCaps";
import type { MomentaryFxTarget } from "./platformTypes";

export function targetFromKey(key: string): MomentaryFxTarget {
  const k = String(key ?? "master");
  if (k === "master") return { type: "global" };
  const bus = /^fx_bus_(\d+)$/.exec(k);
  if (bus) {
    const idx = Math.max(0, Math.min(PLATFORM_CAPS.busCount - 1, Number(bus[1]) - 1));
    return { type: "fx_bus", index: idx };
  }
  const inst = /^instrument_(\d+)$/.exec(k);
  if (inst) {
    const idx = Math.max(0, Math.min(PLATFORM_CAPS.instrumentCount - 1, Number(inst[1]) - 1));
    return { type: "instrument", index: idx };
  }
  return { type: "global" };
}

import type { BehaviorEngine } from "@cellsymphony/behavior-api";
import { GRID_HEIGHT, GRID_WIDTH, type DisplayFrame, type SimulatorFrame } from "@cellsymphony/device-contracts";
import type { PlatformState } from "./platformTypes";
import { cellsToLeds, sampleAssignmentToLeds } from "./runtimeHelpers";
import { renderOledFrame } from "./oledRender";
import { logoSepia128Rgb565be } from "./oledAssets/logoSepia128_rgb565be";
import { logo128Rgb565be } from "./oledAssets/logo128_rgb565be";

type OledLines = { lines: string[]; colors: number[] };

type Args<TState> = {
  state: PlatformState<TState>;
  activePart: number;
  engine: BehaviorEngine<any, unknown>;
  model: { name: string; cells: boolean[]; triggerTypes?: import("@cellsymphony/behavior-api").CellTriggerType[] };
  menuView: { path: string; lines: string[]; colors: number[] };
  scanCursor: { axis: "rows" | "columns"; index: number } | null;
  toOledLines: (display: DisplayFrame) => OledLines;
};

export function buildSimulatorFrame<TState>(args: Args<TState>): SimulatorFrame {
  const { state, activePart, model, menuView, scanCursor, toOledLines } = args;
  const baseDisplay: DisplayFrame = {
    page: menuView.path,
    title: menuView.path,
    editing: state.menu.editing,
    lines: menuView.lines,
    colors: menuView.colors
  };
  const oledLines = toOledLines(baseDisplay);
  const now = Date.now();
  const toast = state.system.toast && state.system.toast.untilMs > now ? state.system.toast.message : null;
  const transportIcon: "play" | "pause" | "stop" = state.transport.playing ? "play" : state.system.stopLatched ? "stop" : "pause";
  const oled = renderOledFrame({
    lines: oledLines.lines,
    off: state.system.oledMode === "off",
    splash:
      state.system.oledMode === "splash"
        ? state.system.oledSplashText === "Starting up"
          ? { pixelsRgb565be: logo128Rgb565be, topText: "", bottomText: "Starting up" }
          : { pixelsRgb565be: logoSepia128Rgb565be, topText: state.system.oledSplashText, bottomText: null }
        : undefined,
    transportIcon,
    transportFlash: state.system.transportFlash,
    eventDotOn: state.system.eventBlipUntilMs > now,
    toast,
    lineColors: oledLines.colors
  });
  const sampleAssign = state.system.sampleAssign;
  const assignLeds = (() => {
    if (!sampleAssign) return null;
    const inst = (state.runtimeConfig as any).instruments?.[sampleAssign.instrumentSlot];
    if (!inst || inst.type !== "sample") return null;
    const assignments = Array.isArray(inst.sample?.assignments) ? inst.sample.assignments : [];
    const levels = inst.sample?.velocityLevelsEnabled === true;
    return sampleAssignmentToLeds(assignments, sampleAssign.sampleSlot, levels, state.runtimeConfig.gridBrightness / 100);
  })();
  return {
    display: baseDisplay,
    oled,
    leds: {
      width: GRID_WIDTH,
      height: GRID_HEIGHT,
      cells: assignLeds ?? cellsToLeds(model.cells, model.triggerTypes, scanCursor, state.runtimeConfig.gridBrightness / 100, state.system.fnHeld, activePart)
    },
    transport: state.transport,
    activeBehavior: model.name
  };
}

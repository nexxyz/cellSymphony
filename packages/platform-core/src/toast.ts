import type { ToastState } from "./platformTypes";

type MakeToastOptions = {
  nowMs?: number;
  durationMs?: number;
  current?: ToastState | null;
  extend?: boolean;
};

export function makeToast(message: string, options: MakeToastOptions = {}): ToastState {
  const nowMs = options.nowMs ?? Date.now();
  const durationMs = options.durationMs ?? 1500;
  const current = options.current;
  const active = options.extend === true && current !== undefined && current !== null && current.untilMs > nowMs;
  if (!active) return { message, startedAtMs: nowMs, untilMs: nowMs + durationMs };

  const extendMs = 600;
  const maxMs = 3000;
  return {
    message,
    startedAtMs: current.startedAtMs,
    untilMs: Math.min(nowMs + maxMs, Math.max(nowMs + durationMs, current.untilMs + extendMs))
  };
}

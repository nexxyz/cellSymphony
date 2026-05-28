import type { ToastState } from "./platformTypes";
import { DEFAULT_TOAST_MS, TOAST_EXTEND_MS, TOAST_MAX_MS, deadlineMs, nowMs as runtimeNowMs } from "./timing";

type MakeToastOptions = {
  nowMs?: number;
  durationMs?: number;
  current?: ToastState | null;
  extend?: boolean;
};

export function makeToast(message: string, options: MakeToastOptions = {}): ToastState {
  const nowMs = options.nowMs ?? runtimeNowMs();
  const durationMs = options.durationMs ?? DEFAULT_TOAST_MS;
  const current = options.current;
  const active = options.extend === true && current !== undefined && current !== null && current.untilMs > nowMs;
  if (!active) return { message, startedAtMs: nowMs, untilMs: deadlineMs(nowMs, durationMs) };

  const extendMs = TOAST_EXTEND_MS;
  const maxMs = TOAST_MAX_MS;
  return {
    message,
    startedAtMs: current.startedAtMs,
    untilMs: Math.min(deadlineMs(nowMs, maxMs), Math.max(deadlineMs(nowMs, durationMs), deadlineMs(current.untilMs, extendMs)))
  };
}

export type NowMs = number;

export const EVENT_BLIP_MS = 100;
export const TRANSPORT_FLASH_MS = 220;
export const STARTUP_SPLASH_MS = 1000;
export const SLEEP_SPLASH_MS = 3000;
export const SAMPLE_ASSIGN_REPEAT_WINDOW_MS = 350;
export const AUX_MAPPING_OVERLAY_DELAY_MS = 2000;
export const DEFAULT_TOAST_MS = 1500;
export const TOAST_EXTEND_MS = 600;
export const TOAST_MAX_MS = 3000;

export function nowMs(): NowMs {
  return Date.now();
}

export function elapsedMs(now: NowMs, sinceMs: NowMs | null | undefined): number {
  if (sinceMs === null || sinceMs === undefined) return 0;
  return Math.max(0, now - sinceMs);
}

export function heldForMs(now: NowMs, sinceMs: NowMs | null | undefined, durationMs: number): boolean {
  return elapsedMs(now, sinceMs) >= Math.max(0, Math.floor(durationMs));
}

export function deadlineMs(now: NowMs, durationMs: number): NowMs {
  return now + Math.max(0, Math.floor(durationMs));
}

export function isActiveUntil(now: NowMs, untilMs: NowMs | null | undefined): boolean {
  return !isExpired(now, untilMs);
}

export function isExpired(now: NowMs, untilMs: NowMs | null | undefined): boolean {
  if (untilMs === null || untilMs === undefined) return true;
  return now >= untilMs;
}

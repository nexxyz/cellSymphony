export type RuntimeScheduler = {
  start(onTick: () => void): void;
  stop(): void;
};

export function createIntervalRuntimeScheduler(intervalMs: number): RuntimeScheduler {
  let timer: number | null = null;

  return {
    start(onTick) {
      if (timer !== null) return;
      timer = window.setInterval(onTick, intervalMs);
    },
    stop() {
      if (timer === null) return;
      window.clearInterval(timer);
      timer = null;
    }
  };
}

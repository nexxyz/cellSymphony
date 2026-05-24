export type AudioConfigPayload = { instruments: unknown[]; mixer: unknown; panPositions: number };

export function audioConfigSignature(config: AudioConfigPayload): string {
  return JSON.stringify(config);
}

export function createCoalescedAudioConfigSender(
  send: (config: AudioConfigPayload) => void | Promise<void>,
  delayMs = 16
) {
  let lastSignature = "";
  let pending: AudioConfigPayload | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function flush() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (!pending) return;
    const next = pending;
    pending = null;
    void send(next);
  }

  function schedule(config: AudioConfigPayload): boolean {
    const signature = audioConfigSignature(config);
    if (signature === lastSignature) return false;
    lastSignature = signature;
    pending = config;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(flush, delayMs);
    return true;
  }

  function cancel() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    pending = null;
  }

  return { schedule, flush, cancel };
}

import type { MusicalEvent } from "@cellsymphony/musical-events";

export interface NativeAudioBridge {
  trigger(event: MusicalEvent): Promise<void>;
}

class TauriNativeAudioBridge implements NativeAudioBridge {
  async trigger(event: MusicalEvent): Promise<void> {
    const isTauri = "__TAURI_INTERNALS__" in window;
    if (!isTauri) return;
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("trigger_musical_event", { event });
  }
}

export const nativeAudioBridge: NativeAudioBridge = new TauriNativeAudioBridge();

import type { MusicalEvent } from "@cellsymphony/musical-events";

export interface NativeAudioBridge {
  trigger(event: MusicalEvent): Promise<void>;
  setInstruments(instruments: unknown[]): Promise<void>;
}

class TauriNativeAudioBridge implements NativeAudioBridge {
  async trigger(event: MusicalEvent): Promise<void> {
    const isTauri = "__TAURI_INTERNALS__" in window;
    if (!isTauri) return;
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("trigger_musical_event", { event });
  }

  async setInstruments(instruments: unknown[]): Promise<void> {
    const isTauri = "__TAURI_INTERNALS__" in window;
    if (!isTauri) return;
    const { invoke } = await import("@tauri-apps/api/core");
    const payload = {
      instruments: (Array.isArray(instruments) ? instruments : []).map((i: any) => ({
        type: "synth",
        synth: i?.synth ?? i
      }))
    };
    await invoke("audio_set_instruments", { config: payload });
  }
}

export const nativeAudioBridge: NativeAudioBridge = new TauriNativeAudioBridge();

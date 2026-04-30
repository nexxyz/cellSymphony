import type { MusicalEvent } from "@cellsymphony/musical-events";

export interface NativeAudioBridge {
  trigger(event: MusicalEvent): Promise<void>;
}

class TauriNativeAudioBridge implements NativeAudioBridge {
  async trigger(event: MusicalEvent): Promise<void> {
    const invoker = (window as unknown as { __TAURI__?: { core?: { invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> } } }).__TAURI__;
    const invoke = invoker?.core?.invoke;
    if (invoke) {
      await invoke("trigger_musical_event", { event });
      return;
    }
    if (event.type === "note_on") {
      console.log(`[native-audio-stub] note_on ch=${event.channel} note=${event.note} vel=${event.velocity} dur=${event.durationMs ?? 0}`);
    }
  }
}

export const nativeAudioBridge: NativeAudioBridge = new TauriNativeAudioBridge();

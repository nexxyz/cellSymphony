import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type MidiPortInfo = { id: string; name: string };

type MidiInPayload = { bytes: number[] };

export class TauriMidiService {
  async listOutputs(): Promise<MidiPortInfo[]> {
    return (await invoke("midi_list_outputs")) as MidiPortInfo[];
  }

  async listInputs(): Promise<MidiPortInfo[]> {
    return (await invoke("midi_list_inputs")) as MidiPortInfo[];
  }

  async selectOutput(id: string | null): Promise<{ ok: boolean; message?: string }> {
    try {
      await invoke("midi_select_output", { id });
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "midi select failed" };
    }
  }

  async selectInput(id: string | null): Promise<{ ok: boolean; message?: string }> {
    try {
      await invoke("midi_select_input", { id });
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "midi select failed" };
    }
  }

  async send(bytes: Uint8Array): Promise<void> {
    await invoke("midi_send", { bytes: Array.from(bytes) });
  }

  async listenMidiIn(handler: (bytes: Uint8Array) => void): Promise<() => void> {
    const unlisten = await listen<MidiInPayload>("midi_in", (evt) => {
      const raw = evt.payload?.bytes;
      if (!raw || raw.length === 0) return;
      handler(Uint8Array.from(raw));
    });
    return unlisten;
  }
}

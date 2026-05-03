import type { MusicalEvent } from "@cellsymphony/musical-events";
import { nativeAudioBridge } from "../../audio/nativeAudioBridge";

export async function sendEventsToAudio(events: MusicalEvent[]): Promise<void> {
  for (const event of events) {
    await nativeAudioBridge.trigger(event);
  }
}

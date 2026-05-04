import type { MusicalEvent } from "@cellsymphony/musical-events";
import { nativeAudioBridge } from "../../audio/nativeAudioBridge";

export async function sendEventsToAudio(events: MusicalEvent[], masterVolume: number): Promise<void> {
  const gain = Math.max(0, Math.min(100, masterVolume)) / 100;
  for (const event of events) {
    if (event.type === "note_on") {
      await nativeAudioBridge.trigger({ ...event, velocity: Math.max(1, Math.min(127, Math.round(event.velocity * gain))) });
      continue;
    }
    await nativeAudioBridge.trigger(event);
  }
}

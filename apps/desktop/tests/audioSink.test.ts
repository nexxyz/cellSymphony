import test from "node:test";
import assert from "node:assert/strict";
import { sendEventsToAudio } from "../src/runtime/outputAdapters/audioSink";
import { nativeAudioBridge } from "../src/audio/nativeAudioBridge";

test("scales and clamps note_on velocity by master volume", async () => {
  const calls: any[] = [];
  const original = nativeAudioBridge.trigger;
  nativeAudioBridge.trigger = async (event: any) => {
    calls.push(event);
  };
  try {
    await sendEventsToAudio([{ type: "note_on", channel: 0, note: 60, velocity: 120, durationMs: 100 } as any], 50);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].velocity, 60);
  } finally {
    nativeAudioBridge.trigger = original;
  }
});

test("master volume clamp preserves lower bound on note_on velocity", async () => {
  const calls: any[] = [];
  const original = nativeAudioBridge.trigger;
  nativeAudioBridge.trigger = async (event: any) => {
    calls.push(event);
  };
  try {
    await sendEventsToAudio([{ type: "note_on", channel: 0, note: 60, velocity: 1, durationMs: 100 } as any], -10);
    assert.equal(calls[0].velocity, 1);
  } finally {
    nativeAudioBridge.trigger = original;
  }
});

import test from "node:test";
import assert from "node:assert/strict";

import { loadDefaultMappingConfig, mapIntentsToMusicalEvents, type MappingConfig } from "../src/index";

test("mapIntentsToMusicalEvents maps scanned intents to scanned target", () => {
  const config = loadDefaultMappingConfig();
  const events = mapIntentsToMusicalEvents([{ x: 2, y: 3, degree: 5, kind: "scanned" }], config);

  assert.equal(events.length, 1);
  assert.equal(events[0].type, "note_on");
  if (events[0].type === "note_on") {
    assert.equal(events[0].channel, config.scanned.channel);
    assert.ok(events[0].note >= config.baseMidiNote);
  }
});

test("mapping config sanitizes out-of-range values", () => {
  const unsafe: MappingConfig = {
    baseMidiNote: -5,
    maxMidiNote: 999,
    rangeMode: "wrap",
    scale: [0, 2, 4, 7, 12],
    rowStepDegrees: -2,
    columnStepDegrees: 3.9,
    activate: { channel: 20, velocity: 200, durationMs: 999999 },
    deactivate: { channel: -1, velocity: 0, durationMs: 0 },
    stable: { channel: 2, velocity: 80, durationMs: 120 },
    scanned: { channel: 3, velocity: 80, durationMs: 120 }
  };

  const events = mapIntentsToMusicalEvents([{ x: 0, y: 0, degree: 300, kind: "activate" }], unsafe);
  assert.equal(events.length, 1);
  if (events[0].type === "note_on") {
    assert.ok(events[0].note >= 0 && events[0].note <= 127);
    assert.equal(events[0].channel, 15);
    assert.equal(events[0].velocity, 127);
    assert.equal(events[0].durationMs, 8000);
  }
});

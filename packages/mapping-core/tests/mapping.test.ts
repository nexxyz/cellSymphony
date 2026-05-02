import test from "node:test";
import assert from "node:assert/strict";

import { loadDefaultMappingConfig, mapIntentsToMusicalEvents, mapTransitionsToMusicalEvents, type MappingConfig } from "../src/index";

test("mapTransitionsToMusicalEvents maps birth/death to target channels", () => {
  const config = loadDefaultMappingConfig();
  const events = mapTransitionsToMusicalEvents(
    [
      { x: 0, y: 0, kind: "birth" },
      { x: 0, y: 1, kind: "death" }
    ],
    8,
    config
  );

  assert.equal(events.length, 2);
  assert.equal(events[0].type, "note_on");
  assert.equal(events[1].type, "note_on");
  if (events[0].type === "note_on" && events[1].type === "note_on") {
    assert.equal(events[0].channel, config.birth.channel);
    assert.equal(events[1].channel, config.death.channel);
  }
});

test("mapIntentsToMusicalEvents maps state intents to state target", () => {
  const config = loadDefaultMappingConfig();
  const events = mapIntentsToMusicalEvents([{ x: 2, y: 3, degree: 5, kind: "state_on" }], config);

  assert.equal(events.length, 1);
  assert.equal(events[0].type, "note_on");
  if (events[0].type === "note_on") {
    assert.equal(events[0].channel, config.state.channel);
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
    birth: { channel: 20, velocity: 200, durationMs: 999999 },
    death: { channel: -1, velocity: 0, durationMs: 0 },
    state: { channel: 1, velocity: 80, durationMs: 120 }
  };

  const events = mapIntentsToMusicalEvents([{ x: 0, y: 0, degree: 300, kind: "birth" }], unsafe);
  assert.equal(events.length, 1);
  if (events[0].type === "note_on") {
    assert.ok(events[0].note >= 0 && events[0].note <= 127);
    assert.equal(events[0].channel, 15);
    assert.equal(events[0].velocity, 127);
    assert.equal(events[0].durationMs, 8000);
  }
});

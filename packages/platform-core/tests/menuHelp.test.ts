import test from "node:test";
import assert from "node:assert/strict";
import { resolveMenuHelpEntry } from "../src/menuHelp";

test("menu help prefers exact key over wildcard matches", () => {
  const target = {
    path: "Menu > System > MIDI > Sync & Clock > Respond Start/Stop",
    key: "key:midi.respondToStartStop",
    kind: "bool",
    label: "Respond Start/Stop"
  };
  const entry = resolveMenuHelpEntry(target);
  assert.ok(entry);
  assert.equal(entry!.id, "midi_respond_start_stop");
});

test("menu help resolves dynamic MIDI output by wildcard key", () => {
  const target = {
    path: "Menu > System > MIDI > MIDI Out > Out Port",
    key: "action:midi_select_output:out-1",
    kind: "action",
    label: "Out Port"
  };
  const entry = resolveMenuHelpEntry(target);
  assert.ok(entry);
  assert.equal(entry!.id, "midi_out_dynamic");
});

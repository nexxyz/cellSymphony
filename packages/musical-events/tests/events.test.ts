import test from "node:test";
import assert from "node:assert/strict";

import { MUSICAL_EVENT_KINDS, isMusicalEventKind } from "../src/index";

test("MUSICAL_EVENT_KINDS lists supported events", () => {
  assert.deepEqual(MUSICAL_EVENT_KINDS, ["note_on", "note_off", "cc"]);
});

test("isMusicalEventKind recognizes supported values", () => {
  assert.equal(isMusicalEventKind("note_on"), true);
  assert.equal(isMusicalEventKind("cc"), true);
  assert.equal(isMusicalEventKind("sample_trigger"), false);
});

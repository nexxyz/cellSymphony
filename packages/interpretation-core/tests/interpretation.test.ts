import test from "node:test";
import assert from "node:assert/strict";

import {
  applyParityGating,
  extractTransitions,
  interpretGrid,
  type GridSnapshot
} from "../src/index";

test("extractTransitions detects activations and deactivations", () => {
  const previous: GridSnapshot = { width: 3, height: 2, cells: [false, true, false, true, false, false] };
  const next: GridSnapshot = { width: 3, height: 2, cells: [true, true, false, false, false, true] };

  const transitions = extractTransitions(previous, next);
  assert.equal(transitions.length, 3);
  assert.deepEqual(transitions, [
    { x: 0, y: 0, kind: "activate" },
    { x: 0, y: 1, kind: "deactivate" },
    { x: 2, y: 1, kind: "activate" }
  ]);
});

test("parity gating keeps activates on even ticks and deactivates on odd ticks", () => {
  const transitions = [
    { x: 0, y: 0, kind: "activate" as const },
    { x: 1, y: 0, kind: "deactivate" as const }
  ];

  assert.deepEqual(applyParityGating(transitions, 0), [{ x: 0, y: 0, kind: "activate" }]);
  assert.deepEqual(applyParityGating(transitions, 1), [{ x: 1, y: 0, kind: "deactivate" }]);
});

test("interpretGrid combines event and scan-row state intents with degrees", () => {
  const previous: GridSnapshot = { width: 3, height: 3, cells: [false, false, false, false, false, false, false, false, false] };
  const next: GridSnapshot = { width: 3, height: 3, cells: [false, false, false, true, true, false, false, false, false] };

  const intents = interpretGrid(previous, next, 1, {
    id: "combined",
    event: { enabled: true, parity: "none" },
    state: { enabled: true, tick: { mode: "scan_row_active" } },
    x: { mode: "scale_step", step: 2 },
    y: { mode: "scale_step", step: 3 }
  });

  assert.equal(intents.length, 4);
  const scanned = intents.filter((i) => i.kind === "scanned");
  assert.equal(scanned.length, 2);
  assert.ok(intents.every((i) => i.degree >= 0));
});

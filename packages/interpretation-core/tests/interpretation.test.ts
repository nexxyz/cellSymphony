import test from "node:test";
import assert from "node:assert/strict";

import {
  applyBirthDeathParityGating,
  extractBirthDeathTransitions,
  interpretGrid,
  interpretTransitions,
  type GridSnapshot
} from "../src/index";

test("extractBirthDeathTransitions detects births and deaths", () => {
  const previous: GridSnapshot = { width: 3, height: 2, cells: [false, true, false, true, false, false] };
  const next: GridSnapshot = { width: 3, height: 2, cells: [true, true, false, false, false, true] };

  const transitions = extractBirthDeathTransitions(previous, next);
  assert.equal(transitions.length, 3);
  assert.deepEqual(transitions, [
    { x: 0, y: 0, kind: "birth" },
    { x: 0, y: 1, kind: "death" },
    { x: 2, y: 1, kind: "birth" }
  ]);
});

test("parity gating keeps births on even ticks and deaths on odd ticks", () => {
  const transitions = [
    { x: 0, y: 0, kind: "birth" as const },
    { x: 1, y: 0, kind: "death" as const }
  ];

  assert.deepEqual(applyBirthDeathParityGating(transitions, 0), [{ x: 0, y: 0, kind: "birth" }]);
  assert.deepEqual(applyBirthDeathParityGating(transitions, 1), [{ x: 1, y: 0, kind: "death" }]);
});

test("interpretTransitions respects parity mode", () => {
  const previous: GridSnapshot = { width: 2, height: 1, cells: [false, true] };
  const next: GridSnapshot = { width: 2, height: 1, cells: [true, false] };

  const all = interpretTransitions(previous, next, 0, "birth_death");
  assert.equal(all.length, 2);

  const parity = interpretTransitions(previous, next, 1, "birth_death_parity");
  assert.deepEqual(parity, [{ x: 1, y: 0, kind: "death" }]);
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
  const stateOn = intents.filter((i) => i.kind === "state_on");
  assert.equal(stateOn.length, 2);
  assert.ok(intents.every((i) => i.degree >= 0));
});

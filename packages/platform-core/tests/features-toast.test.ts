import test from "node:test";
import assert from "node:assert/strict";
import { makeToast } from "../src/toast";

test("makeToast uses shared default duration", () => {
  const toast = makeToast("Hello", { nowMs: 1000 });

  assert.deepEqual(toast, { message: "Hello", startedAtMs: 1000, untilMs: 2500 });
});

test("makeToast supports explicit duration for exceptional toasts", () => {
  const toast = makeToast("Longer", { nowMs: 1000, durationMs: 3000 });

  assert.deepEqual(toast, { message: "Longer", startedAtMs: 1000, untilMs: 4000 });
});

test("makeToast extension preserves active toast start time", () => {
  const current = { message: "First", startedAtMs: 1000, untilMs: 2400 };
  const toast = makeToast("Second", { nowMs: 1600, current, extend: true });

  assert.equal(toast.message, "Second");
  assert.equal(toast.startedAtMs, 1000);
  assert.equal(toast.untilMs, 3100);
});

test("makeToast extension caps active toast lifetime", () => {
  const current = { message: "First", startedAtMs: 1000, untilMs: 7000 };
  const toast = makeToast("Second", { nowMs: 1600, current, extend: true });

  assert.equal(toast.startedAtMs, 1000);
  assert.equal(toast.untilMs, 4600);
});

test("makeToast extension creates fresh toast when current toast expired", () => {
  const current = { message: "First", startedAtMs: 1000, untilMs: 1500 };
  const toast = makeToast("Second", { nowMs: 1600, current, extend: true });

  assert.deepEqual(toast, { message: "Second", startedAtMs: 1600, untilMs: 3100 });
});

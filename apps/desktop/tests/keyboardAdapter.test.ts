import test from "node:test";
import assert from "node:assert/strict";
import { mapKeyboardEventToInputAction, mapKeyboardKeyupToInputAction, shouldPreventKeyboardDefault } from "../src/runtime/inputAdapters/keyboardAdapter";

function keyEvent(key: string, shiftKey = false): KeyboardEvent {
  return { key, shiftKey } as KeyboardEvent;
}

test("maps arrows and enter/backspace/esc/space", () => {
  assert.deepEqual(mapKeyboardEventToInputAction(keyEvent("ArrowLeft")), { type: "device_input", input: { type: "encoder_turn", delta: -1, id: "main" } });
  assert.deepEqual(mapKeyboardEventToInputAction(keyEvent("ArrowRight")), { type: "device_input", input: { type: "encoder_turn", delta: 1, id: "main" } });
  assert.deepEqual(mapKeyboardEventToInputAction(keyEvent("Enter")), { type: "device_input", input: { type: "encoder_press", id: "main" } });
  assert.deepEqual(mapKeyboardEventToInputAction(keyEvent("Backspace")), { type: "device_input", input: { type: "button_a" } });
  assert.deepEqual(mapKeyboardEventToInputAction(keyEvent("Escape")), { type: "device_input", input: { type: "button_a" } });
  assert.deepEqual(mapKeyboardEventToInputAction(keyEvent(" ")), { type: "device_input", input: { type: "button_s" } });
});

test("maps modifiers and emergency brake", () => {
  assert.deepEqual(mapKeyboardEventToInputAction(keyEvent("Shift")), { type: "shift", active: true });
  assert.deepEqual(mapKeyboardEventToInputAction(keyEvent("Control")), { type: "fn", active: true });
  assert.deepEqual(mapKeyboardEventToInputAction(keyEvent(" ", true)), { type: "emergency_brake" });
  assert.deepEqual(mapKeyboardKeyupToInputAction(keyEvent("Shift")), { type: "shift", active: false });
  assert.deepEqual(mapKeyboardKeyupToInputAction(keyEvent("Control")), { type: "fn", active: false });
});

test("prevent-default only for mapped keys", () => {
  assert.equal(shouldPreventKeyboardDefault(keyEvent("ArrowUp")), true);
  assert.equal(shouldPreventKeyboardDefault(keyEvent("x")), false);
});

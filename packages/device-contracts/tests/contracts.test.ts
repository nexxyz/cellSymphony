import test from "node:test";
import assert from "node:assert/strict";

import { GRID_HEIGHT, GRID_WIDTH, type OledFrame } from "../src/index";

test("grid constants are 8x8", () => {
  assert.equal(GRID_WIDTH, 8);
  assert.equal(GRID_HEIGHT, 8);
});

test("OLED framebuffer uses 128x128 rgb565be", () => {
  const frame: OledFrame = { width: 128, height: 128, format: "rgb565be", pixels: new Uint8Array(128 * 128 * 2) };
  assert.equal(frame.pixels.length, 32768);
});

import test from "node:test";
import assert from "node:assert/strict";

import { GRID_DOMAIN, GRID_HEIGHT, GRID_WIDTH, type OledFrame } from "../src/index";

test("grid constants are 8x8", () => {
  assert.equal(GRID_WIDTH, 8);
  assert.equal(GRID_HEIGHT, 8);
});

test("OLED framebuffer uses 128x128 rgb565be", () => {
  const frame: OledFrame = { width: 128, height: 128, format: "rgb565be", pixels: new Uint8Array(128 * 128 * 2) };
  assert.equal(frame.pixels.length, 32768);
});

test("grid domain clamps/floors and preserves immutability", () => {
  const a = GRID_DOMAIN.toLogicalCell({ x: -1.4, y: 999.2 });
  assert.equal(a.x, 0);
  assert.equal(a.y, 0);

  const cells = new Array(GRID_WIDTH * GRID_HEIGHT).fill(false);
  const set = GRID_DOMAIN.set(cells, { x: 2, y: 3 }, true);
  assert.equal(cells[GRID_DOMAIN.indexOf({ x: 2, y: 3 })], false);
  assert.equal(set[GRID_DOMAIN.indexOf({ x: 2, y: 3 })], true);

  const toggled = GRID_DOMAIN.toggle(set, { x: 2, y: 3 });
  assert.equal(toggled[GRID_DOMAIN.indexOf({ x: 2, y: 3 })], false);
});

test("grid domain index conversion is consistent", () => {
  const idx = GRID_DOMAIN.toLogicalIndex({ x: 1, y: 2 });
  const cell = GRID_DOMAIN.cellOf(idx);
  assert.equal(cell.x, 1);
  assert.equal(cell.y, 5);
  const back = GRID_DOMAIN.toDisplayCell(cell);
  assert.equal(back.x, 1);
  assert.equal(back.y, 2);
});

import test from "node:test";
import assert from "node:assert/strict";
import { GRID_DOMAIN } from "../src/index";

test("screen/world Y conversion uses lower-left world origin", () => {
  assert.equal(GRID_DOMAIN.toLogicalCell({ x: 0, y: 0 }).y, 7);
  assert.equal(GRID_DOMAIN.toLogicalCell({ x: 0, y: 7 }).y, 0);
  assert.equal(GRID_DOMAIN.toDisplayCell({ x: 0, y: 7 }).y, 0);
  assert.equal(GRID_DOMAIN.toDisplayCell({ x: 0, y: 0 }).y, 7);
});

test("screen/world coordinate conversion round-trips", () => {
  for (let x = 0; x < 8; x += 1) {
    for (let y = 0; y < 8; y += 1) {
      const w = GRID_DOMAIN.toLogicalCell({ x, y });
      const s = GRID_DOMAIN.toDisplayCell(w);
      assert.equal(s.x, x);
      assert.equal(s.y, y);
    }
  }
});

test("world index mapping round-trips", () => {
  for (let x = 0; x < 8; x += 1) {
    for (let y = 0; y < 8; y += 1) {
      const idx = GRID_DOMAIN.indexOf({ x, y });
      const back = GRID_DOMAIN.cellOf(idx);
      assert.equal(back.x, x);
      assert.equal(back.y, y);
    }
  }
});

test("display index mapping round-trips", () => {
  for (let x = 0; x < 8; x += 1) {
    for (let y = 0; y < 8; y += 1) {
      const idx = GRID_DOMAIN.toDisplayIndex({ x, y });
      const back = GRID_DOMAIN.displayCellOf(idx);
      assert.equal(back.x, x);
      assert.equal(back.y, y);
    }
  }
});

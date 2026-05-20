import test from "node:test";
import assert from "node:assert/strict";
import type { BehaviorEngine } from "../src/index";
import { getBehavior, listBehaviorIds, registerBehavior } from "../src/index";

type TestState = { n: number };

function makeEngine(id: string, n: number): BehaviorEngine<TestState, {}> {
  return {
    id,
    init: () => ({ n }),
    onInput: (state) => state,
    onTick: (state) => state,
    renderModel: (state) => ({ name: id, statusLine: String(state.n), cells: [false] }),
    serialize: (state) => state,
    deserialize: (data) => data as TestState
  };
}

test("registerBehavior and getBehavior round-trip", () => {
  const id = `test.behavior.${Date.now()}.a`;
  const engine = makeEngine(id, 1);
  registerBehavior(engine);
  assert.equal(getBehavior(id), engine);
});

test("registerBehavior overwrites same id deterministically", () => {
  const id = `test.behavior.${Date.now()}.b`;
  const first = makeEngine(id, 1);
  const second = makeEngine(id, 2);
  registerBehavior(first);
  registerBehavior(second);
  assert.equal(getBehavior(id), second);
  assert.equal(getBehavior(id)?.init({}).n, 2);
});

test("listBehaviorIds includes newly registered ids", () => {
  const id = `test.behavior.${Date.now()}.c`;
  registerBehavior(makeEngine(id, 3));
  assert.ok(listBehaviorIds().includes(id));
});

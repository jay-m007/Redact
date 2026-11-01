import { test } from "node:test";
import assert from "node:assert/strict";
import { rectFromPoints, clampRect, isUsable, padRect, scaleRect, hitTest, mostlyCovered, union, overlapArea } from "../engine/index.js";

test("a rectangle can be dragged in any direction", () => {
  assert.deepEqual(rectFromPoints({ x: 50, y: 40 }, { x: 10, y: 10 }), { x: 10, y: 10, w: 40, h: 30 });
});
test("clamping keeps a box inside the image", () => {
  assert.deepEqual(clampRect({ x: -10, y: 5, w: 50, h: 500 }, 100, 80), { x: 0, y: 5, w: 40, h: 75 });
  assert.deepEqual(clampRect({ x: 200, y: 200, w: 10, h: 10 }, 100, 80), { x: 100, y: 80, w: 0, h: 0 });
});
test("tiny boxes are not usable", () => { assert.ok(!isUsable({ x: 0, y: 0, w: 3, h: 50 })); assert.ok(isUsable({ x: 0, y: 0, w: 4, h: 4 })); });
test("padding and scaling", () => {
  assert.deepEqual(padRect({ x: 10, y: 10, w: 20, h: 10 }, 2), { x: 8, y: 8, w: 24, h: 14 });
  assert.deepEqual(scaleRect({ x: 1, y: 2, w: 3, h: 4 }, 2), { x: 2, y: 4, w: 6, h: 8 });
});
test("the top-most box under a point wins", () => {
  const b = [{ x: 0, y: 0, w: 100, h: 100 }, { x: 10, y: 10, w: 20, h: 20 }];
  assert.equal(hitTest(b, 15, 15), 1);
  assert.equal(hitTest(b, 80, 80), 0);
  assert.equal(hitTest(b, 150, 150), -1);
});
test("covered boxes are recognised", () => {
  assert.ok(mostlyCovered({ x: 10, y: 10, w: 10, h: 10 }, { x: 0, y: 0, w: 100, h: 100 }));
  assert.ok(!mostlyCovered({ x: 90, y: 90, w: 20, h: 20 }, { x: 0, y: 0, w: 100, h: 100 }));
  assert.equal(overlapArea({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 20, w: 5, h: 5 }), 0);
  assert.deepEqual(union({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }), { x: 0, y: 0, w: 15, h: 15 });
});

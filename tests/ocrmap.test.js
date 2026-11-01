import { test } from "node:test";
import assert from "node:assert/strict";
import { findOnLines, linesFromOcr } from "../engine/index.js";

const w = (text, x0, x1, y0 = 100, y1 = 120) => ({ text, bbox: { x0, y0, x1, y1 } });

test("a number split over three words becomes one box around all three", () => {
  const lines = [{ words: [w("Aadhaar:", 10, 90), w("2345", 100, 150), w("6789", 160, 210), w("0128", 220, 270)] }];
  // 2345 6789 0128 is not checksum-valid but grouped, so it is still hidden
  const boxes = findOnLines(lines);
  assert.equal(boxes.length, 1);
  assert.equal(boxes[0].kind, "aadhaar");
  assert.ok(boxes[0].x <= 100 && boxes[0].x + boxes[0].w >= 270, "covers all three words");
  assert.ok(boxes[0].x >= 90, "does not cover the label");
  assert.equal(boxes[0].source, "auto");
});

test("a word only partly covered is narrowed by character position", () => {
  const lines = [{ words: [w("Mobile:9876543210", 0, 170)] }]; // 17 chars, 10 px each
  const [b] = findOnLines(lines);
  assert.equal(b.kind, "phone");
  assert.ok(b.x >= 60 && b.x <= 70, "starts after 'Mobile:' (7 chars)");
  assert.ok(b.x + b.w >= 170 && b.x + b.w <= 176);
});

test("padding grows the box a little on every side", () => {
  const [b] = findOnLines([{ words: [w("ABCPE1234F", 100, 200, 50, 70)] }]);
  assert.ok(b.x < 100 && b.y < 50 && b.x + b.w > 200 && b.y + b.h > 70);
  assert.ok(b.h < 40);
});

test("lines with nothing sensitive give nothing", () => {
  assert.deepEqual(findOnLines([{ words: [w("Hello", 0, 50), w("world", 60, 110)] }]), []);
  assert.deepEqual(findOnLines([{ words: [] }, {}]), []);
});

test("odd OCR words are ignored safely", () => {
  assert.deepEqual(findOnLines([{ words: [null, { text: "", bbox: null }, { text: "  ", bbox: { x0: 0, y0: 0, x1: 1, y1: 1 } }] }]), []);
});

test("each line is searched on its own", () => {
  const lines = [
    { words: [w("PAN", 0, 40, 10, 30), w("ABCPE1234F", 50, 200, 10, 30)] },
    { words: [w("Call", 0, 40, 60, 80), w("9876543210", 50, 200, 60, 80)] },
  ];
  assert.deepEqual(findOnLines(lines).map((b) => b.kind), ["pan", "phone"]);
});

test("linesFromOcr accepts lines, or falls back to grouping words", () => {
  assert.equal(linesFromOcr({ lines: [{ words: [] }] }).length, 1);
  const words = [
    { text: "b", bbox: { x0: 50, y0: 10, x1: 60, y1: 24 } },
    { text: "a", bbox: { x0: 10, y0: 10, x1: 20, y1: 24 } },
    { text: "c", bbox: { x0: 10, y0: 60, x1: 20, y1: 74 } },
  ];
  const l = linesFromOcr({ words });
  assert.equal(l.length, 2);
  assert.deepEqual(l[0].words.map((x) => x.text), ["a", "b"]);
  assert.deepEqual(linesFromOcr(null), []);
});

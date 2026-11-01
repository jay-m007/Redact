import { test } from "node:test";
import assert from "node:assert/strict";
import { verhoeffValid, verhoeffCheckDigit, luhnValid } from "../engine/index.js";

test("Verhoeff: the textbook example 236 + check digit 3", () => {
  assert.equal(verhoeffCheckDigit("236"), 3);
  assert.ok(verhoeffValid("2363"));
  assert.ok(!verhoeffValid("2364"));
});

test("Verhoeff catches every single-digit mistake and every swap of neighbours", () => {
  const base = "23456789012";
  const num = base + verhoeffCheckDigit(base);
  assert.ok(verhoeffValid(num));
  for (let i = 0; i < num.length; i++) for (let d = 0; d <= 9; d++) {
    if (String(d) === num[i]) continue;
    assert.ok(!verhoeffValid(num.slice(0, i) + d + num.slice(i + 1)), `digit ${i}->${d}`);
  }
  for (let i = 0; i < num.length - 1; i++) {
    if (num[i] === num[i + 1]) continue;
    const sw = num.slice(0, i) + num[i + 1] + num[i] + num.slice(i + 2);
    assert.ok(!verhoeffValid(sw), `swap ${i}`);
  }
});

test("Verhoeff rejects non-digits", () => { assert.ok(!verhoeffValid("12a4")); assert.ok(!verhoeffValid("")); });

test("Luhn: known test card numbers", () => {
  assert.ok(luhnValid("4539148803436467"));
  assert.ok(luhnValid("4111111111111111"));
  assert.ok(luhnValid("378282246310005"));
  assert.ok(!luhnValid("4111111111111112"));
  assert.ok(!luhnValid("123"));
});

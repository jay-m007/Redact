import { test } from "node:test";
import assert from "node:assert/strict";
import { parseExif } from "../engine/index.js";

import { build } from "./exifbuilder.js";

test("reads phone, time and software from a little-endian JPEG", () => {
  const r = parseExif(build({ make: "Apple", model: "iPhone 13", date: "2024:05:01 10:22:33", software: "17.4" }));
  assert.ok(r.found);
  const m = Object.fromEntries(r.items.map((i) => [i.label, i.value]));
  assert.equal(m.Make, "Apple");
  assert.equal(m.Model, "iPhone 13");
  assert.equal(m.Date, "2024:05:01 10:22:33");
  assert.equal(m.Software, "17.4");
});

test("reads GPS location, including south and west", () => {
  const r = parseExif(build({ make: "Phone", lat: 12.9716, lon: 77.5946 }));
  assert.ok(r.gps);
  assert.ok(Math.abs(r.gps.lat - 12.9716) < 0.001 && Math.abs(r.gps.lon - 77.5946) < 0.001);
  assert.ok(r.items.some((i) => i.label === "Location" && /N, .*E/.test(i.value)));
  const s = parseExif(build({ lat: 33.8688, lon: 151.2093, latRef: "S", lonRef: "W" }));
  assert.ok(s.gps.lat < 0 && s.gps.lon < 0);
});

test("reads big-endian files too", () => {
  const r = parseExif(build({ le: false, make: "Canon", model: "EOS", lat: 28.6139, lon: 77.209 }));
  assert.ok(r.found && r.gps);
  assert.equal(r.items.find((i) => i.label === "Make").value, "Canon");
});

test("files without EXIF, and junk, are handled without throwing", () => {
  assert.equal(parseExif(Buffer.from([0xff, 0xd8, 0xff, 0xd9])).found, false);
  assert.equal(parseExif(new Uint8Array(0)).found, false);
  assert.equal(parseExif(Buffer.from("not an image at all")).found, false);
  assert.equal(parseExif(new ArrayBuffer(5)).found, false);
  const good = build({ make: "Apple", model: "iPhone 13", lat: 12.9, lon: 77.5 });
  for (let cut = 4; cut < good.length; cut += 7) parseExif(good.subarray(0, cut)); // truncated copies must not throw
  const evil = Buffer.from(good);
  for (let i = 12; i < evil.length; i += 3) evil[i] = 0xff; // corrupted offsets
  parseExif(evil);
  assert.ok(true);
});

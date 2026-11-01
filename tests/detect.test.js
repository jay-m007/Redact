import { test } from "node:test";
import assert from "node:assert/strict";
import { detect, verhoeffCheckDigit } from "../engine/index.js";

const aadhaar = (b) => b + verhoeffCheckDigit(b);
const kinds = (t, o) => detect(t, o).map((s) => s.kind);
const texts = (t, k) => detect(t, k ? { kinds: [k] } : undefined).map((s) => t.slice(s.start, s.end));

test("Aadhaar: grouped, run together, and the checksum rule", () => {
  const n = aadhaar("23456789012");
  const g = `${n.slice(0, 4)} ${n.slice(4, 8)} ${n.slice(8)}`;
  assert.deepEqual(texts(`Aadhaar: ${g}`, "aadhaar"), [g]);
  assert.deepEqual(texts(`UID ${n} issued`, "aadhaar"), [n]);
  // run together but the checksum is wrong: probably not an Aadhaar, so left alone
  const bad = n.slice(0, 11) + ((+n[11] + 1) % 10);
  assert.deepEqual(texts(`ref ${bad}`, "aadhaar"), []);
  // grouped with a wrong checksum (an OCR slip) is still hidden, since hiding too much is the safe side
  const badG = `${bad.slice(0, 4)} ${bad.slice(4, 8)} ${bad.slice(8)}`;
  assert.equal(texts(badG, "aadhaar").length, 1);
  assert.deepEqual(texts("order 1234 5678 9012", "aadhaar"), [], "cannot start with 1");
});

test("PAN: shape and entity letter", () => {
  assert.deepEqual(texts("PAN ABCPE1234F here", "pan"), ["ABCPE1234F"]);
  assert.deepEqual(texts("code ABCXE1234F", "pan"), [], "4th letter X is not a PAN entity type");
  assert.deepEqual(texts("abcpe1234f", "pan"), [], "must be capitals");
});

test("Phone numbers in common Indian styles", () => {
  for (const p of ["9876543210", "+91 98765 43210", "+91-9876543210", "098765 43210", "98765 43210", "919876543210"]) {
    assert.deepEqual(texts(`Call ${p} now`, "phone"), [p], p);
  }
  assert.deepEqual(texts("Call 1800 123 4567", "phone"), [], "toll free is not a personal number");
  assert.deepEqual(texts("total 5987654321.50", "phone"), []);
  assert.deepEqual(texts("1234567890", "phone"), [], "must start 6-9");
});

test("Email and UPI IDs are told apart", () => {
  assert.deepEqual(texts("mail ravi.kumar@gmail.com ok", "email"), ["ravi.kumar@gmail.com"]);
  assert.deepEqual(texts("pay ravi.k@okhdfcbank now", "upi"), ["ravi.k@okhdfcbank"]);
  assert.deepEqual(texts("ravi.kumar@gmail.com", "upi"), [], "an email is not a UPI ID");
  assert.deepEqual(kinds("ravi.kumar@gmail.com 9876543210"), ["email", "phone"]);
  assert.deepEqual(kinds("9876543210@ybl"), ["upi"], "phone-number UPI id counts as UPI, not phone");
});

test("Card numbers need a valid Luhn checksum", () => {
  assert.deepEqual(texts("card 4539 1488 0343 6467 exp", "card"), ["4539 1488 0343 6467"]);
  assert.deepEqual(texts("card 4539 1488 0343 6468", "card"), []);
  assert.deepEqual(kinds("4111-1111-1111-1111"), ["card"]);
});

test("Bank account numbers need the words before them", () => {
  assert.deepEqual(texts("A/c No: 123456789012 IFSC", "account"), ["123456789012"]);
  assert.deepEqual(texts("Account number 50100123456789", "account"), ["50100123456789"]);
  assert.deepEqual(texts("Alc No: 123456789012", "account"), ["123456789012"], "OCR often reads A/c as Alc");
  assert.deepEqual(texts("order 123456789012", "account"), []);
});

test("IFSC, vehicle, voter, licence, passport", () => {
  assert.deepEqual(texts("IFSC HDFC0001234 branch", "ifsc"), ["HDFC0001234"]);
  assert.deepEqual(texts("Reg MH12AB1234 car", "vehicle"), ["MH12AB1234"]);
  assert.deepEqual(texts("Reg MH 12 AB 1234", "vehicle"), ["MH 12 AB 1234"]);
  assert.deepEqual(texts("Reg ZZ12AB1234", "vehicle"), [], "ZZ is not a state");
  assert.deepEqual(texts("EPIC ABC1234567", "voter"), ["ABC1234567"]);
  assert.deepEqual(texts("DL MH12 20150012345 valid", "licence"), ["MH12 20150012345"]);
  assert.deepEqual(texts("Passport No: K1234567", "passport"), ["K1234567"]);
  assert.deepEqual(texts("serial K1234567", "passport"), [], "needs the word passport");
});

test("Date of birth only counts after a birth label", () => {
  assert.deepEqual(texts("DOB: 15/08/1995", "dob"), ["15/08/1995"]);
  assert.deepEqual(texts("Date of Birth 01-02-2000", "dob"), ["01-02-2000"]);
  assert.deepEqual(texts("Paid on 15/08/2025", "dob"), []);
});

test("Names after a label, and nothing after the next label", () => {
  assert.deepEqual(texts("Name: Ravi Kumar Sharma DOB: 15/08/1995", "name"), ["Ravi Kumar Sharma"]);
  assert.deepEqual(texts("Father's Name: Suresh Sharma", "name"), ["Suresh Sharma"]);
  assert.deepEqual(texts("S/O: Mohan Lal", "name"), ["Mohan Lal"]);
  assert.deepEqual(texts("File name: report.pdf", "name"), []);
});

test("OTP and codes after a keyword", () => {
  assert.deepEqual(texts("Your OTP is 482913. Do not share", "otp"), ["482913"]);
  assert.deepEqual(texts("verification code: 7731", "otp"), ["7731"]);
  assert.deepEqual(texts("CVV 123", "otp"), ["123"]);
  assert.deepEqual(texts("room 482913", "otp"), []);
});

test("Overlaps are settled by priority, never reported twice", () => {
  const n = aadhaar("23456789012");
  const t = `${n} and 9876543210`;
  const hits = detect(t);
  assert.deepEqual(hits.map((h) => h.kind), ["aadhaar", "phone"]);
  for (let i = 1; i < hits.length; i++) assert.ok(hits[i].start >= hits[i - 1].end);
});

test("kinds option limits what is looked for", () => {
  assert.deepEqual(kinds("9876543210 ravi@gmail.com", { kinds: ["email"] }), ["email"]);
});

test("ordinary text finds nothing", () => {
  for (const t of ["Hello, how are you? Meeting at 5 pm tomorrow.", "Total: Rs 1,250.00 paid on 02/11/2026", "Order #4412 shipped via courier", "Page 12 of 340", ""])
    assert.deepEqual(detect(t), [], t);
});

test("hostile input is handled quickly", () => {
  for (const s of ["9".repeat(20000), "1 ".repeat(10000), "a@".repeat(8000), "Name:".repeat(4000), "A/c ".repeat(5000) + "1", ("ABCDE" + "1".repeat(4)).repeat(2000)]) {
    const t0 = performance.now();
    detect(s);
    assert.ok(performance.now() - t0 < 500, "slow on " + s.slice(0, 12));
  }
});

import { verhoeffValid, luhnValid, RTO_STATES } from "./checks.js";

// What can be found. "on" means it is looked for by default.
export const KINDS = {
  aadhaar: { label: "Aadhaar number", on: true },
  pan: { label: "PAN", on: true },
  phone: { label: "Phone number", on: true },
  email: { label: "Email address", on: true },
  upi: { label: "UPI ID", on: true },
  card: { label: "Card number", on: true },
  account: { label: "Bank account number", on: true },
  ifsc: { label: "IFSC code", on: true },
  dob: { label: "Date of birth", on: true },
  name: { label: "Name after a label", on: true },
  otp: { label: "OTP or code", on: true },
  vehicle: { label: "Vehicle number", on: true },
  passport: { label: "Passport number", on: true },
  voter: { label: "Voter ID", on: true },
  licence: { label: "Driving licence", on: true },
};
// When two kinds match the same characters the earlier one wins.
const PRIORITY = ["aadhaar", "card", "pan", "email", "upi", "ifsc", "licence", "voter", "passport", "vehicle", "account", "dob", "otp", "phone", "name"];

const digitsOf = (s) => s.replace(/\D/g, "");
const PAN_TYPES = new Set("ABCFGHJLPT".split(""));

// Each finder returns { start, end, note? } spans inside the text.
const FINDERS = {
  aadhaar(t) {
    const out = [];
    // 4-4-4 with spaces or hyphens: accepted even if OCR misread a digit (the checksum may fail)
    for (const m of t.matchAll(/(?<![\d-])([2-9]\d{3})([ -])(\d{4})\2(\d{4})(?![\d-])/g)) {
      const d = digitsOf(m[0]);
      out.push({ start: m.index, end: m.index + m[0].length, note: verhoeffValid(d) ? "checksum ok" : "pattern only" });
    }
    // 12 digits run together: only if the checksum is right, otherwise it is probably something else
    for (const m of t.matchAll(/(?<![\d-])[2-9]\d{11}(?![\d-])/g)) if (verhoeffValid(m[0])) out.push({ start: m.index, end: m.index + 12, note: "checksum ok" });
    return out;
  },
  pan(t) {
    const out = [];
    for (const m of t.matchAll(/(?<![A-Za-z0-9])[A-Za-z]{5}\d{4}[A-Za-z](?![A-Za-z0-9])/g)) {
      if (m[0] === m[0].toUpperCase() && PAN_TYPES.has(m[0][3])) out.push({ start: m.index, end: m.index + 10 });
    }
    return out;
  },
  phone(t) {
    const out = [];
    for (const m of t.matchAll(/(?<![\d.])(?:(?:\+|00)?91[ -]?|0)?[6-9]\d{4}[ -]?\d{5}(?![\d])/g)) out.push({ start: m.index, end: m.index + m[0].length });
    return out;
  },
  email(t) {
    return [...t.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g)].map((m) => ({ start: m.index, end: m.index + m[0].length }));
  },
  upi(t) {
    const out = [];
    for (const m of t.matchAll(/(?<![A-Za-z0-9._%+-])[A-Za-z0-9._-]{2,}@[A-Za-z][A-Za-z0-9]{1,20}(?![A-Za-z0-9]|\.[A-Za-z])/g)) out.push({ start: m.index, end: m.index + m[0].length });
    return out;
  },
  card(t) {
    const out = [];
    for (const m of t.matchAll(/(?<![\d-])(?:\d[ -]?){12,18}\d(?![\d-])/g)) {
      const d = digitsOf(m[0]);
      if (d.length >= 13 && d.length <= 19 && /^[2-6]/.test(d) && luhnValid(d)) out.push({ start: m.index, end: m.index + m[0].length });
    }
    return out;
  },
  account(t) {
    const out = [];
    for (const m of t.matchAll(/(?:a[\/l|I1]c|acct?\.?|account)(?:\s*(?:no|number|num|#))?\.?\s*[:\-#]?\s*(\d[\d -]{7,22}\d)/gi)) {
      const d = digitsOf(m[1]);
      if (d.length >= 9 && d.length <= 18) {
        const start = m.index + m[0].length - m[1].length;
        out.push({ start, end: start + m[1].length });
      }
    }
    return out;
  },
  ifsc(t) {
    return [...t.matchAll(/(?<![A-Za-z0-9])[A-Z]{4}0[A-Z0-9]{6}(?![A-Za-z0-9])/g)].map((m) => ({ start: m.index, end: m.index + 11 }));
  },
  dob(t) {
    const out = [];
    for (const m of t.matchAll(/(?:d\.?o\.?b\.?|date\s+of\s+birth|born(?:\s+on)?|birth\s*date|जन्म\s*तिथि)\s*[:\-]?\s*((?:0?[1-9]|[12]\d|3[01])[\/\-.](?:0?[1-9]|1[0-2])[\/\-.](?:19|20)\d{2})/gi)) {
      const start = m.index + m[0].length - m[1].length;
      out.push({ start, end: start + m[1].length });
    }
    return out;
  },
  name(t) {
    const out = [];
    const word = String.raw`[A-Z][A-Za-z.']{1,19}(?![A-Za-z.']|\s*[:])`;
    const re = new RegExp(String.raw`(?:\b(?:full\s+name|father'?s?\s+name|mother'?s?\s+name|holder\s+name|account\s+holder|name|s\/o|d\/o|w\/o|c\/o)\s*[:\-]\s*)(${word}(?:\s+${word}){0,3})`, "gi");
    for (const m of t.matchAll(re)) {
      const start = m.index + m[0].length - m[1].length;
      if (/^[A-Z]/.test(m[1])) out.push({ start, end: start + m[1].length });
    }
    return out;
  },
  otp(t) {
    const out = [];
    for (const m of t.matchAll(/(?:\botp\b|one[- ]time\s+(?:password|pin)|verification\s+code|security\s+code|\bcvv\b|\bpin\b)\s*(?:is|:|-)?\s*[:\-]?\s*(\d{3,8})(?!\d)/gi)) {
      const start = m.index + m[0].length - m[1].length;
      out.push({ start, end: start + m[1].length });
    }
    return out;
  },
  vehicle(t) {
    const out = [];
    for (const m of t.matchAll(/(?<![A-Za-z0-9])([A-Z]{2})[ -]?\d{1,2}[ -]?[A-Z]{1,3}[ -]?\d{4}(?![A-Za-z0-9])/g)) {
      if (RTO_STATES.has(m[1])) out.push({ start: m.index, end: m.index + m[0].length });
    }
    return out;
  },
  passport(t) {
    const out = [];
    for (const m of t.matchAll(/passport(?:\s*(?:no|number|num|#))?\.?\s*[:\-#]?\s*([A-PR-WY]\d{7})(?![A-Za-z0-9])/gi)) {
      const start = m.index + m[0].length - m[1].length;
      out.push({ start, end: start + m[1].length });
    }
    return out;
  },
  voter(t) {
    return [...t.matchAll(/(?<![A-Za-z0-9])[A-Z]{3}\d{7}(?![A-Za-z0-9])/g)].map((m) => ({ start: m.index, end: m.index + 10 }));
  },
  licence(t) {
    return [...t.matchAll(/(?<![A-Za-z0-9])[A-Z]{2}[ -]?\d{2}[ -]?(?:19|20)\d{2}\d{7}(?![A-Za-z0-9])/g)].filter((m) => RTO_STATES.has(m[0].slice(0, 2))).map((m) => ({ start: m.index, end: m.index + m[0].length }));
  },
};

// Finds sensitive text. Returns spans sorted by position, with overlaps resolved by PRIORITY.
export function detect(text, opts = {}) {
  const t = String(text || "").slice(0, 20000);
  const want = opts.kinds ? new Set(opts.kinds) : new Set(Object.keys(KINDS).filter((k) => KINDS[k].on));
  const found = [];
  for (const kind of PRIORITY) {
    if (!want.has(kind)) continue;
    for (const s of FINDERS[kind](t)) found.push({ ...s, kind, label: KINDS[kind].label, rank: PRIORITY.indexOf(kind) });
  }
  found.sort((a, b) => a.rank - b.rank || a.start - b.start);
  const kept = [];
  for (const s of found) {
    if (kept.some((k) => s.start < k.end && s.end > k.start)) continue;
    kept.push(s);
  }
  return kept.sort((a, b) => a.start - b.start).map(({ rank, ...s }) => s);
}

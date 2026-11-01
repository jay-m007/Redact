import { detect } from "./detect.js";
import { union, padRect } from "./boxes.js";

// OCR gives lines of words with boxes. Turn each line into text, find sensitive spans in it,
// and map every span back to a rectangle on the image.
//
// line: { words: [{ text, bbox: { x0, y0, x1, y1 } }] }
export function findOnLines(lines, opts = {}) {
  const found = [];
  for (const line of lines) {
    const words = (line.words || []).filter((w) => w && typeof w.text === "string" && w.text.trim() && w.bbox);
    if (!words.length) continue;
    let text = "";
    const spans = [];
    for (const w of words) {
      const t = w.text.trim();
      if (text) text += " ";
      spans.push({ w, start: text.length, end: text.length + t.length });
      text += t;
    }
    for (const hit of detect(text, opts)) {
      let rect = null;
      for (const { w, start, end } of spans) {
        if (hit.end <= start || hit.start >= end) continue;
        const len = end - start;
        const from = Math.max(0, hit.start - start), to = Math.min(len, hit.end - start);
        const wx = w.bbox.x1 - w.bbox.x0;
        // a word only partly covered (for example "Mobile:9876543210") is narrowed by character position
        const r = { x: w.bbox.x0 + (wx * from) / len, y: w.bbox.y0, w: (wx * (to - from)) / len, h: w.bbox.y1 - w.bbox.y0 };
        rect = rect ? union(rect, r) : r;
      }
      if (rect && rect.w > 0 && rect.h > 0) {
        const pad = Math.max(2, Math.round(rect.h * 0.18));
        found.push({ ...padRect(rect, pad), kind: hit.kind, label: hit.label, note: hit.note, source: "auto" });
      }
    }
  }
  return found;
}

// Tesseract.js returns data.lines in v5. Accept either that or a flat list of words grouped by line number.
export function linesFromOcr(data) {
  if (data && Array.isArray(data.lines) && data.lines.length) return data.lines;
  if (data && Array.isArray(data.words)) {
    const byLine = new Map();
    for (const w of data.words) {
      const k = w.line && w.line.id != null ? w.line.id : Math.round(((w.bbox.y0 + w.bbox.y1) / 2) / 14);
      if (!byLine.has(k)) byLine.set(k, { words: [] });
      byLine.get(k).words.push(w);
    }
    return [...byLine.values()].map((l) => ({ words: l.words.sort((a, b) => a.bbox.x0 - b.bbox.x0) }));
  }
  return [];
}

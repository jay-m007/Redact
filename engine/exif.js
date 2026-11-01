// Reads the hidden details a photo carries (phone model, time, GPS) so people can see what was removed.
// Only JPEG is read. Anything unreadable simply returns "nothing found".
const TAGS = { 0x010f: "Make", 0x0110: "Model", 0x0131: "Software", 0x0132: "Date", 0x013b: "Artist", 0x8298: "Copyright" };
const EXIF_TAGS = { 0x9003: "Taken", 0xa430: "Owner", 0xa431: "Body serial", 0xa434: "Lens", 0xa435: "Lens serial" };
const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

export function parseExif(buf) {
  const empty = { found: false, items: [], gps: null };
  try {
    const v = new DataView(buf instanceof ArrayBuffer ? buf : buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    if (v.byteLength < 12 || v.getUint16(0) !== 0xffd8) return empty;
    let p = 2;
    while (p + 4 < v.byteLength) {
      if (v.getUint8(p) !== 0xff) return empty;
      const marker = v.getUint8(p + 1);
      if (marker === 0xda || marker === 0xd9) return empty;
      const len = v.getUint16(p + 2);
      if (marker === 0xe1 && len >= 8 && v.getUint32(p + 4) === 0x45786966 && v.getUint16(p + 8) === 0) return readTiff(v, p + 10, Math.min(v.byteLength, p + 2 + len));
      p += 2 + len;
    }
  } catch (e) { /* damaged file: nothing to report */ }
  return empty;
}

function readTiff(v, base, end) {
  const order = v.getUint16(base);
  const le = order === 0x4949;
  if (!le && order !== 0x4d4d) return { found: false, items: [], gps: null };
  const u16 = (o) => v.getUint16(base + o, le), u32 = (o) => v.getUint32(base + o, le);
  if (u16(2) !== 42) return { found: false, items: [], gps: null };
  const ascii = (off, n) => { let s = ""; for (let i = 0; i < n; i++) { const c = v.getUint8(base + off + i); if (!c) break; s += String.fromCharCode(c); } return s.trim(); };
  const rational = (off) => { const d = u32(off + 4); return d ? u32(off) / d : 0; };
  function ifd(off, limit = 64) {
    const out = [];
    if (off + 2 > end - base) return out;
    const n = Math.min(u16(off), limit);
    for (let i = 0; i < n; i++) {
      const e = off + 2 + i * 12;
      if (e + 12 > end - base) break;
      const tag = u16(e), type = u16(e + 2), count = u32(e + 4);
      const size = (TYPE_SIZE[type] || 1) * count;
      const at = size <= 4 ? e + 8 : u32(e + 8);
      if (at + size > end - base || count > 1000) continue;
      out.push({ tag, type, count, at });
    }
    return out;
  }
  const items = [];
  const val = (en) => (en.type === 2 ? ascii(en.at, en.count) : null);
  let exifPtr = 0, gpsPtr = 0;
  for (const en of ifd(u32(4))) {
    if (en.tag === 0x8769) exifPtr = u32(en.at);
    else if (en.tag === 0x8825) gpsPtr = u32(en.at);
    else if (TAGS[en.tag]) { const s = val(en); if (s) items.push({ label: TAGS[en.tag], value: s }); }
  }
  if (exifPtr) for (const en of ifd(exifPtr)) if (EXIF_TAGS[en.tag]) { const s = val(en); if (s) items.push({ label: EXIF_TAGS[en.tag], value: s }); }
  let gps = null;
  if (gpsPtr) {
    const g = {};
    for (const en of ifd(gpsPtr)) {
      if ((en.tag === 1 || en.tag === 3) && en.type === 2) g[en.tag] = ascii(en.at, en.count);
      if ((en.tag === 2 || en.tag === 4) && en.type === 5 && en.count === 3) g[en.tag] = rational(en.at) + rational(en.at + 8) / 60 + rational(en.at + 16) / 3600;
    }
    if (g[2] != null && g[4] != null) {
      const lat = (g[1] === "S" ? -1 : 1) * g[2], lon = (g[3] === "W" ? -1 : 1) * g[4];
      gps = { lat, lon };
      items.push({ label: "Location", value: `${Math.abs(lat).toFixed(4)}° ${lat < 0 ? "S" : "N"}, ${Math.abs(lon).toFixed(4)}° ${lon < 0 ? "W" : "E"}` });
    }
  }
  return { found: items.length > 0, items, gps };
}

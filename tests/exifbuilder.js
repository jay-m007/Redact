// Builds a tiny JPEG with an EXIF block, big- or little-endian.
export function build({ le = true, make, model, date, lat, lon, latRef = "N", lonRef = "E", software } = {}) {
  const chunks = []; // tiff body is assembled with explicit offsets
  const bytes = [];
  const u16 = (n) => (le ? [n & 255, n >> 8] : [n >> 8, n & 255]);
  const u32 = (n) => (le ? [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255] : [(n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255]);
  const str = (s) => [...Buffer.from(s + "\0", "ascii")];
  const ifd0 = [], data = [];
  const entries = [];
  const dataBase = (count) => 8 + 2 + count * 12 + 4; // where the out-of-line data starts, once entry count is known
  const ascii = (tag, s) => entries.push({ tag, type: 2, count: s.length + 1, value: str(s) });
  if (make) ascii(0x010f, make);
  if (model) ascii(0x0110, model);
  if (software) ascii(0x0131, software);
  if (date) ascii(0x0132, date);
  const hasGps = lat != null;
  if (hasGps) entries.push({ tag: 0x8825, type: 4, count: 1, gps: true });
  const n = entries.length;
  let cursor = dataBase(n);
  const gpsAt = { v: 0 };
  for (const e of entries) {
    if (e.gps) continue;
    if (e.value.length > 4) { e.at = cursor; data.push(...e.value); cursor += e.value.length; if (cursor % 2) { data.push(0); cursor++; } }
  }
  // GPS IFD goes after the data
  let gpsBytes = [];
  if (hasGps) {
    gpsAt.v = cursor;
    const g = [];
    const ge = [];
    const gn = 4;
    let gcur = gpsAt.v + 2 + gn * 12 + 4;
    const rat = (deg) => { const d = Math.floor(deg), m = Math.floor((deg - d) * 60), s = Math.round(((deg - d) * 60 - m) * 60 * 100); return [...u32(d), ...u32(1), ...u32(m), ...u32(1), ...u32(s), ...u32(100)]; };
    const latAt = gcur, lonAt = gcur + 24;
    g.push(...u16(gn));
    const ent = (tag, type, count, val) => ge.push(...u16(tag), ...u16(type), ...u32(count), ...val);
    ent(1, 2, 2, [...str(latRef).slice(0, 1), 0, 0, 0].slice(0, 4));
    ent(2, 5, 3, u32(latAt));
    ent(3, 2, 2, [...str(lonRef).slice(0, 1), 0, 0, 0].slice(0, 4));
    ent(4, 5, 3, u32(lonAt));
    g.push(...ge, ...u32(0), ...rat(lat), ...rat(lon));
    gpsBytes = g;
  }
  const out = [];
  out.push(...(le ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(8));
  out.push(...u16(n));
  for (const e of entries) {
    out.push(...u16(e.tag), ...u16(e.type), ...u32(e.count));
    if (e.gps) out.push(...u32(gpsAt.v));
    else if (e.value.length <= 4) out.push(...[...e.value, 0, 0, 0, 0].slice(0, 4));
    else out.push(...u32(e.at));
  }
  out.push(...u32(0), ...data, ...gpsBytes);
  const body = [0x45, 0x78, 0x69, 0x66, 0, 0, ...out];
  const len = body.length + 2;
  return Buffer.from([0xff, 0xd8, 0xff, 0xe1, len >> 8, len & 255, ...body, 0xff, 0xd9]);
}


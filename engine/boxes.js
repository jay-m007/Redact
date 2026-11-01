// Rectangles in image pixels: { x, y, w, h }.
export const MIN_SIDE = 4;

export function rectFromPoints(a, b) {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

export function clampRect(r, W, H) {
  const x0 = Math.max(0, Math.min(W, r.x)), y0 = Math.max(0, Math.min(H, r.y));
  const x1 = Math.max(0, Math.min(W, r.x + r.w)), y1 = Math.max(0, Math.min(H, r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function isUsable(r) { return r.w >= MIN_SIDE && r.h >= MIN_SIDE; }

export function padRect(r, px) { return { x: r.x - px, y: r.y - px, w: r.w + 2 * px, h: r.h + 2 * px }; }

export function scaleRect(r, k) { return { x: r.x * k, y: r.y * k, w: r.w * k, h: r.h * k }; }

export function contains(r, x, y) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }

// Index of the top-most box under the point, or -1.
export function hitTest(boxes, x, y) {
  for (let i = boxes.length - 1; i >= 0; i--) if (contains(boxes[i], x, y)) return i;
  return -1;
}

export function overlapArea(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

// True when most of `a` is already covered by `b`.
export function mostlyCovered(a, b, share = 0.7) {
  const area = a.w * a.h;
  return area > 0 && overlapArea(a, b) / area >= share;
}

export function union(a, b) {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

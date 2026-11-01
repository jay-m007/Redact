import { KINDS, findOnLines, linesFromOcr, rectFromPoints, clampRect, isUsable, hitTest, mostlyCovered, parseExif } from "./engine/index.js";
import { drawSample } from "./sample.js";

// ---- tiny DOM helper: text only, never HTML ----
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}
const $ = (id) => document.getElementById(id);

const MAX_SIDE = 6000; // bigger pictures are scaled down so phones do not run out of memory
const state = { bitmap: null, name: "picture", W: 0, H: 0, boxes: [], undo: [], exif: null, lines: null, busy: false, kinds: new Set(Object.keys(KINDS).filter((k) => KINDS[k].on)), draft: null };

// ---- colour mode ----
function applyMode(m) {
  const root = document.documentElement;
  if (m === "light" || m === "dark") root.setAttribute("data-theme", m); else root.removeAttribute("data-theme");
  $("modeBtn").textContent = m === "light" ? "Light" : m === "dark" ? "Dark" : "Auto";
}
function cycleMode() {
  let cur = "auto";
  try { cur = localStorage.getItem("rd.mode") || "auto"; } catch (e) {}
  const next = cur === "auto" ? "light" : cur === "light" ? "dark" : "auto";
  try { if (next === "auto") localStorage.removeItem("rd.mode"); else localStorage.setItem("rd.mode", next); } catch (e) {}
  applyMode(next);
}

// ---- status line ----
function say(text, cls) { const s = $("status"); s.textContent = text || ""; s.className = "status" + (cls ? " " + cls : ""); }

// ---- loading a picture ----
async function loadFile(file) {
  if (!file) return;
  if (!/^image\/(jpeg|png|webp|gif|bmp)$/.test(file.type)) { return alert("That file is not a picture Redact can open. Use a JPEG, PNG or WebP."); }
  let exif = { found: false, items: [], gps: null };
  if (file.type === "image/jpeg") exif = parseExif(await file.slice(0, 262144).arrayBuffer());
  let bitmap;
  try { bitmap = await createImageBitmap(file); } catch (e) { return alert("This picture could not be opened. It may be damaged."); }
  start(bitmap, file.name.replace(/\.[^.]+$/, "") || "picture", exif);
}

function start(src, name, exif) {
  let bitmap = src;
  const long = Math.max(src.width, src.height);
  if (long > MAX_SIDE) {
    const k = MAX_SIDE / long;
    const c = document.createElement("canvas");
    c.width = Math.round(src.width * k); c.height = Math.round(src.height * k);
    c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
    bitmap = c;
  }
  Object.assign(state, { bitmap, name, W: bitmap.width, H: bitmap.height, boxes: [], undo: [], exif, lines: null, busy: false });
  $("start").hidden = true;
  $("editor").hidden = false;
  say(long > MAX_SIDE ? "This picture was very large, so it was scaled down to fit." : "");
  renderMeta();
  redraw();
  renderList();
  window.scrollTo({ top: 0 });
}

function reset() {
  state.bitmap = null; state.boxes = []; state.undo = []; state.lines = null;
  $("editor").hidden = true; $("start").hidden = false; $("file").value = "";
  $("progress").hidden = true;
}

// ---- drawing ----
const cv = $("cv");
function redraw(forExport) {
  const { W, H } = state;
  if (!forExport) { cv.width = W; cv.height = H; }
  const c = forExport || cv;
  const x = c.getContext("2d");
  x.drawImage(state.bitmap, 0, 0);
  x.fillStyle = "#000";
  for (const b of state.boxes) x.fillRect(Math.round(b.x), Math.round(b.y), Math.ceil(b.w), Math.ceil(b.h));
  if (forExport) return;
  const lw = Math.max(2, Math.round(Math.max(W, H) / 450));
  x.lineWidth = lw; x.strokeStyle = "#ff4d00";
  for (const b of state.boxes) x.strokeRect(b.x + lw / 2, b.y + lw / 2, b.w - lw, b.h - lw);
  if (state.draft) {
    const d = state.draft;
    x.fillStyle = "rgba(0,0,0,.55)"; x.fillRect(d.x, d.y, d.w, d.h);
    x.setLineDash([lw * 3, lw * 2]); x.strokeRect(d.x, d.y, d.w, d.h); x.setLineDash([]);
  }
}

function pushUndo() { state.undo.push(JSON.stringify(state.boxes)); if (state.undo.length > 100) state.undo.shift(); }
function setBoxes(next) { pushUndo(); state.boxes = next; refresh(); }
function refresh() { redraw(); renderList(); }

function addBoxes(found) {
  const fresh = [];
  for (const f of found) {
    const r = { ...f, ...clampRect(f, state.W, state.H) };
    if (!isUsable(r)) continue;
    if (state.boxes.some((b) => mostlyCovered(r, b)) || fresh.some((b) => mostlyCovered(r, b))) continue;
    fresh.push(r);
  }
  if (fresh.length) setBoxes(state.boxes.concat(fresh));
  return fresh.length;
}

function renderList() {
  const list = $("boxList");
  list.replaceChildren();
  const n = state.boxes.length;
  $("boxCount").textContent = n ? `(${n})` : "";
  $("undoBtn").disabled = !state.undo.length;
  $("clearBtn").disabled = !n;
  if (!n) { list.append(h("li", null, h("p", { class: "empty", text: "No boxes yet. Tap “Find personal details”, or drag on the picture to draw one." }))); return; }
  state.boxes.forEach((b, i) => {
    list.append(h("li", null,
      h("span", null,
        h("span", { class: "tag " + (b.source === "auto" ? "auto" : "manual"), text: b.source === "auto" ? "found" : "drawn" }),
        b.label || "Box " + (i + 1),
        b.note === "pattern only" ? h("span", { class: "note", text: "  (looks like one, checksum did not match)" }) : null),
      h("button", { class: "btn small ghost", type: "button", "aria-label": "Remove " + (b.label || "box " + (i + 1)), text: "Remove", onclick: () => setBoxes(state.boxes.filter((_, j) => j !== i)) })));
  });
}

function renderMeta() {
  const ex = state.exif;
  const card = $("metaCard"), list = $("metaList");
  list.replaceChildren();
  card.hidden = !(ex && ex.found);
  if (card.hidden) return;
  for (const it of ex.items) list.append(h("li", { class: it.label === "Location" ? "loc" : "" }, h("b", { text: it.label }), h("span", { text: it.value })));
}

// ---- pointer: drag to draw, tap to remove ----
function toImage(e) {
  const r = cv.getBoundingClientRect();
  return { x: ((e.clientX - r.left) * state.W) / r.width, y: ((e.clientY - r.top) * state.H) / r.height };
}
let drag = null;
cv.addEventListener("pointerdown", (e) => {
  if (!state.bitmap || e.button > 0) return;
  cv.setPointerCapture(e.pointerId);
  drag = { from: toImage(e), cx: e.clientX, cy: e.clientY };
});
cv.addEventListener("pointermove", (e) => {
  if (!drag) return;
  state.draft = rectFromPoints(drag.from, toImage(e));
  redraw();
});
function endDrag(e, cancel) {
  if (!drag) return;
  const moved = Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy);
  const from = drag.from;
  drag = null; state.draft = null;
  if (cancel) return redraw();
  if (moved < 6) {
    const i = hitTest(state.boxes, from.x, from.y);
    if (i >= 0) { setBoxes(state.boxes.filter((_, j) => j !== i)); say("Box removed. Undo brings it back."); return; }
    return redraw();
  }
  const r = clampRect(rectFromPoints(from, toImage(e)), state.W, state.H);
  if (isUsable(r)) setBoxes(state.boxes.concat([{ ...r, source: "manual", label: "Drawn box" }]));
  else redraw();
}
cv.addEventListener("pointerup", (e) => endDrag(e, false));
cv.addEventListener("pointercancel", (e) => endDrag(e, true));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && drag) { drag = null; state.draft = null; redraw(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && state.bitmap && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); undo(); }
});

function undo() {
  const prev = state.undo.pop();
  if (prev == null) return;
  state.boxes = JSON.parse(prev);
  refresh();
  say("");
}

// ---- finding personal details (text is read on this device) ----
function ocrCanvas() {
  const long = Math.max(state.W, state.H);
  const k = long > 2600 ? 2600 / long : long < 1200 ? 2 : 1;
  const c = document.createElement("canvas");
  c.width = Math.round(state.W * k); c.height = Math.round(state.H * k);
  const x = c.getContext("2d");
  x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
  x.drawImage(state.bitmap, 0, 0, c.width, c.height);
  return { canvas: c, k };
}

function scaleLines(lines, k) {
  return lines.map((l) => ({ words: (l.words || []).map((w) => ({ text: w.text, bbox: { x0: w.bbox.x0 / k, y0: w.bbox.y0 / k, x1: w.bbox.x1 / k, y1: w.bbox.y1 / k } })) }));
}

function applyDetection() {
  const found = findOnLines(state.lines, { kinds: [...state.kinds] });
  const added = addBoxes(found);
  if (added) say(`Found ${added} thing${added === 1 ? "" : "s"} to hide. Check them below, then save.`, "ok");
  else say(found.length ? "Everything it found is already covered." : "Nothing found automatically. Draw boxes over anything private, then save.", found.length ? "ok" : "");
}

async function find() {
  if (state.busy || !state.bitmap) return;
  if (state.lines) return applyDetection();
  state.busy = true;
  $("findBtn").disabled = true;
  $("progress").hidden = false;
  const fill = $("progressFill"), txt = $("progressText");
  fill.style.width = "4%"; txt.textContent = "Getting the text reader ready…";
  try {
    const { readText } = await import("./ocr.js");
    const { canvas, k } = ocrCanvas();
    const data = await readText(canvas, (m) => {
      if (!m || typeof m.progress !== "number") return;
      const reading = /recogniz/i.test(m.status || "");
      fill.style.width = Math.max(4, Math.round(m.progress * (reading ? 60 : 36) + (reading ? 40 : 0))) + "%";
      txt.textContent = reading ? "Reading the text in your picture…" : "Getting the text reader ready…";
    });
    state.lines = scaleLines(linesFromOcr(data), k);
    applyDetection();
  } catch (err) {
    say("The text reader could not start here. You can still draw boxes by hand.", "bad");
    console.error(err);
  } finally {
    state.busy = false;
    $("findBtn").disabled = false;
    $("progress").hidden = true;
  }
}

// ---- what to look for ----
function renderKinds() {
  const g = $("kinds");
  for (const [k, v] of Object.entries(KINDS)) {
    const box = h("input", { type: "checkbox", "data-kind": k });
    box.checked = state.kinds.has(k);
    box.addEventListener("change", () => { if (box.checked) state.kinds.add(k); else state.kinds.delete(k); if (state.lines) applyDetection(); });
    g.append(h("label", null, box, v.label));
  }
}

// ---- saving: rebuilt from the original picture, boxes burned in, no metadata ----
function exportCanvas() {
  const c = document.createElement("canvas");
  c.width = state.W; c.height = state.H;
  const x = c.getContext("2d");
  x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
  redraw(c);
  return c;
}
function blobOf(type) {
  const c = exportCanvas();
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("export failed"))), type, 0.92));
}
async function save(type) {
  try {
    const blob = await blobOf(type);
    const a = h("a", { href: URL.createObjectURL(blob), download: `redacted-${state.name}.${type === "image/png" ? "png" : "jpg"}` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    say("Saved. Open the saved picture and check it before you share it.", "ok");
  } catch (e) { say("Saving did not work. Try the other format.", "bad"); }
}
async function share() {
  try {
    const blob = await blobOf("image/png");
    const file = new File([blob], `redacted-${state.name}.png`, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file] });
  } catch (e) { /* the person closed the share sheet */ }
}

// ---- getting a picture in ----
function wireInput() {
  const drop = $("drop");
  $("pickBtn").addEventListener("click", () => $("file").click());
  $("file").addEventListener("change", () => loadFile($("file").files[0]));
  drop.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target === drop) { e.preventDefault(); $("file").click(); } });
  ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => loadFile(e.dataTransfer.files[0]));
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => { e.preventDefault(); if (e.target !== drop && !drop.contains(e.target) && e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]); });
  document.addEventListener("paste", (e) => {
    const item = [...(e.clipboardData ? e.clipboardData.items : [])].find((i) => i.type.startsWith("image/"));
    if (item) { e.preventDefault(); loadFile(item.getAsFile()); }
  });
  $("sampleBtn").addEventListener("click", async () => {
    const c = drawSample();
    start(c, "sample", { found: false, items: [], gps: null });
  });
}

function boot() {
  try { applyMode(localStorage.getItem("rd.mode") || "auto"); } catch (e) { applyMode("auto"); }
  $("modeBtn").addEventListener("click", cycleMode);
  $("findBtn").addEventListener("click", find);
  $("undoBtn").addEventListener("click", undo);
  $("clearBtn").addEventListener("click", () => { if (state.boxes.length) { setBoxes([]); say(""); } });
  $("newBtn").addEventListener("click", reset);
  $("savePng").addEventListener("click", () => save("image/png"));
  $("saveJpg").addEventListener("click", () => save("image/jpeg"));
  const shareBtn = $("shareBtn");
  try { if (navigator.canShare && navigator.canShare({ files: [new File([new Blob(["x"])], "a.png", { type: "image/png" })] })) { shareBtn.hidden = false; shareBtn.addEventListener("click", share); } } catch (e) {}
  renderKinds();
  wireInput();
  window.__redact = state; // read by the browser tests
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
}
boot();

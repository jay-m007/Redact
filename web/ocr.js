// Reads the text in an image, on this device. The reader and its English data are files from this same site.
let tesseract = null;

export async function readText(canvas, onStatus) {
  if (!tesseract) tesseract = (await import("./vendor/tesseract.esm.min.js")).default;
  const base = new URL("vendor/", location.href).href;
  const worker = await tesseract.createWorker("eng", 1, {
    workerPath: base + "worker.min.js",
    corePath: base + "core/",
    langPath: base + "lang/",
    workerBlobURL: false,
    cacheMethod: "none",
    gzip: true,
    logger: (m) => onStatus && onStatus(m),
  });
  try {
    const { data } = await worker.recognize(canvas);
    return data;
  } finally {
    await worker.terminate();
  }
}

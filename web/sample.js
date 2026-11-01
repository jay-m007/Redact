import { verhoeffCheckDigit } from "./engine/index.js";

// Draws a made-up payment receipt so you can try Redact without using one of your own pictures.
export function drawSample() {
  const W = 900, H = 1290;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");
  x.fillStyle = "#ffffff"; x.fillRect(0, 0, W, H);
  x.fillStyle = "#eef1f6"; x.fillRect(0, 0, W, 150);
  x.fillStyle = "#1c2433"; x.font = "bold 44px Arial, Helvetica, sans-serif"; x.fillText("Payment receipt", 48, 78);
  x.fillStyle = "#b3261e"; x.font = "bold 24px Arial, Helvetica, sans-serif"; x.fillText("SAMPLE: every detail below is made up", 48, 118);
  const base = "23456789012";
  const n = base + verhoeffCheckDigit(base);
  const aadhaar = `${n.slice(0, 4)} ${n.slice(4, 8)} ${n.slice(8)}`;
  const rows = [
    ["Paid to", "Fresh Mart Groceries"],
    ["Amount", "Rs 1,250.00"],
    ["Date", "02 Nov 2026, 6:42 pm"],
    null,
    ["Name:", "Asha Verma"],
    ["Mobile:", "+91 98765 43210"],
    ["Email:", "asha.verma@example.com"],
    ["UPI ID:", "asha.verma@okaxis"],
    ["PAN:", "ABCPE1234F"],
    ["Aadhaar:", aadhaar],
    ["DOB:", "14/03/1994"],
    ["A/c No:", "123456789012"],
    ["IFSC:", "SAMP0001234"],
  ];
  let y = 230;
  for (const r of rows) {
    if (!r) { x.fillStyle = "#d8dce6"; x.fillRect(48, y - 22, W - 96, 2); y += 44; continue; }
    x.fillStyle = "#5b6475"; x.font = "30px Arial, Helvetica, sans-serif"; x.fillText(r[0], 48, y);
    x.fillStyle = "#101828"; x.font = "bold 32px Arial, Helvetica, sans-serif"; x.fillText(r[1], 270, y);
    y += 78;
  }
  x.fillStyle = "#1c2433"; x.font = "26px Arial, Helvetica, sans-serif";
  x.fillText("Thank you for shopping with us.", 48, H - 60);
  return c;
}

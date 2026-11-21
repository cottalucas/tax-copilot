/**
 * Builds the synthetic scan and photo eval cases (SR-28): evals/media/files/*. Every name and
 * amount is made up. Run: npx tsx scripts/build-media-cases.ts
 * - scan-salary-statement.pdf: a salary statement as a scanner makes it, one JPEG, no text layer.
 * - photo-pillar3a.jpg: a pillar 3a certificate photographed on a desk, tilted, uneven light.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { imagePdf } from "../evals/lib/pdf.js";

const out = new URL("../evals/media/files/", import.meta.url);
mkdirSync(out, { recursive: true });

const paper = (body: string) => `<div id="doc" style="width:760px;padding:48px 56px;background:#fbfaf6;font:15px/1.5 Arial,sans-serif;color:#222">${body}</div>`;
const row = (label: string, value: string) => `<tr><td style="padding:6px 0;border-bottom:1px solid #ccc">${label}</td><td style="padding:6px 0;border-bottom:1px solid #ccc;text-align:right">${value}</td></tr>`;

const salary = paper(`
  <div style="font-size:20px;font-weight:bold">Salary statement 2025</div>
  <div style="margin:4px 0 24px">Synthetic Scan AG, Musterstrasse 1, 8000 Zurich</div>
  <div>Employee: Synthetic Person A</div>
  <div style="margin-bottom:16px">Period: 01.01.2025 to 31.12.2025</div>
  <table style="width:100%;border-collapse:collapse">
    ${row("Gross salary", "CHF 76'400.00")}
    ${row("Social contributions (AHV/IV/EO/ALV)", "CHF 4'927.80")}
    ${row("Pension fund (BVG)", "CHF 5'348.00")}
    ${row("Net salary", "CHF 66'124.20")}
  </table>
  <div style="margin-top:32px;font-size:12px">Synthetic document for testing. Not a real person or employer.</div>`);

const pillar = paper(`
  <div style="font-size:20px;font-weight:bold">Certificate of pillar 3a contributions</div>
  <div style="margin:4px 0 24px">Synthetic Vorsorge Bank, Bahnhofplatz 2, 3000 Bern</div>
  <div>Account holder: Synthetic Person A</div>
  <div style="margin-bottom:16px">Tax year 2025</div>
  <table style="width:100%;border-collapse:collapse">
    ${row("Contributions paid in 2025", "CHF 7'056.00")}
    ${row("Account balance on 31.12.2025", "CHF 41'230.55")}
  </table>
  <div style="margin-top:32px;font-size:12px">Synthetic document for testing. Not a real person or bank.</div>`);

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 1100 }, deviceScaleFactor: 1 });

  // Scan: flat, slightly grey, a little noise from JPEG compression.
  await page.setContent(`<body style="margin:0;background:#fff;filter:grayscale(1) contrast(1.1)">${salary}</body>`);
  const scanBox = (await page.locator("#doc").boundingBox())!;
  const scan = await page.screenshot({ type: "jpeg", quality: 55, clip: scanBox });
  writeFileSync(new URL("scan-salary-statement.pdf", out), imagePdf(scan, Math.round(scanBox.width), Math.round(scanBox.height)));

  // Photo: paper on a desk, tilted in 3D, shadow and uneven light.
  await page.setContent(`<body style="margin:0;width:900px;height:1100px;background:radial-gradient(circle at 30% 20%,#a07850,#5a3d24);display:flex;align-items:center;justify-content:center;overflow:hidden">
    <div style="transform:perspective(1400px) rotateX(9deg) rotateZ(-4deg);box-shadow:18px 24px 40px rgba(0,0,0,.55);background:linear-gradient(120deg,rgba(255,255,255,0) 40%,rgba(0,0,0,.12))">${pillar}</div>
  </body>`);
  writeFileSync(new URL("photo-pillar3a.jpg", out), await page.screenshot({ type: "jpeg", quality: 60, fullPage: false }));

  await browser.close();
  console.log("Wrote evals/media/files/scan-salary-statement.pdf and photo-pillar3a.jpg");
}

void main();

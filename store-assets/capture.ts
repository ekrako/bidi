/**
 * Capture all store assets as PNGs using headless Chrome.
 *
 * Usage:
 *   bun store-assets/capture.ts
 *
 * Output: store-assets/output/*.png
 */

import { $ } from "bun";
import path from "path";

const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const assetsDir = path.dirname(import.meta.path);
const outputDir = path.join(assetsDir, "output");

await $`mkdir -p ${outputDir}`;

const assets = [
  {
    file: "promo-440x280.html",
    width: 440,
    height: 280,
    output: "promo-small.png",
    label: "Small promotional tile (440×280)",
  },
  {
    file: "promo-1400x560.html",
    width: 1400,
    height: 560,
    output: "promo-large.png",
    label: "Large promotional tile (1400×560)",
  },
  {
    file: "screenshot-1-popup.html",
    width: 640,
    height: 400,
    output: "screenshot-1.png",
    label: "Screenshot 1 — Popup UI (640×400)",
  },
  {
    file: "screenshot-2-in-action.html",
    width: 1280,
    height: 800,
    output: "screenshot-2.png",
    label: "Screenshot 2 — Extension in action (1280×800)",
  },
  {
    file: "screenshot-3-before-after.html",
    width: 1280,
    height: 800,
    output: "screenshot-3.png",
    label: "Screenshot 3 — Before/after comparison (1280×800)",
  },
];

let ok = 0;
let fail = 0;

for (const asset of assets) {
  const filePath = path.resolve(assetsDir, asset.file);
  const outputPath = path.resolve(outputDir, asset.output);
  const url = `file://${filePath}`;

  process.stdout.write(`Capturing ${asset.label}... `);

  try {
    await $`${CHROME} \
      --headless=new \
      --screenshot=${outputPath} \
      --window-size=${asset.width},${asset.height} \
      --hide-scrollbars \
      --disable-gpu \
      --no-sandbox \
      "${url}"`.quiet();

    console.log("✓");
    ok++;
  } catch (err) {
    console.log("✗ failed");
    console.error(`  Error: ${err}`);
    fail++;
  }
}

console.log(`\nDone: ${ok} captured, ${fail} failed`);
console.log(`Output: ${outputDir}`);

if (fail > 0) {
  console.log(`\nIf Chrome was not found, set CHROME_PATH:`);
  console.log(
    `  CHROME_PATH="/path/to/chrome" bun store-assets/capture.ts`
  );
  process.exit(1);
}

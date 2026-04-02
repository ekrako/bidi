import { cp, mkdir } from "node:fs/promises";

// 1. Build the extension
await Bun.build({
  entrypoints: [
    "src/content.ts",
    "src/popup.ts",
    "src/background.ts",
  ],
  outdir: "dist",
  target: "browser",
  minify: false,
});

await cp("src/popup.html", "dist/popup.html");
await cp("manifest.json", "dist/manifest.json");
await cp("icons", "dist/icons", { recursive: true });

console.log("Extension build complete → dist/");

// 2. Build the website for GitHub Pages (docs folder)
await mkdir("docs", { recursive: true });
await Bun.build({
  entrypoints: [
    "website/main.ts",
  ],
  outdir: "docs",
  target: "browser",
  minify: true,
});

await cp("website/index.html", "docs/index.html");
await cp("website/style.css", "docs/style.css");
await cp("website/google8f710ed7675febd3.html", "docs/google8f710ed7675febd3.html");
await cp("icons", "docs/icons", { recursive: true });

console.log("Website build complete → docs/");

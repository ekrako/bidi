import { cp, mkdir } from "node:fs/promises";

// 1. Build the extension
await Bun.build({
  entrypoints: [
    "src/content.ts",
    "src/popup.ts",
  ],
  outdir: "dist",
  target: "browser",
  format: "iife",
  minify: false,
});

await Bun.build({
  entrypoints: [
    "src/background.ts",
  ],
  outdir: "dist",
  target: "browser",
  format: "esm",
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

// Copy HTML files, rewriting .ts script references to .js for production
for (const htmlFile of ["index.html", "privacy.html"]) {
  const html = await Bun.file(`website/${htmlFile}`).text();
  await Bun.write(`docs/${htmlFile}`, html.replace('./main.ts', './main.js'));
}
await cp("website/style.css", "docs/style.css");
await cp("website/google8f710ed7675febd3.html", "docs/google8f710ed7675febd3.html");
await cp("icons", "docs/icons", { recursive: true });

console.log("Website build complete → docs/");

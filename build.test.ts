import { test, expect } from "bun:test";
import { readFile } from "node:fs/promises";

const VERIFICATION_CONTENT = "google-site-verification: google8f710ed7675febd3.html";

test("website/google8f710ed7675febd3.html exists and has correct verification content", async () => {
  const content = await readFile("website/google8f710ed7675febd3.html", "utf-8");
  expect(content.trim()).toBe(VERIFICATION_CONTENT);
});

test("docs/google8f710ed7675febd3.html exists and has correct verification content", async () => {
  const content = await readFile("docs/google8f710ed7675febd3.html", "utf-8");
  expect(content.trim()).toBe(VERIFICATION_CONTENT);
});

test("website and docs google verification files have identical content", async () => {
  const source = await readFile("website/google8f710ed7675febd3.html", "utf-8");
  const dest = await readFile("docs/google8f710ed7675febd3.html", "utf-8");
  expect(source).toBe(dest);
});

test("google verification content starts with 'google-site-verification:'", async () => {
  const content = await readFile("website/google8f710ed7675febd3.html", "utf-8");
  expect(content.trim().startsWith("google-site-verification:")).toBe(true);
});

test("google verification content is not empty", async () => {
  const content = await readFile("website/google8f710ed7675febd3.html", "utf-8");
  expect(content.trim().length).toBeGreaterThan(0);
});

test("build.ts includes cp step for google verification file", async () => {
  const buildScript = await readFile("build.ts", "utf-8");
  expect(buildScript).toContain('cp("website/google8f710ed7675febd3.html", "docs/google8f710ed7675febd3.html")');
});

test("build.ts copies google verification file to docs directory", async () => {
  const buildScript = await readFile("build.ts", "utf-8");
  // Verify the destination is within the docs/ directory (GitHub Pages output)
  expect(buildScript).toContain('"docs/google8f710ed7675febd3.html"');
});

test("google verification filename matches token in content", async () => {
  const content = await readFile("website/google8f710ed7675febd3.html", "utf-8");
  // The file content should reference the same token as its filename
  expect(content.trim()).toContain("google8f710ed7675febd3.html");
});
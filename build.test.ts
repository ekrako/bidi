import { test, expect } from "bun:test";
import { readFile, cp, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const VERIFICATION_FILENAME = "google8f710ed7675febd3.html";
const EXPECTED_CONTENT = "google-site-verification: google8f710ed7675febd3.html";

const SOURCE_PATH = join(import.meta.dir, "website", VERIFICATION_FILENAME);
const DOCS_PATH = join(import.meta.dir, "docs", VERIFICATION_FILENAME);

// Tests for website/google8f710ed7675febd3.html (source file)

test("website verification file exists and is readable", async () => {
  const content = await readFile(SOURCE_PATH, "utf-8");
  expect(typeof content).toBe("string");
});

test("website verification file has correct google-site-verification content", async () => {
  const content = await readFile(SOURCE_PATH, "utf-8");
  expect(content).toBe(EXPECTED_CONTENT);
});

test("website verification file content starts with 'google-site-verification:'", async () => {
  const content = await readFile(SOURCE_PATH, "utf-8");
  expect(content.startsWith("google-site-verification:")).toBe(true);
});

test("website verification file content contains the correct token", async () => {
  const content = await readFile(SOURCE_PATH, "utf-8");
  expect(content).toContain("google8f710ed7675febd3.html");
});

test("website verification file has no trailing newline", async () => {
  const content = await readFile(SOURCE_PATH, "utf-8");
  expect(content.endsWith("\n")).toBe(false);
});

// Tests for docs/google8f710ed7675febd3.html (build output file)

test("docs verification file exists and is readable", async () => {
  const content = await readFile(DOCS_PATH, "utf-8");
  expect(typeof content).toBe("string");
});

test("docs verification file has correct google-site-verification content", async () => {
  const content = await readFile(DOCS_PATH, "utf-8");
  expect(content).toBe(EXPECTED_CONTENT);
});

test("docs verification file content starts with 'google-site-verification:'", async () => {
  const content = await readFile(DOCS_PATH, "utf-8");
  expect(content.startsWith("google-site-verification:")).toBe(true);
});

test("docs verification file content contains the correct token", async () => {
  const content = await readFile(DOCS_PATH, "utf-8");
  expect(content).toContain("google8f710ed7675febd3.html");
});

test("docs verification file has no trailing newline", async () => {
  const content = await readFile(DOCS_PATH, "utf-8");
  expect(content.endsWith("\n")).toBe(false);
});

// Tests comparing source and docs files

test("website and docs verification files have identical content", async () => {
  const sourceContent = await readFile(SOURCE_PATH, "utf-8");
  const docsContent = await readFile(DOCS_PATH, "utf-8");
  expect(sourceContent).toBe(docsContent);
});

test("verification file content has no byte order mark (BOM)", async () => {
  const content = await readFile(SOURCE_PATH, "utf-8");
  expect(content.charCodeAt(0)).not.toBe(0xfeff);
});

// Integration test: simulates the cp() call added to build.ts (line 34)

test("cp() copies website verification file to a destination correctly", async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), "bidi-build-test-"));
  const destPath = join(tmpDir, VERIFICATION_FILENAME);
  try {
    await cp(SOURCE_PATH, destPath);
    const copiedContent = await readFile(destPath, "utf-8");
    expect(copiedContent).toBe(EXPECTED_CONTENT);
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test("cp() produces a copy with content identical to the source", async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), "bidi-build-test-"));
  const destPath = join(tmpDir, VERIFICATION_FILENAME);
  try {
    await cp(SOURCE_PATH, destPath);
    const sourceContent = await readFile(SOURCE_PATH, "utf-8");
    const copiedContent = await readFile(destPath, "utf-8");
    expect(copiedContent).toBe(sourceContent);
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

// Regression: ensure the verification content is not empty or whitespace-only

test("verification file content is not empty", async () => {
  const content = await readFile(SOURCE_PATH, "utf-8");
  expect(content.trim().length).toBeGreaterThan(0);
});

test("verification file content matches the exact expected format", async () => {
  const content = await readFile(SOURCE_PATH, "utf-8");
  expect(content).toMatch(/^google-site-verification: [a-z0-9]+\.html$/);
});
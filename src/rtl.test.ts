import { test, expect } from "bun:test";
import { isRtlText, containsRtl } from "./rtl";

test("detects Hebrew text as RTL", () => {
  expect(isRtlText("שלום עולם")).toBe(true);
});

test("detects Arabic text as RTL", () => {
  expect(isRtlText("مرحبا بالعالم")).toBe(true);
});

test("detects English text as LTR", () => {
  expect(isRtlText("Hello world")).toBe(false);
});

test("detects mixed text with majority RTL as RTL", () => {
  expect(isRtlText("שלום hello עולם")).toBe(true);
});

test("detects mixed text with majority LTR as LTR", () => {
  expect(isRtlText("Hello world שלום")).toBe(false);
});

test("returns false for empty string", () => {
  expect(isRtlText("")).toBe(false);
});

test("returns false for whitespace only", () => {
  expect(isRtlText("   \n\t  ")).toBe(false);
});

test("returns false for numbers only", () => {
  expect(isRtlText("12345")).toBe(false);
});

test("returns false for punctuation only", () => {
  expect(isRtlText("!@#$%^&*()")).toBe(false);
});

test("detects Hebrew with numbers as RTL", () => {
  expect(isRtlText("שלום 123 עולם")).toBe(true);
});

test("detects Persian/Farsi text as RTL", () => {
  expect(isRtlText("سلام دنیا")).toBe(true);
});

// containsRtl tests
test("containsRtl returns true for mixed text with any Hebrew", () => {
  expect(containsRtl("Hello world שלום")).toBe(true);
});

test("containsRtl returns false for pure English", () => {
  expect(containsRtl("Hello world")).toBe(false);
});

test("containsRtl returns false for empty string", () => {
  expect(containsRtl("")).toBe(false);
});

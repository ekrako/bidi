import { test, expect, describe } from "bun:test";
import { isRtlText, containsRtl } from "./rtl";

describe("isRtlText", () => {
  test.each([
    ["שלום עולם", true, "Hebrew"],
    ["مرحبا بالعالم", true, "Arabic"],
    ["سلام دنیا", true, "Persian/Farsi"],
    ["שלום 123 עולם", true, "Hebrew with numbers"],
    ["שלום hello עולם", true, "mixed, majority RTL"],
    ["Hello world", false, "English"],
    ["Hello world שלום", false, "mixed, majority LTR"],
    ["", false, "empty string"],
    ["   \n\t  ", false, "whitespace only"],
    ["12345", false, "numbers only"],
    ["!@#$%^&*()", false, "punctuation only"],
    [
      "נראה שמצאתי issue שמתאים בדיוק למה שאנחנו רואים פתוח: https://github.com/llm-d/llm-d-router/issues/1950",
      true,
      "Hebrew sentence ending in a long URL",
    ],
    ["שלום support@example.com עולם", true, "Hebrew with an email address"],
    ["שלום www.example.com/some/long/path", true, "Hebrew with a www URL"],
    [
      "כתבו לנו mailto:support@example.com?subject=hello",
      true,
      "Hebrew with a mailto: link",
    ],
    ["https://github.com/llm-d/llm-d-router/issues/1950", false, "URL only"],
    [
      "שלום (https://example.com/a/long/path) עולם",
      true,
      "Hebrew with a URL wrapped in parentheses",
    ],
    [
      "שלום [support@example.com] עולם",
      true,
      "Hebrew with an email in brackets",
    ],
    [
      "Please open https://github.com/llm-d/llm-d-router/issues/1950 שלום",
      false,
      "English sentence with a URL stays LTR",
    ],
  ])("%s → %s (%s)", (input, expected) => {
    expect(isRtlText(input)).toBe(expected);
  });
});

describe("isRtlText threshold", () => {
  test("uses the configured RTL percentage", () => {
    const text = "שלום hello world";

    expect(isRtlText(text, 20)).toBe(true);
    expect(isRtlText(text, 80)).toBe(false);
  });

  test("treats the threshold as inclusive", () => {
    expect(isRtlText("אבab", 50)).toBe(true);
  });
});

  test.each([
    ["a".repeat(200_000), "a single 200 KB run of letters"],
    ["a.b(c)=d;".repeat(30_000), "a 270 KB punctuation-heavy run"],
  ])("stays fast on %#: %s", (minified) => {
    // Minified inline scripts arrive as one 100 KB+ non-space run. Any regex
    // that can start a token mid-run turns this quadratic: ~10s for the letter
    // run when anchoring was missing, ~20s for the punctuation run when the
    // anchor allowed any non-word character before the token.
    const start = performance.now();
    isRtlText(minified);
    expect(performance.now() - start).toBeLessThan(500);
  });

describe("containsRtl", () => {
  test.each([
    ["Hello world שלום", true, "mixed text with Hebrew"],
    ["Hello world", false, "pure English"],
    ["", false, "empty string"],
  ])("%s → %s (%s)", (input, expected) => {
    expect(containsRtl(input)).toBe(expected);
  });
});

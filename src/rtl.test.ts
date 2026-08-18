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
      "Please open https://github.com/llm-d/llm-d-router/issues/1950 שלום",
      false,
      "English sentence with a URL stays LTR",
    ],
  ])("%s → %s (%s)", (input, expected) => {
    expect(isRtlText(input)).toBe(expected);
  });
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

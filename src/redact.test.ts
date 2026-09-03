import { test, expect } from "bun:test";
import { REDACTED, redactSecrets } from "./redact";

// Fixtures are assembled at runtime so secret scanners don't flag this file.
const GOOGLE_KEY = ["AIza", "Sy", "A".repeat(33)].join("");
const GITHUB_TOKEN = ["ghp", "_", "B".repeat(36)].join("");
const JWT = ["eyJ" + "a".repeat(20), "eyJ" + "b".repeat(20), "c".repeat(20)].join(".");

test("redacts a Google API key embedded in an attribute", () => {
  const html = `<div data-api="${GOOGLE_KEY}" id="tray"></div>`;
  expect(redactSecrets(html)).toBe(`<div data-api="${REDACTED}" id="tray"></div>`);
});

test("redacts every occurrence and multiple token kinds", () => {
  const input = [
    `key=${GOOGLE_KEY}`,
    GITHUB_TOKEN,
    "AKIAIOSFODNN7EXAMPLE",
    "xoxb-123456789012-abcdefghijkl",
    `again=${GOOGLE_KEY}`,
  ].join(" ");
  const out = redactSecrets(input);
  expect(out).not.toContain(GOOGLE_KEY);
  expect(out).not.toContain("ghp_");
  expect(out).not.toContain("AKIA");
  expect(out).not.toContain("xoxb-");
  expect(out.split(REDACTED)).toHaveLength(6);
});

test("redacts Stripe live and test keys", () => {
  const live = ["sk_live_", "C".repeat(24)].join("");
  const test = ["rk_test_", "D".repeat(24)].join("");
  expect(redactSecrets(`${live} ${test}`)).toBe(`${REDACTED} ${REDACTED}`);
});

test("redacts JWTs and PEM private key blocks", () => {
  const pem = "-----BEGIN RSA PRIVATE KEY-----\nMIIEow\nIBAAKC\n-----END RSA PRIVATE KEY-----";
  const out = redactSecrets(`${JWT}\n${pem}`);
  expect(out).toBe(`${REDACTED}\n${REDACTED}`);
});

test("leaves ordinary markup, ids and short tokens alone", () => {
  const html =
    '<div class="AIzaShort" id="gws-plugins" data-ved="2ahUKEwj7xYGH-s-WAxVp8DQHHZCFL1AQ7LoDegQIBBAA">שלום</div>';
  expect(redactSecrets(html)).toBe(html);
});

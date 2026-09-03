import { test, expect } from "bun:test";
import { REDACTED, redactSecrets } from "./redact";

const GOOGLE_KEY = "AIzaSyAlpy4kDC13CDmwQCqYR7-JihW1XXz9vw8";

test("redacts a Google API key embedded in an attribute", () => {
  const html = `<div data-api="${GOOGLE_KEY}" id="tray"></div>`;
  expect(redactSecrets(html)).toBe(`<div data-api="${REDACTED}" id="tray"></div>`);
});

test("redacts every occurrence and multiple token kinds", () => {
  const input = [
    `key=${GOOGLE_KEY}`,
    "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij",
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

test("redacts JWTs and PEM private key blocks", () => {
  const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
  const pem = "-----BEGIN RSA PRIVATE KEY-----\nMIIEow\nIBAAKC\n-----END RSA PRIVATE KEY-----";
  const out = redactSecrets(`${jwt}\n${pem}`);
  expect(out).toBe(`${REDACTED}\n${REDACTED}`);
});

test("leaves ordinary markup, ids and short tokens alone", () => {
  const html =
    '<div class="AIzaShort" id="gws-plugins" data-ved="2ahUKEwj7xYGH-s-WAxVp8DQHHZCFL1AQ7LoDegQIBBAA">שלום</div>';
  expect(redactSecrets(html)).toBe(html);
});

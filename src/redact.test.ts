import { test, expect } from "bun:test";
import { REDACTED, redactSecrets } from "./redact";

// Fixtures are assembled at runtime so secret scanners don't flag this file.
const GOOGLE_KEY = ["AIza", "Sy", "A".repeat(33)].join("");
const GITHUB_TOKEN = ["ghp", "_", "B".repeat(36)].join("");
const JWT = ["eyJ" + "a".repeat(20), "eyJ" + "b".repeat(20), "c".repeat(20)].join(".");
const pemMarker = (kind: "BEGIN" | "END", label = "PRIVATE KEY") =>
  ["-----", kind, " ", label, "-----"].join("");

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
  const pem = `${pemMarker("BEGIN", "RSA PRIVATE KEY")}\nMIIEow\nIBAAKC\n${pemMarker("END", "RSA PRIVATE KEY")}`;
  const out = redactSecrets(`${JWT}\n${pem}`);
  expect(out).toBe(`${REDACTED}\n${REDACTED}`);
});

test("redacts a PEM block whose end marker was truncated away", () => {
  const html = `<pre>${pemMarker("BEGIN")}\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC\nBKcwggSjAgEAAoIBAQ…</pre>`;
  expect(redactSecrets(html)).toBe(`<pre>${REDACTED}</pre>`);
});

test("redacts an encrypted PEM block with metadata headers in full", () => {
  const pem = [
    pemMarker("BEGIN", "RSA PRIVATE KEY"),
    "Proc-Type: 4,ENCRYPTED",
    "DEK-Info: AES-128-CBC,0123456789ABCDEF",
    "",
    "MIIEow",
    pemMarker("END", "RSA PRIVATE KEY"),
  ].join("\n");
  expect(redactSecrets(`<pre>${pem}</pre> after`)).toBe(`<pre>${REDACTED}</pre> after`);
});

test("redacts a truncated encrypted PEM block including its metadata headers", () => {
  const pem = [pemMarker("BEGIN", "RSA PRIVATE KEY"), "Proc-Type: 4,ENCRYPTED", "DEK-Info: AES-128-CBC,0123", "", "MIIEow…"].join("\n");
  expect(redactSecrets(`<pre>${pem}</pre><p>after</p>`)).toBe(`<pre>${REDACTED}</pre><p>after</p>`);
});

test("redacts a truncated PEM block followed by a complete one", () => {
  const truncated = `${pemMarker("BEGIN")}\nMIIEvQ…`;
  const full = `${pemMarker("BEGIN", "EC PRIVATE KEY")}\nMHcCAQ\n${pemMarker("END", "EC PRIVATE KEY")}`;
  expect(redactSecrets(`<a>${truncated}</a><b>${full}</b>`)).toBe(
    `<a>${REDACTED}</a><b>${REDACTED}</b>`,
  );
});

test("stays fast on input full of stray BEGIN markers", () => {
  const input = `${pemMarker("BEGIN")} `.repeat(20_000);
  const started = performance.now();
  const out = redactSecrets(input);
  expect(performance.now() - started).toBeLessThan(2_000);
  expect(out).not.toContain("PRIVATE KEY");
});

test("leaves ordinary markup, ids and short tokens alone", () => {
  const html =
    '<div class="AIzaShort" id="gws-plugins" data-ved="2ahUKEwj7xYGH-s-WAxVp8DQHHZCFL1AQ7LoDegQIBBAA">שלום</div>';
  expect(redactSecrets(html)).toBe(html);
});

/**
 * Strips credential-shaped tokens from text before it leaves the browser or
 * lands in a public GitHub issue.
 *
 * Captured page DOM routinely embeds third-party keys (e.g. Google's own
 * browser API key on google.com), which trips GitHub secret scanning even
 * though the key is not ours. Redacting by shape needs no knowledge of
 * which keys matter; false positives only cost a token in a debug dump.
 */

export const REDACTED = "[REDACTED]";

const SECRET_PATTERNS: readonly RegExp[] = [
  /AIza[0-9A-Za-z_-]{35}/g, // Google API key
  /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g, // GitHub token
  /\bgithub_pat_[A-Za-z0-9_]{22,}\b/g, // GitHub fine-grained PAT
  /\bAKIA[0-9A-Z]{16}\b/g, // AWS access key id
  /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g, // Slack token
  /\bsk-[A-Za-z0-9_-]{20,}\b/g, // OpenAI style secret key
  /\b[sr]k_(?:live|test)_[A-Za-z0-9]{10,}\b/g, // Stripe secret / restricted key
  /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, // JWT
];

const PEM_BEGIN = /-----BEGIN [A-Z ]*PRIVATE KEY-----/g;
const PEM_END = /-----END [A-Z ]*PRIVATE KEY-----/;
// Key material plus the `…` the DOM sanitizer appends when it truncates a
// node. Excludes `-` so it stops at the next BEGIN/END marker.
const PEM_TRUNCATED_BODY = /^[A-Za-z0-9+/=,:\s…]*/;
// Real key blocks are a few KB; bounding the END search keeps a page full of
// stray BEGIN markers from turning redaction quadratic.
const MAX_PEM_CHARS = 16_384;

/**
 * Redacts PEM private key blocks in a single forward pass.
 *
 * A full BEGIN…END block is consumed whole, so encrypted keys with
 * `Proc-Type:` / `DEK-Info:` headers are covered. When the END marker is
 * missing, typically because the DOM sanitizer truncated the node, the header
 * and whatever key material follows it are consumed instead.
 */
function redactPemBlocks(text: string): string {
  let out = "";
  let cursor = 0;
  for (const begin of text.matchAll(PEM_BEGIN)) {
    const start = begin.index;
    if (start < cursor) continue;
    const bodyStart = start + begin[0].length;
    const window = text.slice(bodyStart, bodyStart + MAX_PEM_CHARS);
    const end = PEM_END.exec(window);
    const nextBegin = window.search(PEM_BEGIN);
    const endsThisBlock = end && (nextBegin === -1 || end.index < nextBegin);
    const bodyLength = endsThisBlock
      ? end.index + end[0].length
      : (PEM_TRUNCATED_BODY.exec(window)?.[0].length ?? 0);
    out += text.slice(cursor, start) + REDACTED;
    cursor = bodyStart + bodyLength;
  }
  return out + text.slice(cursor);
}

export function redactSecrets(text: string): string {
  return SECRET_PATTERNS.reduce(
    (acc, pattern) => acc.replace(pattern, REDACTED),
    redactPemBlocks(text),
  );
}

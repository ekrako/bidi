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

/**
 * Token shapes redacted by {@link redactSecrets}. Exported so the DOM
 * sanitizer, which runs inside the page and cannot import this module, can be
 * handed the same patterns via `executeScript` args.
 */
export const SECRET_PATTERNS: readonly RegExp[] = [
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
// Where a block's key material ends: its own END marker (group 1), or, for a
// block the DOM sanitizer truncated, the next PEM marker or the markup that
// follows the node. PEM bodies, including encrypted-key headers, never
// contain these.
const PEM_STOP = /(-----END [A-Z ]*PRIVATE KEY-----)|-----BEGIN [A-Z ]*PRIVATE KEY-----|[<>"']/g;

/**
 * Redacts PEM private key blocks in a single forward pass.
 *
 * Each BEGIN marker is consumed together with everything up to its END
 * marker, so encrypted keys with `Proc-Type:` / `DEK-Info:` headers are
 * covered. A block missing its END marker, typically because the DOM
 * sanitizer truncated the node, is consumed up to the next PEM marker or
 * markup. Every character is scanned once, so the pass is linear.
 */
function redactPemBlocks(text: string): string {
  let out = "";
  let cursor = 0;
  for (const begin of text.matchAll(PEM_BEGIN)) {
    if (begin.index < cursor) continue;
    PEM_STOP.lastIndex = begin.index + begin[0].length;
    const stop = PEM_STOP.exec(text);
    const blockEnd = !stop
      ? text.length
      : stop[1]
        ? stop.index + stop[0].length
        : stop.index;
    out += text.slice(cursor, begin.index) + REDACTED;
    cursor = blockEnd;
  }
  return out + text.slice(cursor);
}

export function redactSecrets(text: string): string {
  return SECRET_PATTERNS.reduce(
    (acc, pattern) => acc.replace(pattern, REDACTED),
    redactPemBlocks(text),
  );
}

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
  // Prefer a full BEGIN…END block (covers encrypted keys with `Proc-Type:` /
  // `DEK-Info:` headers). Without an END marker, which the DOM sanitizer's
  // node truncation can remove, consume the header and any key material.
  /-----BEGIN [A-Z ]*PRIVATE KEY-----(?:[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----|[A-Za-z0-9+/=,:\s…-]*)/g,
];

export function redactSecrets(text: string): string {
  return SECRET_PATTERNS.reduce(
    (acc, pattern) => acc.replace(pattern, REDACTED),
    text,
  );
}

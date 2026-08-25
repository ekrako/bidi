// Hebrew: \u0590-\u05FF, Arabic: \u0600-\u06FF, Arabic Supplement: \u0750-\u077F
// Arabic Extended-A: \u08A0-\u08FF, Persian/Farsi uses Arabic block
const RTL_RE = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;

function isRtlChar(c: number): boolean {
  return (c >= 0x0590 && c <= 0x05FF) || (c >= 0x0600 && c <= 0x06FF) ||
         (c >= 0x0750 && c <= 0x077F) || (c >= 0x08A0 && c <= 0x08FF);
}

function isLtrChar(c: number): boolean {
  return (c >= 0x41 && c <= 0x5A) || (c >= 0x61 && c <= 0x7A) ||
         (c >= 0xC0 && c <= 0x024F);
}

// URLs, emails and other machine tokens are always Latin regardless of the
// prose around them, so counting their letters lets a single link outvote a
// whole Hebrew sentence ("...רואים פתוח: https://github.com/llm-d/llm-d-router"
// scored 39 LTR vs 39 RTL and rendered as LTR). They are direction-neutral
// boilerplate for the reader, so drop them before counting.
//
// The `(?<=^|\s)` lookbehind pins both branches to a token start. Without it the
// email branch (`\S+@…`) retries at every offset inside a long non-space run,
// scanning to the end each time — quadratic, and enough to freeze a page that
// carries a big minified inline script (a 270 KB one on amazon.fr blocked the
// main thread for ~42s). Anchoring on punctuation instead (`(?<=[^\p{L}\p{N}_])`)
// brings that back, since minified code is mostly punctuation: every `.`, `(` and
// `;` becomes another start position.
//
// A leading `[\p{P}\p{S}]*` then lets the scheme branch reach a URL wrapped in
// punctuation ("(https://example.com/a)") without adding start positions.
const NEUTRAL_TOKEN_RE =
  /(?<=^|\s)[\p{P}\p{S}]*(?:(?:[a-z][a-z0-9+.-]*:\/\/|www\.|mailto:)\S+|\S+@[\w-]+(?:\.[\w-]+)+)/giu;

/**
 * True when `text` reads right-to-left, by majority of directional letters.
 *
 * URL and email tokens are stripped before counting, so the returned direction
 * reflects the prose only — offsets in `text` do not map to what was counted.
 */
export function isRtlText(text: string): boolean {
  const prose = text.replace(NEUTRAL_TOKEN_RE, " ");
  let rtl = 0;
  let ltr = 0;

  for (let i = 0; i < prose.length; i++) {
    const c = prose.charCodeAt(i);
    if (isRtlChar(c)) rtl++;
    else if (isLtrChar(c)) ltr++;
  }

  if (rtl === 0 && ltr === 0) return false;
  return rtl > ltr;
}

export function containsRtl(text: string): boolean {
  return RTL_RE.test(text);
}

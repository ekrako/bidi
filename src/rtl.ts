// Hebrew: \u0590-\u05FF, Arabic: \u0600-\u06FF, Arabic Supplement: \u0750-\u077F
// Arabic Extended-A: \u08A0-\u08FF, Persian/Farsi uses Arabic block
const RTL_RE = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
const LTR_RE = /[A-Za-z\u00C0-\u024F]/;

export function isRtlText(text: string): boolean {
  let rtl = 0;
  let ltr = 0;

  for (const char of text) {
    if (RTL_RE.test(char)) rtl++;
    else if (LTR_RE.test(char)) ltr++;
  }

  if (rtl === 0 && ltr === 0) return false;
  return rtl > ltr;
}

export function containsRtl(text: string): boolean {
  return RTL_RE.test(text);
}

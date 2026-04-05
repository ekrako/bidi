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

export function isRtlText(text: string): boolean {
  let rtl = 0;
  let ltr = 0;

  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (isRtlChar(c)) rtl++;
    else if (isLtrChar(c)) ltr++;
  }

  if (rtl === 0 && ltr === 0) return false;
  return rtl > ltr;
}

export function containsRtl(text: string): boolean {
  return RTL_RE.test(text);
}

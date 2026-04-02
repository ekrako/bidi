# Chrome Web Store — Store Assets

This directory contains all materials needed for the Chrome Web Store submission.

## Generating the PNG images

Run the capture script (requires Google Chrome installed):

```sh
bun store-assets/capture.ts
```

Output PNGs land in `store-assets/output/`.

If Chrome is installed in a non-standard location:

```sh
CHROME_PATH="/path/to/Google Chrome" bun store-assets/capture.ts
```

## Files

| File | Purpose |
|------|---------|
| `store-listing.md` | All copy to paste into the Web Store form (name, short/full description, URLs) |
| `promo-440x280.html` | Small promotional tile — 440×280 px |
| `promo-1280x800.html` | Large marquee image — 1280×800 px |
| `screenshot-1-popup.html` | Screenshot 1: Popup UI — 640×400 px |
| `screenshot-2-in-action.html` | Screenshot 2: Extension in action — 1280×800 px |
| `screenshot-3-before-after.html` | Screenshot 3: Before/after comparison — 1280×800 px |
| `capture.ts` | Headless Chrome script to render all HTML → PNG |
| `output/` | Generated PNG files (gitignored) |

## Privacy policy

`docs/privacy.html` is deployed via GitHub Pages at:
https://ekrako.github.io/bidi/privacy.html

## Submission checklist

- [ ] Run `bun store-assets/capture.ts` and verify all 5 PNGs look correct
- [ ] Log in to https://chrome.google.com/webstore/devconsole ($5 one-time fee required)
- [ ] Create a new item and upload `bidi-release.zip` (from the CI release artifact)
- [ ] Fill in the store listing using `store-listing.md`
- [ ] Upload screenshots: `output/screenshot-1.png`, `screenshot-2.png`, `screenshot-3.png`
- [ ] Upload promo tile: `output/promo-small.png` (optional but recommended)
- [ ] Set Privacy Policy URL: `https://ekrako.github.io/bidi/privacy.html`
- [ ] Select category: **Accessibility**
- [ ] Submit for review

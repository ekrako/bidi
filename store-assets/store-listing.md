# Chrome Web Store Listing Content

## Name
BiDi

## Short Description (128 / 132 chars max)
Fix RTL text for Hebrew, Arabic & Persian on any website. Smart auto-detection with per-site settings synced across devices.

## Category
Accessibility

## Language
English

## Detailed Description

BiDi — Smart RTL Direction for Hebrew, Arabic & Persian

Are you typing in Hebrew, Arabic, or Persian and the text appears misaligned? BiDi fixes that.

**The Problem**

Many websites default to left-to-right (LTR) text direction. When you type or read Hebrew (עברית), Arabic (العربية), or Persian (فارسی), text often appears out of place — starting from the wrong side, with punctuation misplaced, or entire paragraphs reversed.

**The Solution**

BiDi adds a small, powerful popup to your browser that lets you fix text direction on any website in one click. Choose from three modes, and BiDi remembers your preference for every future visit.

**Three Modes**

🔘 None — Standard browser behavior. No changes applied.

🔵 Auto (Smart Detection) — The intelligent default. BiDi scans the page for elements containing RTL characters and applies right-to-left direction only to those elements. Everything else stays LTR. Works beautifully on mixed-language pages.

🔵 Full RTL — Forces the entire page to use right-to-left direction. Ideal for websites that are primarily in Hebrew or Arabic.

**Key Features**

✅ Per-site memory — Set your preference once per website. BiDi remembers it and applies it automatically on every future visit.

✅ Synced across devices — Your settings sync across all your Chrome instances via your Google account. Configure it once, works everywhere.

✅ Dynamic content support — BiDi handles single-page apps (React, Vue, Angular) and dynamically loaded content using MutationObserver. Works on ChatGPT, Claude, WhatsApp Web, Gmail, and more.

✅ Auto by default — Enable the "Auto by default" option to automatically apply smart RTL detection on every new website you visit — no manual setup required.

✅ Zero performance impact — Lightweight, no third-party dependencies. Written in TypeScript with performance in mind.

**Supported Languages**

- Hebrew (עברית) — Unicode U+0590–U+05FF
- Arabic (العربية) — Unicode U+0600–U+06FF
- Persian / Farsi (فارسی) — Unicode Arabic Extended range
- Any language using RTL Unicode character ranges

**Permissions Explained**

• storage — Saves and syncs your per-site direction settings
• activeTab, tabs — Reads the current tab's hostname to show the correct setting in the popup
• scripting — Injects the direction-fixing logic into page content
• All URLs — Required to work on any website you visit

**Privacy**

BiDi collects no personal data. Your per-site settings are stored using Chrome's built-in chrome.storage.sync API (synced via your Google account). No analytics, no tracking, no external servers contacted. Full privacy policy: https://bidi.krakovsky.info/privacy.html

**Open Source**

BiDi is MIT licensed and fully open source. View the source code, report issues, or contribute at https://github.com/ekrako/bidi

---

## URLs

| Field            | Value                                      |
|------------------|--------------------------------------------|
| Homepage         | https://bidi.krakovsky.info/               |
| Privacy Policy   | https://bidi.krakovsky.info/privacy.html   |
| Support          | https://github.com/ekrako/bidi/issues      |

---

## Screenshots Needed (Chrome Web Store requirements)

Minimum 1, maximum 5. Size: 1280×800 or 640×400 px (PNG or JPEG).

| File                          | Dimensions | Description                              |
|-------------------------------|------------|------------------------------------------|
| output/screenshot-1.png       | 640×400    | BiDi popup showing the three mode buttons |
| output/screenshot-2.png       | 1280×800   | Extension in action on a Hebrew page      |
| output/screenshot-3.png       | 1280×800   | Before / after RTL alignment comparison   |

## Promotional Images

| File                    | Dimensions | Required? |
|-------------------------|------------|-----------|
| output/promo-small.png  | 440×280    | Optional (featured placement) |
| output/promo-large.png  | 1280×800   | Optional (marquee / hero)     |

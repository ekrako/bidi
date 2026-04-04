import { getSiteMode, type DirectionMode } from "./storage";
import { containsRtl, isRtlText } from "./rtl";

export const MARKER = "data-bidi";
const MARKER_SELECTOR = `[${MARKER}]`;
const INLINE_TAGS = new Set([
  "SPAN",
  "B",
  "I",
  "EM",
  "STRONG",
  "A",
  "CODE",
  "ABBR",
  "CITE",
  "SMALL",
  "SUB",
  "SUP",
  "MARK",
  "S",
  "U",
  "BUTTON",
  "LABEL",
  "BR",
  "IMG",
  "INPUT",
  "SELECT",
  "TEXTAREA",
  "SVG",
  "TIME",
  "Q",
  "KBD",
  "VAR",
  "SAMP",
  "DFN",
  "BDO",
  "BDI",
  "DEL",
  "INS",
  "DATA",
  "OUTPUT",
  "RUBY",
  "WBR",
]);

let currentMode: DirectionMode = "none";
let observer: MutationObserver | null = null;

function markElement(
  el: HTMLElement,
  prop: "direction" | "unicodeBidi",
  value: string,
) {
  if (el.style[prop] !== value) el.style[prop] = value;
  if (!el.hasAttribute(MARKER)) el.setAttribute(MARKER, "");
}

function unmarkElement(el: HTMLElement) {
  el.style.direction = "";
  el.style.unicodeBidi = "";
  el.removeAttribute(MARKER);
}

export function getInlineText(el: HTMLElement): string {
  let text = "";
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent || "";
    } else if (child instanceof HTMLElement && INLINE_TAGS.has(child.tagName)) {
      text += child.textContent || "";
    }
  }
  return text;
}

function getDirectText(el: HTMLElement): string {
  let text = "";
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) text += child.textContent || "";
  }
  return text;
}

export function applyRtlToElement(el: HTMLElement) {
  if (INLINE_TAGS.has(el.tagName)) {
    // Only check direct text — descendant inline elements are handled by the
    // tree walker individually. Using el.textContent would mark wrappers like
    // <span><b>שלום</b> hello</span> based on the inner <b>'s text.
    const text = getDirectText(el);
    if (containsRtl(text) && !el.parentElement?.closest(MARKER_SELECTOR)) {
      markElement(el, "unicodeBidi", "plaintext");
    } else if (el.hasAttribute(MARKER)) {
      unmarkElement(el);
    }
    return;
  }

  const text = getInlineText(el);
  if (text.trim().length === 0) {
    if (el.hasAttribute(MARKER)) unmarkElement(el);
    return;
  }

  if (isRtlText(text)) {
    markElement(el, "direction", "rtl");
  } else if (el.hasAttribute(MARKER)) {
    unmarkElement(el);
  }
}

export function scanForRtl(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node: Node | null = walker.currentNode;
  while (node) {
    if (node instanceof HTMLElement) {
      applyRtlToElement(node);
    }
    node = walker.nextNode();
  }
}

function nearestBlock(el: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = el;
  while (current && INLINE_TAGS.has(current.tagName)) {
    current = current.parentElement;
  }
  return current;
}

function startObserver() {
  if (observer) return;
  observer = new MutationObserver((mutations) => {
    const blocksToUpdate = new Set<HTMLElement>();

    for (const mutation of mutations) {
      if (mutation.type === "characterData") {
        const parent = mutation.target.parentElement;
        if (parent) {
          // Apply directly to inline parents only; blocks are handled in the
          // loop below where hadMarker is captured before any mutations.
          if (INLINE_TAGS.has(parent.tagName)) applyRtlToElement(parent);
          const block = nearestBlock(parent);
          if (block) blocksToUpdate.add(block);
        }
        continue;
      }
      // Scan added subtrees individually (avoids full-container rescan)
      for (const node of Array.from(mutation.addedNodes)) {
        if (node instanceof HTMLElement) scanForRtl(node);
      }
      // Re-evaluate the containing block's own direction
      if (mutation.target instanceof HTMLElement) {
        const block = nearestBlock(mutation.target);
        if (block) blocksToUpdate.add(block);
      }
    }

    // Only re-evaluate each block's direction; full rescan only if it flips
    for (const block of blocksToUpdate) {
      const hadMarker = block.hasAttribute(MARKER);
      applyRtlToElement(block);
      if (hadMarker !== block.hasAttribute(MARKER)) {
        scanForRtl(block);
      }
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

function stopObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

export function clearAutoDirection() {
  document
    .querySelectorAll<HTMLElement>(MARKER_SELECTOR)
    .forEach(unmarkElement);
}

function applyMode(mode: DirectionMode) {
  const prev = currentMode;
  currentMode = mode;

  if (prev === "rtl") {
    document.documentElement.style.direction = "";
  }
  if (prev === "auto") {
    stopObserver();
    clearAutoDirection();
  }

  if (mode === "rtl") {
    document.documentElement.style.direction = "rtl";
    return;
  }
  if (mode === "auto") {
    if (document.body) {
      scanForRtl(document.body);
      startObserver();
      return;
    }
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        scanForRtl(document.body);
        startObserver();
      },
      { once: true },
    );
  }
}

async function init() {
  const mode = await getSiteMode(location.hostname);
  applyMode(mode);
}

chrome.storage.onChanged.addListener(async (_changes, area) => {
  if (area !== "sync") return;
  const mode = await getSiteMode(location.hostname);
  applyMode(mode);
});

init();

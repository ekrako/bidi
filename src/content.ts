import { getSiteMode, type DirectionMode } from "./storage";
import { containsRtl } from "./rtl";

const MARKER = "data-bidi";

let currentMode: DirectionMode = "none";
let observer: MutationObserver | null = null;

function getDirectText(el: HTMLElement): string {
  let text = "";
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    }
  }
  return text;
}

function applyRtlToElement(el: HTMLElement) {
  const directText = getDirectText(el);
  const text = directText.trim().length > 0
    ? directText
    : el.children.length === 0
      ? el.textContent || ""
      : "";
  if (text.trim().length === 0) return;

  if (containsRtl(text)) {
    // unicode-bidi: plaintext lets the browser determine direction per-line
    // based on first strong character — handles mixed RTL/LTR content correctly
    el.style.unicodeBidi = "plaintext";
    el.setAttribute(MARKER, "");
  } else if (el.hasAttribute(MARKER)) {
    el.style.unicodeBidi = "";
    el.removeAttribute(MARKER);
  }
}

function scanForRtl(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node: Node | null = walker.currentNode;
  while (node) {
    if (node instanceof HTMLElement) {
      applyRtlToElement(node);
    }
    node = walker.nextNode();
  }
}

function startObserver() {
  if (observer) return;
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData") {
        const parent = mutation.target.parentElement;
        if (parent) applyRtlToElement(parent);
        continue;
      }
      for (const node of Array.from(mutation.addedNodes)) {
        if (node instanceof HTMLElement) {
          applyRtlToElement(node);
          scanForRtl(node);
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

function stopObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

function clearAutoDirection() {
  document.querySelectorAll<HTMLElement>(`[${MARKER}]`).forEach((el) => {
    el.style.unicodeBidi = "";
    el.removeAttribute(MARKER);
  });
}

function applyMode(mode: DirectionMode) {
  const prev = currentMode;
  currentMode = mode;

  // Clean up previous mode
  if (prev === "rtl") {
    document.documentElement.style.direction = "";
  }
  if (prev === "auto") {
    stopObserver();
    clearAutoDirection();
  }

  // Apply new mode
  if (mode === "rtl") {
    document.documentElement.style.direction = "rtl";
  } else if (mode === "auto") {
    if (document.body) {
      scanForRtl(document.body);
      startObserver();
    } else {
      document.addEventListener("DOMContentLoaded", () => {
        scanForRtl(document.body);
        startObserver();
      }, { once: true });
    }
  }
}

async function init() {
  const mode = await getSiteMode(location.hostname);
  applyMode(mode);
}

chrome.storage.onChanged.addListener(async () => {
  const mode = await getSiteMode(location.hostname);
  applyMode(mode);
});

init();

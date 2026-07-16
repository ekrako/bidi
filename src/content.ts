import {
  getSiteMode,
  getBreakerConfig,
  DEFAULT_BREAKER_CONFIG,
  type DirectionMode,
  type BreakerConfig,
} from "./storage";
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

/** True when `el` is a contenteditable host. Only the values the HTML spec
 * treats as editable count — `""`, `"true"`, `"plaintext-only"`. Other values
 * ("false", "inherit", garbage) do not by themselves establish a host. */
function isEditableHost(el: HTMLElement): boolean {
  const attr = el.getAttribute("contenteditable");
  if (attr === null) return false;
  const value = attr.toLowerCase();
  return value === "" || value === "true" || value === "plaintext-only";
}

/**
 * True when `el` is within the DOM owned by a contenteditable editor. Rich
 * editors (ProseMirror, Lexical, Slate) normalize their own DOM and fight
 * foreign attribute/style changes, so Auto mode must leave their subtrees
 * untouched entirely.
 *
 * We skip an element if *any* ancestor is an editable host. A
 * `contenteditable="false"` island nested inside an editor is still skipped
 * (it's editor-managed DOM), which keeps this consistent with `scanForRtl`'s
 * subtree pruning; a standalone `contenteditable="false"` element with no
 * editable ancestor is treated as normal content. Falls back to
 * `el.isContentEditable` when no ancestor is an editable host — that flag is
 * unreliable outside real browsers (e.g. happy-dom returns false) and, in a
 * browser, catches inherited editability via `designMode`.
 */
export function isInsideEditable(el: HTMLElement | null): boolean {
  for (let cur = el; cur; cur = cur.parentElement) {
    if (isEditableHost(cur)) return true;
  }
  return el?.isContentEditable === true;
}

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

/** Concatenated text of `el`, excluding any contenteditable subtrees at any
 * depth — editor-owned text must not influence direction detection. */
function textExcludingEditable(el: HTMLElement): string {
  if (isEditableHost(el)) return "";
  let text = "";
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) text += child.textContent || "";
    else if (child instanceof HTMLElement) text += textExcludingEditable(child);
  }
  return text;
}

export function getInlineText(el: HTMLElement): string {
  let text = "";
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent || "";
    } else if (child instanceof HTMLElement && INLINE_TAGS.has(child.tagName)) {
      text += textExcludingEditable(child);
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

/** Remove BiDi's marker/styles from `el` and any marked descendants. */
function clearMarkers(el: HTMLElement) {
  if (el.hasAttribute(MARKER)) unmarkElement(el);
  el.querySelectorAll<HTMLElement>(MARKER_SELECTOR).forEach(unmarkElement);
}

export function applyRtlToElement(el: HTMLElement) {
  if (isInsideEditable(el)) {
    // The subtree may have been marked before it became editable; strip our
    // styles so stale RTL doesn't linger inside an editor we no longer touch.
    clearMarkers(el);
    return;
  }
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
  if (root instanceof HTMLElement && isInsideEditable(root)) {
    // The root may carry markers from before it became editor-owned (e.g. a
    // marked node reinserted into an editor); strip them instead of bailing.
    clearMarkers(root);
    return;
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => {
      if (node instanceof HTMLElement && isEditableHost(node)) {
        // Strip markers a prior injection may have left inside this editor
        // before pruning the subtree.
        clearMarkers(node);
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
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

function mutationTarget(mutation: MutationRecord): HTMLElement | null {
  const node =
    mutation.type === "characterData"
      ? mutation.target.parentElement
      : mutation.target;
  return node instanceof HTMLElement ? node : null;
}

function reactToMutations(mutations: MutationRecord[]) {
  const blocksToUpdate = new Set<HTMLElement>();

  for (const mutation of mutations) {
    // A contenteditable attribute flipped: strip stale markers if the element
    // just became editor-owned, or (re)scan it if it became normal content.
    if (mutation.type === "attributes") {
      const target = mutation.target;
      if (target instanceof HTMLElement) {
        if (isInsideEditable(target)) {
          clearMarkers(target);
          // If it's an inline editor, its text no longer counts toward the
          // parent block's direction — recompute that block.
          const block = nearestBlock(target);
          if (block && !isInsideEditable(block)) blocksToUpdate.add(block);
        } else {
          scanForRtl(target);
          // Editing may have changed the text; re-evaluate the enclosing block.
          const block = nearestBlock(target);
          if (block) blocksToUpdate.add(block);
        }
      }
      continue;
    }

    // Editors own their DOM and handle bidi natively; ignoring their mutations
    // also breaks the observer↔editor feedback loop at the source.
    if (isInsideEditable(mutationTarget(mutation))) {
      // Nodes reparented into editor DOM must shed any markers they carried in.
      if (mutation.type !== "characterData") {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node instanceof HTMLElement) clearMarkers(node);
        }
      }
      continue;
    }

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
}

// ---------- circuit breaker ----------
// Defense-in-depth: even with editable regions skipped, any future DOM-fighting
// feedback cycle could starve the event loop. The signal we key on is exactly
// that starvation, not a callback rate: a MutationObserver feedback loop runs as
// chained microtasks, so no macrotask can run until it stops. We post a message
// through a MessageChannel as a "yield beacon"; while it stays pending, callbacks
// are firing back-to-back without the event loop yielding, so we count them and
// trip once the burst exceeds maxCallbacks. The moment the loop yields, the
// beacon is delivered and the count resets — so a legitimately busy page
// (ticker, streaming response) that yields between mutations never trips, at any
// rate. A MessageChannel is used rather than setTimeout because background tabs
// clamp/throttle timers (which would starve a false yield signal and mis-trip),
// whereas port messages are delivered promptly whenever the loop is free. On
// trip we disconnect, warn, and back off, disabling permanently after repeated
// trips. The initial full scan is exempt (not routed through onMutations).

let breakerConfig: BreakerConfig = { ...DEFAULT_BREAKER_CONFIG };
let callbacksSinceYield = 0;
let tripCount = 0;
let breakerDisabled = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let yieldPending = false;
let yieldChannel: MessageChannel | null = null;

export function setBreakerConfig(config: BreakerConfig) {
  breakerConfig = { ...config };
}

function clearReconnect() {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleYieldBeacon() {
  if (yieldPending) return;
  yieldPending = true;
  if (!yieldChannel) {
    yieldChannel = new MessageChannel();
    yieldChannel.port1.onmessage = () => {
      yieldPending = false;
      callbacksSinceYield = 0;
    };
  }
  yieldChannel.port2.postMessage(0);
}

export function resetBreaker() {
  clearReconnect();
  yieldPending = false;
  callbacksSinceYield = 0;
  tripCount = 0;
  breakerDisabled = false;
}

function overBudget(): boolean {
  callbacksSinceYield += 1;
  // Delivered only once the event loop drains its microtasks — i.e. the callback
  // chain actually yielded. A starving feedback loop never lets it through.
  scheduleYieldBeacon();
  return callbacksSinceYield > breakerConfig.maxCallbacks;
}

function tripBreaker() {
  tripCount += 1;
  stopObserver();
  // Start the post-cooldown reconnect with a fresh count so a lingering value
  // can't re-trip on the first callback.
  yieldPending = false;
  callbacksSinceYield = 0;
  console.warn(
    `[BiDi] Auto mode observer tripped circuit breaker (${tripCount}/${breakerConfig.maxTrips}); backing off.`,
  );
  if (tripCount >= breakerConfig.maxTrips) {
    breakerDisabled = true;
    console.warn(
      "[BiDi] Auto mode disabled for this page after repeated observer overload.",
    );
    return;
  }
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (breakerDisabled) return;
    // Catch up on anything added while disconnected before resuming. A mode
    // switch away from Auto cancels this timer (via stopObserver), so reaching
    // here means Auto is still active.
    if (document.body) scanForRtl(document.body);
    startObserver();
  }, breakerConfig.cooldownMs);
}

/** Observer callback: breaker gate first, then the reaction. Exposed for tests. */
export function onMutations(mutations: MutationRecord[]) {
  if (overBudget()) {
    tripBreaker();
    return;
  }
  reactToMutations(mutations);
}

export function isObserving(): boolean {
  return observer !== null;
}

export function startObserver() {
  if (observer || breakerDisabled) return;
  observer = new MutationObserver(onMutations);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    // Only contenteditable toggles — our own writes (style/data-bidi) are not
    // in this filter, so marking never re-triggers the observer.
    attributes: true,
    attributeFilter: ["contenteditable"],
  });
}

export function stopObserver() {
  clearReconnect();
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
  // No transition: nothing to tear down or re-apply. Critically, this preserves
  // an in-flight breaker cooldown when an unrelated sync-storage change fires
  // while the site is still in Auto mode.
  if (mode === prev) return;
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
    // Reached only on a real transition into Auto (same-mode calls return
    // early), so a fresh page/session starts with a clean breaker.
    resetBreaker();
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
  setBreakerConfig(await getBreakerConfig());
  const mode = await getSiteMode(location.hostname);
  applyMode(mode);
}

chrome.storage.onChanged.addListener(async (_changes, area) => {
  if (area !== "sync") return;
  setBreakerConfig(await getBreakerConfig());
  const mode = await getSiteMode(location.hostname);
  applyMode(mode);
});

init();

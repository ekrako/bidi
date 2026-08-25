import {
  getSiteMode,
  getBreakerConfig,
  DEFAULT_BREAKER_CONFIG,
  STORAGE_KEY,
  DEFAULT_KEY,
  BREAKER_KEY,
  DEFAULT_RTL_THRESHOLD,
  getSiteRtlThreshold,
  rtlThresholdKey,
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

// List containers hold their text in block children (e.g. `<li><p>…</p></li>`),
// so getInlineText sees nothing and they'd never be marked — leaving the marker
// (bullet/number) on the LTR side while the inner block reads RTL. Detect these
// from their full descendant text instead.
const LIST_TAGS = new Set(["UL", "OL", "LI"]);

// Tags whose text is never rendered as prose. Their content (minified JS/CSS,
// JSON payloads) is pure cost for direction detection — and on script-heavy
// sites it is hundreds of KB per element.
const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEMPLATE",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "CANVAS",
  "AUDIO",
  "VIDEO",
]);

let currentMode: DirectionMode = "none";
let currentRtlThreshold = DEFAULT_RTL_THRESHOLD;
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
 * `el.isContentEditable` when no ancestor is an editable host. That flag is the
 * only signal for document-wide editability via `document.designMode = "on"`,
 * where no element carries a `contenteditable` attribute yet the whole document
 * is editable; the attribute walk alone would miss it. The flag is unreliable
 * outside real browsers (e.g. happy-dom returns false regardless of
 * `designMode`), so the attribute walk is the primary path and this fallback
 * only adds coverage where the flag is trustworthy.
 */
export function isInsideEditable(el: HTMLElement | null): boolean {
  for (let cur = el; cur; cur = cur.parentElement) {
    if (isEditableHost(cur)) return true;
  }
  return el?.isContentEditable === true;
}

function markElement(
  el: HTMLElement,
  prop: "direction" | "unicodeBidi" | "textAlign",
  value: string,
) {
  if (el.style[prop] !== value) el.style[prop] = value;
  if (!el.hasAttribute(MARKER)) el.setAttribute(MARKER, "");
}

function unmarkElement(el: HTMLElement) {
  el.style.direction = "";
  el.style.unicodeBidi = "";
  el.style.textAlign = "";
  el.removeAttribute(MARKER);
}

/** Concatenated text of `el`, excluding contenteditable subtrees and non-prose
 * elements (`SKIP_TAGS`) at any depth — neither editor-owned text nor script or
 * style source must influence direction detection. */
function textExcludingEditable(el: HTMLElement): string {
  if (isEditableHost(el) || SKIP_TAGS.has(el.tagName)) return "";
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

export function applyRtlToElement(
  el: HTMLElement,
  rtlThreshold = currentRtlThreshold,
) {
  if (SKIP_TAGS.has(el.tagName)) return;
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

  const text = LIST_TAGS.has(el.tagName)
    ? textExcludingEditable(el)
    : getInlineText(el);
  if (text.trim().length === 0) {
    if (el.hasAttribute(MARKER)) unmarkElement(el);
    return;
  }

  const marked = el.hasAttribute(MARKER);

  if (isRtlText(text, rtlThreshold)) {
    markElement(el, "direction", "rtl");
    // `direction:rtl` alone does not override a site's explicit
    // `text-align:left` (e.g. MUI/markdown CSS): runs reorder but the block
    // stays left-aligned. Force alignment so RTL content hugs the right.
    markElement(el, "textAlign", "right");
    return;
  }

  // LTR-dominant text that the *site itself* forced to RTL (a `dir="rtl"`
  // attribute, or an inline `direction:rtl` we didn't write). Some apps set this
  // per-paragraph off the first strong char (Hebrew), which mangles an
  // English-dominant sentence. Correct it back to LTR. We only touch the
  // element's own marking — never inherited direction — so legitimate RTL
  // containers are left alone.
  //
  // Applying the correction overwrites an inline `direction:rtl` with our
  // `ltr`, erasing the original site signal. So our own prior LTR correction
  // (MARKER + inline `direction:ltr`) is itself treated as evidence the site
  // forced RTL — otherwise a re-scan would unmark it and never re-detect the
  // override. `!marked && direction === "rtl"` still excludes our stale *rtl*
  // marker (RTL→LTR flip), which must be unmarked rather than corrected.
  const siteForcesRtl =
    el.getAttribute("dir")?.toLowerCase() === "rtl" ||
    (!marked && el.style.direction === "rtl") ||
    (marked && el.style.direction === "ltr");
  if (siteForcesRtl) {
    markElement(el, "direction", "ltr");
    markElement(el, "textAlign", "left");
  } else if (marked) {
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
      if (node instanceof HTMLElement && SKIP_TAGS.has(node.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }
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

/**
 * All circuit-breaker state and transitions in one place: config, the
 * non-yielding burst counter, trip/cooldown/permanent-disable lifecycle, and the
 * MessageChannel yield beacon. The observer wiring only asks `shouldProcess()`.
 */
class MutationBreaker {
  private config: BreakerConfig = { ...DEFAULT_BREAKER_CONFIG };
  private callbacksSinceYield = 0;
  private tripCount = 0;
  private disabled = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private yieldPending = false;
  private yieldChannel: MessageChannel | null = null;

  setConfig(config: BreakerConfig) {
    this.config = { ...config };
  }

  isDisabled(): boolean {
    return this.disabled;
  }

  /** Full reset for a fresh page/session: clears counters, cooldown, and the
   * permanent-disable flag. */
  reset() {
    this.rearm();
    this.disabled = false;
  }

  /** Re-arm on a mode transition into Auto: clear counters and any pending
   * cooldown, but PRESERVE a permanent disable. A per-page trip-out must survive
   * mode toggling (auto→rtl→auto) so it can't be bypassed — this matches the
   * "disabled for this page" warning. A page reload constructs a fresh instance. */
  rearm() {
    this.cancel();
    this.yieldPending = false;
    this.callbacksSinceYield = 0;
    this.tripCount = 0;
  }

  /** Cancel a pending cooldown reconnect (e.g. when the observer is stopped). */
  cancel() {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /** Breaker gate for the observer callback: false means skip this batch (either
   * permanently disabled, or the trip that just happened). */
  shouldProcess(): boolean {
    if (this.disabled) return false;
    if (!this.overBudget()) return true;
    this.trip();
    return false;
  }

  private scheduleYieldBeacon() {
    if (this.yieldPending) return;
    this.yieldPending = true;
    if (!this.yieldChannel) {
      this.yieldChannel = new MessageChannel();
      this.yieldChannel.port1.onmessage = () => {
        this.yieldPending = false;
        this.callbacksSinceYield = 0;
      };
    }
    this.yieldChannel.port2.postMessage(0);
  }

  private overBudget(): boolean {
    this.callbacksSinceYield += 1;
    // Delivered only once the event loop drains its microtasks — i.e. the
    // callback chain actually yielded. A starving feedback loop never lets it
    // through.
    this.scheduleYieldBeacon();
    return this.callbacksSinceYield > this.config.maxCallbacks;
  }

  private trip() {
    this.tripCount += 1;
    stopObserver();
    // Start the post-cooldown reconnect with a fresh count so a lingering value
    // can't re-trip on the first callback.
    this.yieldPending = false;
    this.callbacksSinceYield = 0;
    console.warn(
      `[BiDi] Auto mode observer tripped circuit breaker (${this.tripCount}/${this.config.maxTrips}); backing off.`,
    );
    if (this.tripCount >= this.config.maxTrips) {
      this.disabled = true;
      console.warn(
        "[BiDi] Auto mode disabled for this page after repeated observer overload.",
      );
      return;
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.disabled) return;
      // Catch up on anything added while disconnected before resuming. A mode
      // switch away from Auto cancels this timer (via stopObserver), so reaching
      // here means Auto is still active.
      if (document.body) scanForRtl(document.body);
      startObserver();
    }, this.config.cooldownMs);
  }
}

const breaker = new MutationBreaker();

export function setBreakerConfig(config: BreakerConfig) {
  breaker.setConfig(config);
}

/** Full breaker reset (fresh page/session): also clears a permanent disable. */
export function resetBreaker() {
  breaker.reset();
}

/** Re-arm the breaker on a transition into Auto, preserving a permanent disable. */
export function rearmBreaker() {
  breaker.rearm();
}

/** Observer callback: breaker gate first, then the reaction. Exposed for tests. */
export function onMutations(mutations: MutationRecord[]) {
  if (!breaker.shouldProcess()) return;
  reactToMutations(mutations);
}

export function isObserving(): boolean {
  return observer !== null;
}

export function startObserver() {
  if (observer || breaker.isDisabled()) return;
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
  breaker.cancel();
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
    // early). Re-arm — not full reset — so a page that already tripped out
    // permanently can't be revived by toggling modes.
    rearmBreaker();
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
  const [mode, rtlThreshold] = await Promise.all([
    getSiteMode(location.hostname),
    getSiteRtlThreshold(location.hostname),
  ]);
  currentRtlThreshold = rtlThreshold;
  applyMode(mode);
}

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "sync") return;
  // Only do the async work each key actually depends on: breaker config reloads
  // on the breaker key; mode re-evaluates on the site map or the default toggle.
  if (BREAKER_KEY in changes) setBreakerConfig(await getBreakerConfig());
  if (rtlThresholdKey(location.hostname) in changes) {
    currentRtlThreshold = await getSiteRtlThreshold(location.hostname);
    if (currentMode === "auto" && document.body) scanForRtl(document.body);
  }
  if (STORAGE_KEY in changes || DEFAULT_KEY in changes) {
    applyMode(await getSiteMode(location.hostname));
  }
});

init();

/**
 * Client-side "Report an issue" flow.
 *
 * Captures the active tab's URL and full DOM, bundles it with the extension
 * version and browser user-agent, and POSTs it to the BiDi report backend
 * (a Cloudflare Worker holding a GitHub token). The Worker opens a GitHub
 * issue and returns its URL.
 */

// Configured after deploying worker/ — see worker/README.md.
export const REPORT_ENDPOINT = "https://bidi-report.ekrako.workers.dev/report";

export interface ReportPayload {
  url: string;
  dom: string;
  version: string;
  userAgent: string;
  /** Optional free-text description of what isn't working. */
  description?: string;
}

export interface ReportResult {
  issueUrl: string;
}

/**
 * Runs in the page context to grab a serialized, diagnosis-oriented copy of
 * the DOM.
 *
 * Raw `outerHTML` on an app like Gemini is ~2 MB, almost all of it inline
 * script/JSON, so the backend's size cap used to leave nothing but `<head>`.
 * This keeps what BiDi is debugged from — structure, `dir`/`style`/`class`,
 * our own markers, a sample of the text — and drops the rest.
 *
 * Self-contained by necessity: it is serialized and injected into the page,
 * so it cannot reference anything in module scope.
 */
export function grabSanitizedHtml(): string {
  const DROPPED_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "TEMPLATE",
    "SVG",
    "CANVAS",
    "LINK",
    "META",
    "PICTURE",
    "SOURCE",
    "IFRAME",
    "AUDIO",
    "VIDEO",
  ]);
  // Attributes worth keeping in full; everything else is length-capped.
  const KEPT_ATTRS = new Set([
    "dir",
    "lang",
    "style",
    "class",
    "id",
    "type",
    "role",
    "contenteditable",
    "data-bidi",
  ]);
  const MAX_ATTR_CHARS = 200;
  const MAX_TEXT_CHARS = 200;

  const clone = document.documentElement.cloneNode(true) as Element;

  const walk = (el: Element): void => {
    for (const child of Array.from(el.children)) {
      if (DROPPED_TAGS.has(child.tagName.toUpperCase())) {
        child.remove();
        continue;
      }
      walk(child);
    }

    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (KEPT_ATTRS.has(name)) continue;
      if (attr.value.length > MAX_ATTR_CHARS) {
        el.setAttribute(attr.name, `${attr.value.slice(0, MAX_ATTR_CHARS)}…`);
      }
    }

    for (const node of Array.from(el.childNodes)) {
      const text = node.nodeType === 3 ? (node.nodeValue ?? "") : "";
      if (text.length > MAX_TEXT_CHARS) {
        node.nodeValue = `${text.slice(0, MAX_TEXT_CHARS)}…`;
      }
    }
  };

  walk(clone);
  return clone.outerHTML;
}

export async function collectDom(tabId: number): Promise<string> {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: grabSanitizedHtml,
  });
  return injection?.result ?? "";
}

export async function submitReport(
  payload: ReportPayload,
  endpoint: string = REPORT_ENDPOINT,
): Promise<ReportResult> {
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`Report failed (${resp.status}): ${detail || resp.statusText}`);
  }

  const data = (await resp.json()) as Partial<ReportResult>;
  if (!data.issueUrl) throw new Error("Report backend returned no issue URL");
  return { issueUrl: data.issueUrl };
}

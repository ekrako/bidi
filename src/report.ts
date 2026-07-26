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
}

export interface ReportResult {
  issueUrl: string;
}

/** Runs in the page context to grab the serialized DOM. */
function grabOuterHtml(): string {
  return document.documentElement.outerHTML;
}

export async function collectDom(tabId: number): Promise<string> {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: grabOuterHtml,
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

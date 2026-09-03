/**
 * BiDi "Report an issue" backend.
 *
 * A Cloudflare Worker that receives a report from the extension popup and
 * opens a GitHub issue on its behalf, keeping the GitHub token server-side.
 *
 * POST /report  { url, dom, version, userAgent, description? } -> { issueUrl }
 */

import { redactSecrets } from "../src/redact";

export interface Env {
  /** GitHub token with `repo`/`issues` write scope (Worker secret). */
  GITHUB_TOKEN: string;
  /** Repo owner. Defaults to "ekrako". */
  GITHUB_OWNER?: string;
  /** Repo name. Defaults to "bidi". */
  GITHUB_REPO?: string;
  /** Allowed CORS origin, e.g. chrome-extension://<id>. Defaults to "*". */
  ALLOWED_ORIGIN?: string;
}

interface ReportPayload {
  url: string;
  dom: string;
  version: string;
  userAgent: string;
  description?: string;
}

// GitHub caps issue bodies at 65536 chars; leave room for surrounding markdown.
const MAX_DOM_CHARS = 55000;
const MAX_DESCRIPTION_CHARS = 2000;

function corsHeaders(env: Env): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(body: unknown, status: number, env: Env): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(env) },
  });
}

function isReportPayload(value: unknown): value is ReportPayload {
  const v = value as Record<string, unknown>;
  return (
    typeof v?.url === "string" &&
    typeof v?.dom === "string" &&
    typeof v?.version === "string" &&
    typeof v?.userAgent === "string" &&
    (v?.description === undefined || typeof v?.description === "string")
  );
}

/**
 * Bounds the DOM from the middle: head-only truncation on a big SPA keeps
 * `<head>` and drops every element the report is about.
 */
function boundDom(dom: string): string {
  if (dom.length <= MAX_DOM_CHARS) return dom;

  const marker = (dropped: number) => `\n… [truncated ${dropped} chars]\n`;
  // `dropped` is always shorter than `dom.length`, so reserving on the latter
  // keeps the joined result within the cap.
  const budget = MAX_DOM_CHARS - marker(dom.length).length;
  const head = Math.floor(budget / 3);
  const tail = budget - head;
  return `${dom.slice(0, head)}${marker(dom.length - budget)}${dom.slice(-tail)}`;
}

function buildIssueBody(p: ReportPayload): string {
  // Redact here too: reports from extension versions that predate client-side
  // redaction still flow through this Worker. Redact before truncating, since
  // a token cut at a truncation boundary no longer matches its pattern.
  const dom = boundDom(redactSecrets(p.dom));

  const description = p.description
    ? redactSecrets(p.description.trim()).slice(0, MAX_DESCRIPTION_CHARS)
    : undefined;
  const url = redactSecrets(p.url);

  return [
    "**Reported via the BiDi extension.**",
    "",
    ...(description ? ["**What's not working:**", "", description, ""] : []),
    `- **URL:** ${url}`,
    `- **Extension version:** ${p.version}`,
    `- **User agent:** ${p.userAgent}`,
    "",
    "<details><summary>Page DOM at report time</summary>",
    "",
    "```html",
    dom,
    "```",
    "",
    "</details>",
  ].join("\n");
}

async function createIssue(env: Env, p: ReportPayload): Promise<string> {
  const owner = env.GITHUB_OWNER || "ekrako";
  const repo = env.GITHUB_REPO || "bidi";
  const hostname = (() => {
    try {
      return new URL(p.url).hostname;
    } catch {
      return redactSecrets(p.url);
    }
  })();

  const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "bidi-report-worker",
    },
    body: JSON.stringify({
      title: `[Report] ${hostname}`,
      body: buildIssueBody(p),
      labels: ["user-report"],
    }),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`GitHub API ${resp.status}: ${detail}`);
  }

  const issue = (await resp.json()) as { html_url?: string };
  if (!issue.html_url) throw new Error("GitHub API returned no issue URL");
  return issue.html_url;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    const { pathname } = new URL(request.url);
    if (request.method !== "POST" || pathname !== "/report") {
      return json({ error: "Not found" }, 404, env);
    }

    if (!env.GITHUB_TOKEN) {
      return json({ error: "Backend not configured" }, 500, env);
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400, env);
    }

    if (!isReportPayload(payload)) {
      return json({ error: "Missing required fields" }, 400, env);
    }

    try {
      const issueUrl = await createIssue(env, payload);
      return json({ issueUrl }, 201, env);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return json({ error: message }, 502, env);
    }
  },
};

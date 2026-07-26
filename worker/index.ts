/**
 * BiDi "Report an issue" backend.
 *
 * A Cloudflare Worker that receives a report from the extension popup and
 * opens a GitHub issue on its behalf, keeping the GitHub token server-side.
 *
 * POST /report  { url, dom, version, userAgent } -> { issueUrl }
 */

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
}

// GitHub caps issue bodies at 65536 chars; leave room for surrounding markdown.
const MAX_DOM_CHARS = 55000;

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
    typeof v?.userAgent === "string"
  );
}

function buildIssueBody(p: ReportPayload): string {
  const dom =
    p.dom.length > MAX_DOM_CHARS
      ? `${p.dom.slice(0, MAX_DOM_CHARS)}\n… [truncated ${p.dom.length - MAX_DOM_CHARS} chars]`
      : p.dom;

  return [
    "**Reported via the BiDi extension.**",
    "",
    `- **URL:** ${p.url}`,
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
      return p.url;
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

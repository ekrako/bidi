import { test, expect, afterEach } from "bun:test";
import worker, { type Env } from "./index";

const originalFetch = globalThis.fetch;

const env: Env = {
  GITHUB_TOKEN: "token",
  GITHUB_OWNER: "ekrako",
  GITHUB_REPO: "bidi",
};

const validBody = {
  url: "https://example.com/page",
  dom: "<html><body>hello</body></html>",
  version: "1.2.3",
  userAgent: "test-agent",
};

function post(body: unknown): Request {
  return new Request("https://worker/report", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("OPTIONS returns CORS preflight", async () => {
  const resp = await worker.fetch(
    new Request("https://worker/report", { method: "OPTIONS" }),
    env,
  );
  expect(resp.status).toBe(204);
  expect(resp.headers.get("Access-Control-Allow-Methods")).toContain("POST");
});

test("unknown path returns 404", async () => {
  const resp = await worker.fetch(
    new Request("https://worker/nope", { method: "POST" }),
    env,
  );
  expect(resp.status).toBe(404);
});

test("missing token returns 500", async () => {
  const resp = await worker.fetch(post(validBody), { ...env, GITHUB_TOKEN: "" });
  expect(resp.status).toBe(500);
});

test("invalid JSON returns 400", async () => {
  const resp = await worker.fetch(post("not json"), env);
  expect(resp.status).toBe(400);
});

test("missing fields returns 400", async () => {
  const resp = await worker.fetch(post({ url: "https://x" }), env);
  expect(resp.status).toBe(400);
});

test("valid report creates an issue and returns its URL", async () => {
  let captured: { url: string; body: unknown } | null = null;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    captured = { url, body: JSON.parse(init.body as string) };
    return new Response(
      JSON.stringify({ html_url: "https://github.com/ekrako/bidi/issues/7" }),
      { status: 201 },
    );
  }) as unknown as typeof fetch;

  const resp = await worker.fetch(post(validBody), env);
  expect(resp.status).toBe(201);
  expect(await resp.json()).toEqual({
    issueUrl: "https://github.com/ekrako/bidi/issues/7",
  });

  expect(captured!.url).toBe("https://api.github.com/repos/ekrako/bidi/issues");
  const issue = captured!.body as { title: string; body: string };
  expect(issue.title).toBe("[Report] example.com");
  expect(issue.body).toContain("https://example.com/page");
  expect(issue.body).toContain("1.2.3");
  expect(issue.body).toContain("hello");
});

test("includes the user description in the issue body", async () => {
  let issue: { body: string } | null = null;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    issue = JSON.parse(init.body as string);
    return new Response(JSON.stringify({ html_url: "https://gh/issues/9" }), {
      status: 201,
    });
  }) as unknown as typeof fetch;

  await worker.fetch(
    post({ ...validBody, description: "Headings render LTR" }),
    env,
  );
  expect(issue!.body).toContain("What's not working");
  expect(issue!.body).toContain("Headings render LTR");
});

test("trims surrounding whitespace from the description", async () => {
  let issue: { body: string } | null = null;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    issue = JSON.parse(init.body as string);
    return new Response(JSON.stringify({ html_url: "https://gh/issues/11" }), {
      status: 201,
    });
  }) as unknown as typeof fetch;

  await worker.fetch(post({ ...validBody, description: "  text  " }), env);
  expect(issue!.body).toContain("**What's not working:**\n\ntext\n");
  expect(issue!.body).not.toContain("  text  ");
});

test("omits the section for a whitespace-only description", async () => {
  let issue: { body: string } | null = null;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    issue = JSON.parse(init.body as string);
    return new Response(JSON.stringify({ html_url: "https://gh/issues/12" }), {
      status: 201,
    });
  }) as unknown as typeof fetch;

  await worker.fetch(post({ ...validBody, description: "   \n  " }), env);
  expect(issue!.body).not.toContain("What's not working");
});

test("bounds an oversized description", async () => {
  let issue: { body: string } | null = null;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    issue = JSON.parse(init.body as string);
    return new Response(JSON.stringify({ html_url: "https://gh/issues/10" }), {
      status: 201,
    });
  }) as unknown as typeof fetch;

  await worker.fetch(post({ ...validBody, description: "d".repeat(5000) }), env);
  expect(issue!.body).toContain("d".repeat(2000));
  expect(issue!.body).not.toContain("d".repeat(2001));
});

test("rejects a non-string description", async () => {
  const resp = await worker.fetch(post({ ...validBody, description: 5 }), env);
  expect(resp.status).toBe(400);
});

test("truncates very large DOM", async () => {
  let issue: { body: string } | null = null;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    issue = JSON.parse(init.body as string);
    return new Response(JSON.stringify({ html_url: "https://gh/issues/8" }), {
      status: 201,
    });
  }) as unknown as typeof fetch;

  const huge = "x".repeat(60000);
  await worker.fetch(post({ ...validBody, dom: huge }), env);
  expect(issue!.body).toContain("truncated");
  expect(issue!.body.length).toBeLessThan(60000);
});

test("keeps the end of an oversized DOM, not just its head", async () => {
  let issue: { body: string } | null = null;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    issue = JSON.parse(init.body as string);
    return new Response(JSON.stringify({ html_url: "https://gh/issues/13" }), {
      status: 201,
    });
  }) as unknown as typeof fetch;

  const huge = `<html><head>HEAD_MARKER${"x".repeat(60000)}BODY_MARKER</body></html>`;
  await worker.fetch(post({ ...validBody, dom: huge }), env);
  expect(issue!.body).toContain("HEAD_MARKER");
  expect(issue!.body).toContain("BODY_MARKER");
  expect(issue!.body).toContain("truncated");
});

test("GitHub API failure returns 502", async () => {
  globalThis.fetch = (async () =>
    new Response("rate limited", { status: 403 })) as unknown as typeof fetch;

  const resp = await worker.fetch(post(validBody), env);
  expect(resp.status).toBe(502);
});

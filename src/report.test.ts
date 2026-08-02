import { test, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
  collectDom,
  grabSanitizedHtml,
  submitReport,
  type ReportPayload,
} from "./report";

GlobalRegistrator.register({ url: "https://test.example.com" });

afterAll(async () => {
  await GlobalRegistrator.unregister();
});

const originalFetch = globalThis.fetch;

let executeScriptCalls: unknown[] = [];
const mockChrome = {
  scripting: {
    executeScript: async (injection: unknown) => {
      executeScriptCalls.push(injection);
      return [{ result: "<html><body>hi</body></html>" }];
    },
  },
};

(globalThis as Record<string, unknown>).chrome = mockChrome;

const payload: ReportPayload = {
  url: "https://example.com/page",
  dom: "<html></html>",
  version: "1.2.3",
  userAgent: "test-agent",
};

beforeEach(() => {
  executeScriptCalls = [];
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("collectDom injects into the tab and returns outerHTML", async () => {
  const dom = await collectDom(42);
  expect(dom).toBe("<html><body>hi</body></html>");
  expect(executeScriptCalls).toHaveLength(1);
  expect((executeScriptCalls[0] as { target: { tabId: number } }).target.tabId).toBe(42);
});

test("grabSanitizedHtml drops script and style content", () => {
  document.documentElement.innerHTML = `<head><style>.a{color:red}</style></head><body><script>var payload = "secret"</script><p dir="rtl">שלום</p></body>`;

  const html = grabSanitizedHtml();
  expect(html).not.toContain("secret");
  expect(html).not.toContain("color:red");
  expect(html).toContain('dir="rtl"');
  expect(html).toContain("שלום");
});

test("grabSanitizedHtml keeps direction-relevant attributes in full", () => {
  document.documentElement.innerHTML = `<body><div dir="ltr" style="direction: ltr; text-align: left;" data-bidi="" class="${"c".repeat(300)}">x</div></body>`;

  const html = grabSanitizedHtml();
  expect(html).toContain('dir="ltr"');
  expect(html).toContain("direction: ltr; text-align: left;");
  expect(html).toContain('data-bidi=""');
  expect(html).toContain("c".repeat(300));
});

test("grabSanitizedHtml caps other attributes and long text", () => {
  document.documentElement.innerHTML = `<body><div jsdata="${"j".repeat(500)}">${"t".repeat(500)}</div></body>`;

  const html = grabSanitizedHtml();
  expect(html).toContain(`${"j".repeat(200)}…`);
  expect(html).not.toContain("j".repeat(201));
  expect(html).toContain(`${"t".repeat(200)}…`);
  expect(html).not.toContain("t".repeat(201));
});

test("grabSanitizedHtml leaves the live document untouched", () => {
  document.documentElement.innerHTML = `<body><script>var keep = 1</script><p>${"t".repeat(400)}</p></body>`;

  grabSanitizedHtml();
  expect(document.querySelector("script")).not.toBeNull();
  expect(document.querySelector("p")!.textContent).toHaveLength(400);
});

test("submitReport POSTs the payload and returns the issue URL", async () => {
  let captured: { url: string; body: string } | null = null;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    captured = { url, body: init.body as string };
    return new Response(JSON.stringify({ issueUrl: "https://gh/issues/1" }), {
      status: 201,
    });
  }) as unknown as typeof fetch;

  const result = await submitReport(payload, "https://backend/report");
  expect(result.issueUrl).toBe("https://gh/issues/1");
  expect(captured!.url).toBe("https://backend/report");
  expect(JSON.parse(captured!.body)).toEqual(payload);
});

test("submitReport forwards an optional description", async () => {
  let captured: { body: string } | null = null;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    captured = { body: init.body as string };
    return new Response(JSON.stringify({ issueUrl: "https://gh/issues/2" }), {
      status: 201,
    });
  }) as unknown as typeof fetch;

  await submitReport(
    { ...payload, description: "text stays LTR" },
    "https://backend/report",
  );
  expect(JSON.parse(captured!.body).description).toBe("text stays LTR");
});

test("submitReport throws on non-OK response", async () => {
  globalThis.fetch = (async () =>
    new Response("boom", { status: 502 })) as unknown as typeof fetch;

  await expect(submitReport(payload, "https://backend/report")).rejects.toThrow(
    /502/,
  );
});

test("submitReport throws when backend omits issueUrl", async () => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({}), { status: 201 })) as unknown as typeof fetch;

  await expect(submitReport(payload, "https://backend/report")).rejects.toThrow(
    /no issue URL/,
  );
});

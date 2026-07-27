import { test, expect, beforeEach, afterEach } from "bun:test";
import { collectDom, submitReport, type ReportPayload } from "./report";

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

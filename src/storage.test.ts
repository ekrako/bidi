import { test, expect, beforeEach } from "bun:test";
import {
  getSiteMode,
  setSiteMode,
  getAutoByDefault,
  setAutoByDefault,
  type DirectionMode,
} from "./storage";

// Mock chrome.storage.sync
let store: Record<string, unknown> = {};

const mockChrome = {
  storage: {
    sync: {
      get: async (keys: string | string[]) => {
        if (Array.isArray(keys)) {
          const result: Record<string, unknown> = {};
          for (const k of keys) result[k] = store[k];
          return result;
        }
        return { [keys]: store[keys] };
      },
      set: async (items: Record<string, unknown>) => {
        Object.assign(store, items);
      },
    },
  },
};

(globalThis as Record<string, unknown>).chrome = mockChrome;

beforeEach(() => {
  store = {};
});

test("returns 'auto' for unknown site", async () => {
  expect(await getSiteMode("example.com")).toBe("auto");
});

test("returns stored mode for known site", async () => {
  store.sites = { "claude.ai": "rtl" };
  expect(await getSiteMode("claude.ai")).toBe("rtl");
});

test("sets mode for a site", async () => {
  await setSiteMode("claude.ai", "rtl");
  expect(store.sites).toEqual({ "claude.ai": "rtl" });
});

test("updates existing mode", async () => {
  await setSiteMode("claude.ai", "rtl");
  await setSiteMode("claude.ai", "none");
  expect((store.sites as Record<string, DirectionMode>)["claude.ai"]).toBe(
    "none",
  );
});

test("removes site when set to 'none' and autoByDefault is off", async () => {
  await setAutoByDefault(false);
  await setSiteMode("claude.ai", "rtl");
  await setSiteMode("claude.ai", "none");
  expect(store.sites).toEqual({});
});

test("preserves other sites when updating one", async () => {
  await setSiteMode("claude.ai", "rtl");
  await setSiteMode("chatgpt.com", "none");
  expect(store.sites).toEqual({
    "claude.ai": "rtl",
    "chatgpt.com": "none",
  });
});

test("returns 'auto' for unknown site when autoByDefault is on", async () => {
  await setAutoByDefault(true);
  expect(await getSiteMode("example.com")).toBe("auto");
});

test("returns 'none' for unknown site when autoByDefault is off", async () => {
  await setAutoByDefault(false);
  expect(await getSiteMode("example.com")).toBe("none");
});

test("explicit site mode overrides autoByDefault", async () => {
  await setAutoByDefault(false);
  await setSiteMode("example.com", "rtl");
  expect(await getSiteMode("example.com")).toBe("rtl");
});

test("getAutoByDefault returns true by default", async () => {
  expect(await getAutoByDefault()).toBe(true);
});

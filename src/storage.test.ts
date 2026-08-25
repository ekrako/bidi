import { test, expect, beforeEach } from "bun:test";
import {
  getSiteMode,
  setSiteMode,
  getAutoByDefault,
  setAutoByDefault,
  getBreakerConfig,
  DEFAULT_BREAKER_CONFIG,
  DEFAULT_RTL_THRESHOLD,
  getSiteRtlThreshold,
  setSiteRtlThreshold,
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

test("getBreakerConfig returns defaults when unset", async () => {
  expect(await getBreakerConfig()).toEqual(DEFAULT_BREAKER_CONFIG);
});

test("getBreakerConfig applies stored overrides", async () => {
  store.breaker = { maxCallbacks: 10, cooldownMs: 100, maxTrips: 2 };
  expect(await getBreakerConfig()).toEqual({
    maxCallbacks: 10,
    cooldownMs: 100,
    maxTrips: 2,
  });
});

test("getBreakerConfig falls back per-field for invalid values", async () => {
  store.breaker = { maxCallbacks: 42, cooldownMs: "nope", maxTrips: 0 };
  expect(await getBreakerConfig()).toEqual({
    maxCallbacks: 42,
    cooldownMs: DEFAULT_BREAKER_CONFIG.cooldownMs,
    maxTrips: DEFAULT_BREAKER_CONFIG.maxTrips,
  });
});

test("getBreakerConfig falls back for negative and non-finite values", async () => {
  store.breaker = { maxCallbacks: -5, cooldownMs: Infinity, maxTrips: NaN };
  expect(await getBreakerConfig()).toEqual(DEFAULT_BREAKER_CONFIG);
});

test("getBreakerConfig defaults fields that are absent from a partial override", async () => {
  store.breaker = { maxCallbacks: 7 };
  expect(await getBreakerConfig()).toEqual({
    maxCallbacks: 7,
    cooldownMs: DEFAULT_BREAKER_CONFIG.cooldownMs,
    maxTrips: DEFAULT_BREAKER_CONFIG.maxTrips,
  });
});

test("returns the default RTL threshold for an unknown site", async () => {
  expect(await getSiteRtlThreshold("example.com")).toBe(DEFAULT_RTL_THRESHOLD);
});

test("stores RTL thresholds independently per site", async () => {
  await setSiteRtlThreshold("claude.ai", 35);
  await setSiteRtlThreshold("chatgpt.com", 60);

  expect(await getSiteRtlThreshold("claude.ai")).toBe(35);
  expect(await getSiteRtlThreshold("chatgpt.com")).toBe(60);
});

test("falls back when a stored RTL threshold is invalid", async () => {
  store.rtlThresholds = {
    "too-low.example": 0,
    "too-high.example": 101,
    "not-a-number.example": "50",
  };

  expect(await getSiteRtlThreshold("too-low.example")).toBe(DEFAULT_RTL_THRESHOLD);
  expect(await getSiteRtlThreshold("too-high.example")).toBe(DEFAULT_RTL_THRESHOLD);
  expect(await getSiteRtlThreshold("not-a-number.example")).toBe(DEFAULT_RTL_THRESHOLD);
});

test("rejects an out-of-range RTL threshold", async () => {
  expect(setSiteRtlThreshold("example.com", 0)).rejects.toThrow(
    "RTL threshold must be between 1 and 100",
  );
});

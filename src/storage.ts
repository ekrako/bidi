export type DirectionMode = "none" | "rtl" | "auto";

export const STORAGE_KEY = "sites";
export const DEFAULT_KEY = "autoByDefault";
export const BREAKER_KEY = "breaker";

/** Circuit-breaker thresholds for the Auto-mode MutationObserver. */
export interface BreakerConfig {
  /** Max observer callbacks in one non-yielding burst before tripping. */
  maxCallbacks: number;
  /** Back-off before reconnecting after a trip, in milliseconds. */
  cooldownMs: number;
  /** Trips on a page before the observer stays disconnected permanently. */
  maxTrips: number;
}

export const DEFAULT_BREAKER_CONFIG: BreakerConfig = {
  maxCallbacks: 300,
  cooldownMs: 5000,
  maxTrips: 3,
};

function coercePositive(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

/**
 * Read breaker thresholds from storage, falling back to defaults for any
 * missing or invalid field. Lets the thresholds be tuned via
 * chrome.storage.sync without a release.
 */
export async function getBreakerConfig(): Promise<BreakerConfig> {
  const result = await chrome.storage.sync.get(BREAKER_KEY);
  const stored = (result[BREAKER_KEY] ?? {}) as Partial<BreakerConfig>;
  return {
    maxCallbacks: coercePositive(
      stored.maxCallbacks,
      DEFAULT_BREAKER_CONFIG.maxCallbacks,
    ),
    cooldownMs: coercePositive(
      stored.cooldownMs,
      DEFAULT_BREAKER_CONFIG.cooldownMs,
    ),
    maxTrips: coercePositive(stored.maxTrips, DEFAULT_BREAKER_CONFIG.maxTrips),
  };
}

export async function getAutoByDefault(): Promise<boolean> {
  const result = await chrome.storage.sync.get(DEFAULT_KEY);
  return result[DEFAULT_KEY] !== false;
}

export async function setAutoByDefault(enabled: boolean): Promise<void> {
  await chrome.storage.sync.set({ [DEFAULT_KEY]: enabled });
}

export async function getSiteMode(hostname: string): Promise<DirectionMode> {
  const result = await chrome.storage.sync.get([STORAGE_KEY, DEFAULT_KEY]);
  const sites = (result[STORAGE_KEY] ?? {}) as Record<string, DirectionMode>;
  if (hostname in sites) return sites[hostname]!;
  return result[DEFAULT_KEY] !== false ? "auto" : "none";
}

export async function setSiteMode(
  hostname: string,
  mode: DirectionMode,
): Promise<void> {
  const result = await chrome.storage.sync.get([STORAGE_KEY, DEFAULT_KEY]);
  const sites = (result[STORAGE_KEY] ?? {}) as Record<string, DirectionMode>;
  const autoDefault = result[DEFAULT_KEY] !== false;

  if (mode === "none" && !autoDefault) {
    delete sites[hostname];
  } else {
    sites[hostname] = mode;
  }

  await chrome.storage.sync.set({ [STORAGE_KEY]: sites });
}

export type DirectionMode = "none" | "rtl" | "auto";

const STORAGE_KEY = "sites";
const DEFAULT_KEY = "autoByDefault";

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

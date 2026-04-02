import { getSiteMode } from "./storage";

const BADGE_BG = "#8B0000";
const BADGE_FG = "#FFFFFF";

const iconCache: Record<number, ImageBitmap> = {};

async function getIcon(size: number): Promise<ImageBitmap> {
  if (!iconCache[size]) {
    const file = size <= 16 ? "icons/logo-16.png" : "icons/logo-32.png";
    const resp = await fetch(chrome.runtime.getURL(file));
    const blob = await resp.blob();
    iconCache[size] = await createImageBitmap(blob);
  }
  return iconCache[size]!;
}

const BADGE_COLORS: Record<string, string> = {
  RTL: "#8B0000",
  AUT: "#006400",
};

function renderIcon(icon: ImageBitmap, size: number, label: string | null): ImageData {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d")!;

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(icon, 0, 0, size, size);

  if (label) {
    const badgeH = Math.round(size * 0.625);
    const badgeY = size - badgeH;
    const radius = 0 //Math.round(8 * (size / 32));

    ctx.fillStyle = BADGE_COLORS[label] ?? BADGE_BG;
    ctx.beginPath();
    ctx.roundRect(0, badgeY, size, badgeH, [radius, radius, 0, 0]);
    ctx.fill();

    const fontSize = Math.round(13 * (size / 32));
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillStyle = BADGE_FG;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(label, size / 2, badgeY + badgeH / 2);
  }

  // Remove antialiasing: threshold alpha
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  for (let i = 3; i < data.length; i += 4) {
    data[i] = data[i]! > 127 ? 255 : 0;
  }
  return imageData;
}

async function updateIcon(tabId: number, url: string | undefined) {
  if (!url) return;
  try {
    const hostname = new URL(url).hostname;
    const mode = await getSiteMode(hostname);
    const label = mode === "none" ? null : mode === "auto" ? "AUT" : "RTL";

    const [icon16, icon32] = await Promise.all([getIcon(16), getIcon(32)]);
    const img16 = renderIcon(icon16, 16, label);
    const img32 = renderIcon(icon32, 32, label);

    chrome.action.setIcon({ tabId, imageData: { "16": img16, "32": img32 } });
    chrome.action.setBadgeText({ tabId, text: "" });
  } catch {
    // ignore invalid URLs (chrome://, etc.)
  }
}

// Re-inject content script into all existing tabs on extension startup/reload
chrome.runtime.onInstalled.addListener(async () => {
  const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  for (const tab of tabs) {
    if (tab.id) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      }).catch(() => {
        // ignore tabs where injection isn't allowed
      });
      updateIcon(tab.id, tab.url);
    }
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  updateIcon(tabId, tab.url);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    updateIcon(tabId, tab.url);
  }
});

chrome.storage.onChanged.addListener(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id && tab.url) {
    updateIcon(tab.id, tab.url);
  }
});

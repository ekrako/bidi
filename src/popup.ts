import {
  getSiteMode,
  setSiteMode,
  getAutoByDefault,
  setAutoByDefault,
  type DirectionMode,
} from "./storage";

const MODES: DirectionMode[] = ["none", "auto", "rtl"];

async function getActiveTabHostname(): Promise<string | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return null;
  try {
    return new URL(tab.url).hostname;
  } catch {
    return null;
  }
}

async function init() {
  const hostname = await getActiveTabHostname();
  const hostnameEl = document.getElementById("hostname") as HTMLSpanElement;
  const buttonsEl = document.getElementById("buttons") as HTMLDivElement;

  if (!hostname) {
    hostnameEl.textContent = "N/A";
    return;
  }

  hostnameEl.textContent = hostname;
  const currentMode = await getSiteMode(hostname);

  const autoDefaultEl = document.getElementById("autoDefault") as HTMLInputElement;
  autoDefaultEl.checked = await getAutoByDefault();
  autoDefaultEl.addEventListener("change", async () => {
    await setAutoByDefault(autoDefaultEl.checked);
  });

  for (const mode of MODES) {
    const btn = document.createElement("button");
    btn.textContent = mode === "rtl" ? "FULL RTL" : mode.toUpperCase();
    btn.className = mode === currentMode ? "active" : "";
    btn.addEventListener("click", async () => {
      await setSiteMode(hostname, mode);
      buttonsEl.querySelectorAll("button").forEach((b) => {
        const label = mode === "rtl" ? "FULL RTL" : mode.toUpperCase();
          b.className = b.textContent === label ? "active" : "";
      });

      // Content script picks up changes via chrome.storage.onChanged
    });
    buttonsEl.appendChild(btn);
  }
}

init();

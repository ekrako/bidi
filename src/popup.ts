import {
  getSiteMode,
  setSiteMode,
  getAutoByDefault,
  setAutoByDefault,
  type DirectionMode,
} from "./storage";
import { collectDom, submitReport } from "./report";

const MODES: DirectionMode[] = ["none", "auto", "rtl"];

async function getActiveTab(): Promise<{ id?: number; url?: string } | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

function hostnameOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function setupReport() {
  const btn = document.getElementById("reportBtn") as HTMLButtonElement;
  const status = document.getElementById("reportStatus") as HTMLDivElement;
  const desc = document.getElementById("reportDesc") as HTMLTextAreaElement;
  document.getElementById("version")!.textContent =
    chrome.runtime.getManifest().version;

  btn.addEventListener("click", async () => {
    // First click reveals the description field; second click submits.
    if (desc.style.display !== "block") {
      desc.style.display = "block";
      desc.focus();
      btn.textContent = "Submit report";
      return;
    }

    btn.disabled = true;
    status.className = "";
    status.textContent = "Collecting page…";
    try {
      const tab = await getActiveTab();
      if (!tab?.id || !tab.url) throw new Error("No active tab to report");

      const dom = await collectDom(tab.id);
      status.textContent = "Creating issue…";
      const description = desc.value.trim();
      const { issueUrl } = await submitReport({
        url: tab.url,
        dom,
        version: chrome.runtime.getManifest().version,
        userAgent: navigator.userAgent,
        ...(description ? { description } : {}),
      });

      status.className = "ok";
      status.textContent = "Issue created — opening…";
      await chrome.tabs.create({ url: issueUrl });
    } catch (err) {
      status.className = "error";
      status.textContent =
        err instanceof Error ? err.message : "Failed to report issue";
    } finally {
      btn.disabled = false;
    }
  });
}

async function init() {
  setupReport();

  const tab = await getActiveTab();
  const hostname = hostnameOf(tab?.url);
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

type SaveThreshold = (threshold: number) => Promise<void>;

export function setupThresholdControl(
  input: HTMLInputElement,
  output: HTMLOutputElement,
  saveThreshold: SaveThreshold,
  debounceMs = 150,
): void {
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let hasPendingSave = false;

  const save = () => {
    const threshold = Number(input.value);
    hasPendingSave = false;
    saveThreshold(threshold).catch((error: unknown) => {
      console.error("Failed to save RTL threshold", error);
    });
  };

  input.addEventListener("input", () => {
    output.value = `${input.value}%`;
    hasPendingSave = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, debounceMs);
  });

  input.addEventListener("change", () => {
    clearTimeout(saveTimer);
    save();
  });

  window.addEventListener("pagehide", () => {
    if (!hasPendingSave) return;
    clearTimeout(saveTimer);
    save();
  });
}

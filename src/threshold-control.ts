type SaveThreshold = (threshold: number) => Promise<void>;

export function setupThresholdControl(
  input: HTMLInputElement,
  output: HTMLOutputElement,
  saveThreshold: SaveThreshold,
  debounceMs = 150,
): void {
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let hasPendingSave = false;
  let stateVersion = 0;

  const save = () => {
    const threshold = Number(input.value);
    const saveVersion = ++stateVersion;
    hasPendingSave = true;
    saveThreshold(threshold).then(
      () => {
        if (stateVersion === saveVersion) hasPendingSave = false;
      },
      (error: unknown) => {
        console.error("Failed to save RTL threshold", error);
      },
    );
  };

  input.addEventListener("input", () => {
    output.value = `${input.value}%`;
    stateVersion += 1;
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

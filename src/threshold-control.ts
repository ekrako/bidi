type SaveThreshold = (threshold: number) => Promise<void>;

export function setupThresholdControl(
  input: HTMLInputElement,
  output: HTMLOutputElement,
  saveThreshold: SaveThreshold,
  debounceMs = 150,
): void {
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let saveQueue = Promise.resolve();

  const save = () => {
    const threshold = Number(input.value);
    saveQueue = saveQueue
      .then(() => saveThreshold(threshold))
      .catch((error: unknown) => {
        console.error("Failed to save RTL threshold", error);
      });
  };

  input.addEventListener("input", () => {
    output.value = `${input.value}%`;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, debounceMs);
  });

  input.addEventListener("change", () => {
    clearTimeout(saveTimer);
    save();
  });
}

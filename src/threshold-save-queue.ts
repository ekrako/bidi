type SaveThreshold = (hostname: string, threshold: number) => Promise<void>;

export function createThresholdSaveQueue(
  saveThreshold: SaveThreshold,
): SaveThreshold {
  const hostnameQueues = new Map<string, Promise<void>>();

  return (hostname, threshold) => {
    const previousSave = hostnameQueues.get(hostname) ?? Promise.resolve();
    const startSave = () => saveThreshold(hostname, threshold);
    const currentSave = previousSave.then(startSave, startSave);
    hostnameQueues.set(hostname, currentSave);

    const clearCompletedQueue = () => {
      if (hostnameQueues.get(hostname) === currentSave) {
        hostnameQueues.delete(hostname);
      }
    };
    void currentSave.then(clearCompletedQueue, clearCompletedQueue);

    return currentSave;
  };
}

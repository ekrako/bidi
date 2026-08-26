import { expect, test } from "bun:test";
import { createThresholdSaveQueue } from "./threshold-save-queue";

test("persists thresholds for one hostname in input order", async () => {
  const started: number[] = [];
  const completions: Array<() => void> = [];
  let persistedThreshold: number | undefined;
  const enqueue = createThresholdSaveQueue(
    (_hostname, threshold) =>
      new Promise<void>((resolve) => {
        started.push(threshold);
        completions.push(() => {
          persistedThreshold = threshold;
          resolve();
        });
      }),
  );

  const firstSave = enqueue("example.com", 20);
  const secondSave = enqueue("example.com", 23);
  await Promise.resolve();

  expect(started).toEqual([20]);
  completions[0]!();
  await firstSave;
  await Promise.resolve();
  expect(started).toEqual([20, 23]);

  completions[1]!();
  await secondSave;
  expect(persistedThreshold).toBe(23);
});

test("continues a hostname queue after a failed save", async () => {
  const attempted: number[] = [];
  const enqueue = createThresholdSaveQueue(async (_hostname, threshold) => {
    attempted.push(threshold);
    if (threshold === 20) throw new Error("storage unavailable");
  });

  await expect(enqueue("example.com", 20)).rejects.toThrow(
    "storage unavailable",
  );
  await enqueue("example.com", 23);

  expect(attempted).toEqual([20, 23]);
});

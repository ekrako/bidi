import { afterAll, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { setupThresholdControl } from "./threshold-control";

GlobalRegistrator.register({ url: "https://test.example.com" });

afterAll(async () => {
  await GlobalRegistrator.unregister();
});

describe("setupThresholdControl", () => {
  test("updates the label and saves after input settles", async () => {
    const input = document.createElement("input");
    const output = document.createElement("output");
    input.value = "23";
    const saved: number[] = [];

    setupThresholdControl(input, output, async (threshold) => {
      saved.push(threshold);
    }, 0);
    input.dispatchEvent(new Event("input"));
    await Bun.sleep(5);

    expect(output.value).toBe("23%");
    expect(saved).toEqual([23]);
  });

  test("saves the final value immediately on change", async () => {
    const input = document.createElement("input");
    const output = document.createElement("output");
    input.value = "35";
    const saved: number[] = [];

    setupThresholdControl(input, output, async (threshold) => {
      saved.push(threshold);
    });
    input.dispatchEvent(new Event("change"));
    await Promise.resolve();

    expect(saved).toEqual([35]);
  });

  test("flushes pending input when the popup closes", async () => {
    const input = document.createElement("input");
    const output = document.createElement("output");
    input.value = "23";
    const saved: number[] = [];

    setupThresholdControl(input, output, async (threshold) => {
      saved.push(threshold);
    }, 1000);
    input.dispatchEvent(new Event("input"));
    window.dispatchEvent(new Event("pagehide"));
    await Promise.resolve();

    expect(saved).toEqual([23]);
  });

  test("flushes teardown value without waiting for an earlier save", async () => {
    const input = document.createElement("input");
    const output = document.createElement("output");
    const saved: number[] = [];
    const unresolved = new Promise<void>(() => {});

    setupThresholdControl(input, output, async (threshold) => {
      saved.push(threshold);
      if (threshold === 20) await unresolved;
    }, 0);

    input.value = "20";
    input.dispatchEvent(new Event("input"));
    await Bun.sleep(5);
    input.value = "23";
    input.dispatchEvent(new Event("input"));
    window.dispatchEvent(new Event("pagehide"));
    await Promise.resolve();

    expect(saved).toEqual([20, 23]);
  });

  test("retries a failed save when the popup closes", async () => {
    const input = document.createElement("input");
    const output = document.createElement("output");
    const saved: number[] = [];
    const originalConsoleError = console.error;
    console.error = () => {};

    try {
      setupThresholdControl(input, output, async (threshold) => {
        saved.push(threshold);
        if (saved.length === 1) throw new Error("storage unavailable");
      }, 0);

      input.value = "23";
      input.dispatchEvent(new Event("input"));
      await Bun.sleep(5);
      window.dispatchEvent(new Event("pagehide"));
      await Promise.resolve();

      expect(saved).toEqual([23, 23]);
    } finally {
      console.error = originalConsoleError;
    }
  });
});

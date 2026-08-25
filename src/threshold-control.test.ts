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
});

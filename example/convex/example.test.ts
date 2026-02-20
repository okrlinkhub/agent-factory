import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { initConvexTest } from "./setup.test";
import { api } from "./_generated/api";

describe("example", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
  });

  test("queueStats", async () => {
    const t = initConvexTest();
    const stats = await t.query(api.example.queueStats, {});
    expect(stats).toBeDefined();
    expect(typeof stats.queuedReady).toBe("number");
    expect(stats.processing).toBe(0);
    expect(stats.deadLetter).toBe(0);
  });
});

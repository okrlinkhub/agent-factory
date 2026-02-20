/// <reference types="vite/client" />

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api.js";
import { initConvexTest } from "./setup.test.js";

describe("component lib", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  test("enqueue and claim should respect queue flow", async () => {
    const t = initConvexTest();
    await t.mutation(api.queue.upsertAgentProfile, {
      agentKey: "support-agent",
      version: "1.0.0",
      soulMd: "# Soul",
      clientMd: "# Client",
      skills: ["agent-bridge"],
      runtimeConfig: { model: "gpt-5" },
      secretsRef: ["telegram.botToken"],
      enabled: true,
    });

    const messageId = await t.mutation(api.lib.enqueue, {
      conversationId: "telegram:chat:1",
      agentKey: "support-agent",
      payload: {
        provider: "telegram",
        providerUserId: "u1",
        messageText: "Ciao",
      },
    });
    expect(messageId).toBeDefined();

    const claimed = await t.mutation(api.lib.claim, {
      workerId: "worker-1",
    });
    expect(claimed).not.toBeNull();
    expect(claimed?.conversationId).toBe("telegram:chat:1");
  });
});

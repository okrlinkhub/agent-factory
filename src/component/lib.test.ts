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

  test("identity binding should resolve, rebind and revoke", async () => {
    const t = initConvexTest();
    await t.mutation(api.queue.upsertAgentProfile, {
      agentKey: "agent-a",
      version: "1.0.0",
      soulMd: "# Soul",
      clientMd: "# Client",
      skills: ["agent-bridge"],
      runtimeConfig: { model: "gpt-5" },
      secretsRef: [],
      enabled: true,
    });
    await t.mutation(api.queue.upsertAgentProfile, {
      agentKey: "agent-b",
      version: "1.0.0",
      soulMd: "# Soul",
      clientMd: "# Client",
      skills: ["agent-bridge"],
      runtimeConfig: { model: "gpt-5" },
      secretsRef: [],
      enabled: true,
    });

    const first = await t.mutation(api.lib.bindUserAgent, {
      consumerUserId: "u-1",
      agentKey: "agent-a",
      source: "telegram_pairing",
      telegramUserId: "tg-user-1",
      telegramChatId: "tg-chat-1",
    });
    expect(first.agentKey).toBe("agent-a");

    const byUser = await t.query(api.lib.resolveAgentForUser, {
      consumerUserId: "u-1",
    });
    expect(byUser.agentKey).toBe("agent-a");

    const byTelegram = await t.query(api.lib.resolveAgentForTelegram, {
      telegramUserId: "tg-user-1",
    });
    expect(byTelegram.agentKey).toBe("agent-a");

    await t.mutation(api.lib.bindUserAgent, {
      consumerUserId: "u-1",
      agentKey: "agent-b",
      source: "manual",
      telegramUserId: "tg-user-1",
      telegramChatId: "tg-chat-1",
    });

    const rebound = await t.query(api.lib.resolveAgentForUser, {
      consumerUserId: "u-1",
    });
    expect(rebound.agentKey).toBe("agent-b");

    const revokeResult = await t.mutation(api.lib.revokeUserAgentBinding, {
      consumerUserId: "u-1",
    });
    expect(revokeResult.revoked).toBe(1);

    const afterRevoke = await t.query(api.lib.resolveAgentForTelegram, {
      telegramChatId: "tg-chat-1",
    });
    expect(afterRevoke.agentKey).toBeNull();
  });
});

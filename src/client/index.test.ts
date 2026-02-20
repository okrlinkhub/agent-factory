import { describe, expect, test } from "vitest";
import { exposeApi } from "./index.js";
import { anyApi, type ApiFromModules } from "convex/server";
import { components, initConvexTest } from "./setup.test.js";

export const { enqueue, queueStats } = exposeApi(components.agentFactory, {
  auth: async (ctx, _operation) => {
    return (await ctx.auth.getUserIdentity())?.subject ?? "anonymous";
  },
});

const testApi = (
  anyApi as unknown as ApiFromModules<{
    "index.test": {
      enqueue: typeof enqueue;
      queueStats: typeof queueStats;
    };
  }>
)["index.test"];

describe("client tests", () => {
  test("should enqueue messages through client wrapper", async () => {
    const t = initConvexTest().withIdentity({
      subject: "user1",
    });

    await t.mutation(components.agentFactory.queue.upsertAgentProfile, {
      agentKey: "default",
      version: "1.0.0",
      soulMd: "# Soul",
      clientMd: "# Client",
      skills: [],
      runtimeConfig: { model: "gpt-5" },
      secretsRef: [],
      enabled: true,
    });

    await t.mutation(testApi.enqueue, {
      conversationId: "telegram:chat:42",
      agentKey: "default",
      provider: "telegram",
      providerUserId: "42",
      messageText: "Ping",
    });

    const stats = await t.query(testApi.queueStats, {});
    expect(stats.queuedReady).toBe(1);
  });
});

import { action, mutation } from "./_generated/server.js";
import { components } from "./_generated/api.js";
import { exposeApi } from "@okrlinkhub/agent-factory";
import { v } from "convex/values";
import { Auth } from "convex/server";

export const enqueueTelegramMessage = mutation({
  args: { text: v.string(), chatId: v.string() },
  handler: async (ctx, args) => {
    await getAuthUserId(ctx);
    return await ctx.runMutation(components.agentFactory.lib.enqueue, {
      conversationId: `telegram:${args.chatId}`,
      agentKey: "default",
      payload: {
        provider: "telegram",
        providerUserId: args.chatId,
        messageText: args.text,
      },
    });
  },
});

export const seedDefaultAgent = mutation({
  args: {},
  handler: async (ctx) => {
    await getAuthUserId(ctx);
    return await ctx.runMutation(components.agentFactory.lib.configureAgent, {
      agentKey: "default",
      version: "1.0.0",
      soulMd: "# Soul",
      clientMd: "# Client",
      skills: ["agent-bridge"],
      runtimeConfig: { model: "gpt-5" },
      secretsRef: ["telegram.botToken"],
      enabled: true,
    });
  },
});

export const claimForWorker = mutation({
  args: { workerId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.runMutation(components.agentFactory.lib.claim, {
      workerId: args.workerId,
    });
  },
});

export const reconcileWorkers = action({
  args: { flyApiToken: v.string() },
  handler: async (ctx, args) => {
    return await ctx.runAction(components.agentFactory.lib.reconcileWorkers, {
      flyApiToken: args.flyApiToken,
    });
  },
});

export const { enqueue, queueStats } = exposeApi(components.agentFactory, {
  auth: async (ctx, operation) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null && operation.type === "write") {
      throw new Error("Unauthorized");
    }
    return userId;
  },
});

async function getAuthUserId(ctx: { auth: Auth }) {
  return (await ctx.auth.getUserIdentity())?.subject ?? "anonymous";
}

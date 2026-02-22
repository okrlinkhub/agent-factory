import { mutation, query } from "./_generated/server.js";
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

export const upsertExampleAgentProfile = mutation({
  args: {
    agentKey: v.string(),
    secretRef: v.string(),
  },
  handler: async (ctx, args) => {
    await getAuthUserId(ctx);
    return await ctx.runMutation(components.agentFactory.lib.configureAgent, {
      agentKey: args.agentKey,
      version: "1.0.0",
      soulMd: "# Soul",
      clientMd: "# Client",
      skills: ["agent-bridge"],
      secretsRef: [args.secretRef],
      enabled: true,
    });
  },
});

export const seedExampleUsers = mutation({
  args: {},
  returns: v.object({
    inserted: v.number(),
  }),
  handler: async (ctx) => {
    await getAuthUserId(ctx);
    const seeds = [
      { handle: "alice", displayName: "Alice Example" },
      { handle: "bob", displayName: "Bob Example" },
      { handle: "carol", displayName: "Carol Example" },
    ];

    let inserted = 0;
    for (const seed of seeds) {
      const existing = await ctx.db
        .query("users")
        .withIndex("by_handle", (q) => q.eq("handle", seed.handle))
        .unique();
      if (!existing) {
        await ctx.db.insert("users", seed);
        inserted += 1;
      }
    }
    return { inserted };
  },
});

export const listExampleUsers = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      displayName: v.string(),
      handle: v.string(),
    }),
  ),
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users
      .map((user) => ({
        _id: user._id,
        displayName: user.displayName,
        handle: user.handle,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  },
});

export const listUsersWithBindings = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      displayName: v.string(),
      handle: v.string(),
      agentKey: v.union(v.null(), v.string()),
    }),
  ),
  handler: async (ctx) => {
    await getAuthUserId(ctx);
    const users = await ctx.db.query("users").collect();
    const withBindings = [];
    for (const user of users) {
      const resolved = await ctx.runQuery(components.agentFactory.lib.resolveAgentForUser, {
        consumerUserId: user._id,
      });
      withBindings.push({
        _id: user._id,
        displayName: user.displayName,
        handle: user.handle,
        agentKey: resolved.agentKey,
      });
    }
    return withBindings.sort((a, b) => a.displayName.localeCompare(b.displayName));
  },
});

export const {
  enqueue,
  workerClaim,
  workerHeartbeat,
  workerComplete,
  workerFail,
  workerHydrationBundle,
  workerConversationHasQueued,
  workerAppendConversationMessages,
  workerControlState,
  workerPrepareSnapshotUpload,
  workerFinalizeSnapshotUpload,
  workerFailSnapshotUpload,
  workerLatestSnapshotForRestore,
  workerGenerateMediaUploadUrl,
  workerGetStorageFileUrl,
  workerAttachMessageMetadata,
  queueStats,
  workerStats,
  seedDefaultAgent,
  importSecret,
  secretStatus,
  startWorkers,
  checkIdleShutdowns,
  deleteFlyVolume,
  recoverQueue,
  bindUserAgent,
  revokeUserAgentBinding,
  myAgentKey,
  getUserAgentBinding,
  resolveAgentForTelegram,
  createPairingCode,
  consumePairingCode,
  getPairingCodeStatus,
} = exposeApi(components.agentFactory, {
  auth: async (ctx, operation) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null && operation.type === "write") {
      throw new Error("Unauthorized");
    }
    return userId;
  },
});

export const reconcileWorkers = startWorkers;
export const importPairingSecret = importSecret;
export const pairUserToAgent = bindUserAgent;

async function getAuthUserId(ctx: { auth: Auth }) {
  return (await ctx.auth.getUserIdentity())?.subject ?? "anonymous";
}

import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";

const bindingStatusValidator = v.union(v.literal("active"), v.literal("revoked"));
const bindingSourceValidator = v.union(
  v.literal("manual"),
  v.literal("telegram_pairing"),
  v.literal("api"),
);

const bindingViewValidator = v.object({
  consumerUserId: v.string(),
  agentKey: v.string(),
  status: bindingStatusValidator,
  source: bindingSourceValidator,
  telegramUserId: v.union(v.null(), v.string()),
  telegramChatId: v.union(v.null(), v.string()),
  metadata: v.union(v.null(), v.record(v.string(), v.string())),
  boundAt: v.number(),
  revokedAt: v.union(v.null(), v.number()),
});

export const bindUserAgent = mutation({
  args: {
    consumerUserId: v.string(),
    agentKey: v.string(),
    source: v.optional(bindingSourceValidator),
    telegramUserId: v.optional(v.string()),
    telegramChatId: v.optional(v.string()),
    metadata: v.optional(v.record(v.string(), v.string())),
    nowMs: v.optional(v.number()),
  },
  returns: bindingViewValidator,
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now();
    const profile = await ctx.db
      .query("agentProfiles")
      .withIndex("by_agentKey", (q) => q.eq("agentKey", args.agentKey))
      .unique();
    if (!profile) {
      throw new Error(`Agent profile '${args.agentKey}' not found`);
    }

    const activeForUser = await ctx.db
      .query("identityBindings")
      .withIndex("by_consumerUserId_and_status", (q) =>
        q.eq("consumerUserId", args.consumerUserId).eq("status", "active"),
      )
      .collect();
    for (const row of activeForUser) {
      await ctx.db.patch(row._id, { status: "revoked", revokedAt: nowMs });
    }

    if (args.telegramUserId) {
      const byTelegramUser = await ctx.db
        .query("identityBindings")
        .withIndex("by_telegramUserId_and_status", (q) =>
          q.eq("telegramUserId", args.telegramUserId).eq("status", "active"),
        )
        .collect();
      for (const row of byTelegramUser) {
        if (row.consumerUserId !== args.consumerUserId) {
          await ctx.db.patch(row._id, { status: "revoked", revokedAt: nowMs });
        }
      }
    }

    if (args.telegramChatId) {
      const byTelegramChat = await ctx.db
        .query("identityBindings")
        .withIndex("by_telegramChatId_and_status", (q) =>
          q.eq("telegramChatId", args.telegramChatId).eq("status", "active"),
        )
        .collect();
      for (const row of byTelegramChat) {
        if (row.consumerUserId !== args.consumerUserId) {
          await ctx.db.patch(row._id, { status: "revoked", revokedAt: nowMs });
        }
      }
    }

    const bindingId = await ctx.db.insert("identityBindings", {
      consumerUserId: args.consumerUserId,
      agentKey: args.agentKey,
      status: "active",
      source: args.source ?? "api",
      telegramUserId: args.telegramUserId,
      telegramChatId: args.telegramChatId,
      metadata: args.metadata,
      boundAt: nowMs,
    });

    const created = await ctx.db.get(bindingId);
    if (!created) {
      throw new Error("Failed to create identity binding");
    }

    return {
      consumerUserId: created.consumerUserId,
      agentKey: created.agentKey,
      status: created.status,
      source: created.source,
      telegramUserId: created.telegramUserId ?? null,
      telegramChatId: created.telegramChatId ?? null,
      metadata: created.metadata ?? null,
      boundAt: created.boundAt,
      revokedAt: created.revokedAt ?? null,
    };
  },
});

export const revokeUserAgentBinding = mutation({
  args: {
    consumerUserId: v.string(),
    nowMs: v.optional(v.number()),
  },
  returns: v.object({
    revoked: v.number(),
  }),
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now();
    const activeForUser = await ctx.db
      .query("identityBindings")
      .withIndex("by_consumerUserId_and_status", (q) =>
        q.eq("consumerUserId", args.consumerUserId).eq("status", "active"),
      )
      .collect();
    for (const row of activeForUser) {
      await ctx.db.patch(row._id, { status: "revoked", revokedAt: nowMs });
    }
    return { revoked: activeForUser.length };
  },
});

export const resolveAgentForUser = query({
  args: {
    consumerUserId: v.string(),
  },
  returns: v.object({
    consumerUserId: v.string(),
    agentKey: v.union(v.null(), v.string()),
  }),
  handler: async (ctx, args) => {
    const active = await ctx.db
      .query("identityBindings")
      .withIndex("by_consumerUserId_and_status", (q) =>
        q.eq("consumerUserId", args.consumerUserId).eq("status", "active"),
      )
      .first();

    return {
      consumerUserId: args.consumerUserId,
      agentKey: active?.agentKey ?? null,
    };
  },
});

export const resolveAgentForTelegram = query({
  args: {
    telegramUserId: v.optional(v.string()),
    telegramChatId: v.optional(v.string()),
  },
  returns: v.object({
    consumerUserId: v.union(v.null(), v.string()),
    agentKey: v.union(v.null(), v.string()),
  }),
  handler: async (ctx, args) => {
    let active:
      | {
          consumerUserId: string;
          agentKey: string;
        }
      | null = null;

    if (args.telegramUserId) {
      const byUser = await ctx.db
        .query("identityBindings")
        .withIndex("by_telegramUserId_and_status", (q) =>
          q.eq("telegramUserId", args.telegramUserId).eq("status", "active"),
        )
        .first();
      if (byUser) {
        active = {
          consumerUserId: byUser.consumerUserId,
          agentKey: byUser.agentKey,
        };
      }
    }

    if (!active && args.telegramChatId) {
      const byChat = await ctx.db
        .query("identityBindings")
        .withIndex("by_telegramChatId_and_status", (q) =>
          q.eq("telegramChatId", args.telegramChatId).eq("status", "active"),
        )
        .first();
      if (byChat) {
        active = {
          consumerUserId: byChat.consumerUserId,
          agentKey: byChat.agentKey,
        };
      }
    }

    return {
      consumerUserId: active?.consumerUserId ?? null,
      agentKey: active?.agentKey ?? null,
    };
  },
});

export const getUserAgentBinding = query({
  args: {
    consumerUserId: v.string(),
  },
  returns: v.union(v.null(), bindingViewValidator),
  handler: async (ctx, args) => {
    const active = await ctx.db
      .query("identityBindings")
      .withIndex("by_consumerUserId_and_status", (q) =>
        q.eq("consumerUserId", args.consumerUserId).eq("status", "active"),
      )
      .first();
    if (!active) {
      return null;
    }
    return {
      consumerUserId: active.consumerUserId,
      agentKey: active.agentKey,
      status: active.status,
      source: active.source,
      telegramUserId: active.telegramUserId ?? null,
      telegramChatId: active.telegramChatId ?? null,
      metadata: active.metadata ?? null,
      boundAt: active.boundAt,
      revokedAt: active.revokedAt ?? null,
    };
  },
});

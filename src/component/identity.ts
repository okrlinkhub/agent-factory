import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";
import type { MutationCtx } from "./_generated/server.js";

const bindingStatusValidator = v.union(v.literal("active"), v.literal("revoked"));
const bindingSourceValidator = v.union(
  v.literal("manual"),
  v.literal("telegram_pairing"),
  v.literal("api"),
);
const pairingStatusValidator = v.union(
  v.literal("pending"),
  v.literal("used"),
  v.literal("expired"),
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

const pairingCodeViewValidator = v.object({
  code: v.string(),
  consumerUserId: v.string(),
  agentKey: v.string(),
  status: pairingStatusValidator,
  createdAt: v.number(),
  expiresAt: v.number(),
  usedAt: v.union(v.null(), v.number()),
  telegramUserId: v.union(v.null(), v.string()),
  telegramChatId: v.union(v.null(), v.string()),
});

type BindingSource = "manual" | "telegram_pairing" | "api";

type UpsertBindingArgs = {
  consumerUserId: string;
  agentKey: string;
  source?: BindingSource;
  telegramUserId?: string;
  telegramChatId?: string;
  metadata?: Record<string, string>;
  nowMs?: number;
};

export const createPairingCode = mutation({
  args: {
    consumerUserId: v.string(),
    agentKey: v.string(),
    ttlMs: v.optional(v.number()),
    nowMs: v.optional(v.number()),
  },
  returns: pairingCodeViewValidator,
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now();
    const ttlMs = Math.max(60_000, Math.min(args.ttlMs ?? 15 * 60_000, 24 * 60 * 60 * 1000));
    const expiresAt = nowMs + ttlMs;

    const profile = await ctx.db
      .query("agentProfiles")
      .withIndex("by_agentKey", (q) => q.eq("agentKey", args.agentKey))
      .unique();
    if (!profile || !profile.enabled) {
      throw new Error(`Agent profile '${args.agentKey}' not found or disabled`);
    }

    const pendingCodes = await ctx.db
      .query("pairingCodes")
      .withIndex("by_consumerUserId_and_status", (q) =>
        q.eq("consumerUserId", args.consumerUserId).eq("status", "pending"),
      )
      .collect();

    for (const row of pendingCodes) {
      const nextStatus: "expired" | "pending" =
        (row.expiresAt <= nowMs || row.agentKey === args.agentKey) ? "expired" : "pending";
      if (nextStatus !== row.status) {
        await ctx.db.patch(row._id, { status: nextStatus });
      }
    }

    let code = "";
    let existing = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      code = generatePairingCode();
      existing = await ctx.db
        .query("pairingCodes")
        .withIndex("by_code", (q) => q.eq("code", code))
        .unique();
      if (!existing) break;
    }
    if (existing) {
      throw new Error("Failed to generate unique pairing code");
    }

    await ctx.db.insert("pairingCodes", {
      code,
      consumerUserId: args.consumerUserId,
      agentKey: args.agentKey,
      status: "pending",
      createdAt: nowMs,
      expiresAt,
    });

    return {
      code,
      consumerUserId: args.consumerUserId,
      agentKey: args.agentKey,
      status: "pending" as const,
      createdAt: nowMs,
      expiresAt,
      usedAt: null,
      telegramUserId: null,
      telegramChatId: null,
    };
  },
});

export const consumePairingCode = mutation({
  args: {
    code: v.string(),
    telegramUserId: v.string(),
    telegramChatId: v.string(),
    nowMs: v.optional(v.number()),
  },
  returns: pairingCodeViewValidator,
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now();
    const pairing = await ctx.db
      .query("pairingCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();
    if (!pairing) {
      throw new Error("Pairing code not found");
    }
    if (pairing.status !== "pending") {
      throw new Error("Pairing code already used or expired");
    }
    if (pairing.expiresAt <= nowMs) {
      await ctx.db.patch(pairing._id, { status: "expired" });
      throw new Error("Pairing code expired");
    }

    await upsertBinding(ctx, {
      consumerUserId: pairing.consumerUserId,
      agentKey: pairing.agentKey,
      source: "telegram_pairing",
      telegramUserId: args.telegramUserId,
      telegramChatId: args.telegramChatId,
      nowMs,
    });

    await ctx.db.patch(pairing._id, {
      status: "used",
      usedAt: nowMs,
      telegramUserId: args.telegramUserId,
      telegramChatId: args.telegramChatId,
    });

    return {
      code: pairing.code,
      consumerUserId: pairing.consumerUserId,
      agentKey: pairing.agentKey,
      status: "used" as const,
      createdAt: pairing.createdAt,
      expiresAt: pairing.expiresAt,
      usedAt: nowMs,
      telegramUserId: args.telegramUserId,
      telegramChatId: args.telegramChatId,
    };
  },
});

export const getPairingCodeStatus = query({
  args: {
    code: v.string(),
    nowMs: v.optional(v.number()),
  },
  returns: v.union(v.null(), pairingCodeViewValidator),
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now();
    const pairing = await ctx.db
      .query("pairingCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();
    if (!pairing) return null;

    if (pairing.status === "pending" && pairing.expiresAt <= nowMs) {
      return {
        code: pairing.code,
        consumerUserId: pairing.consumerUserId,
        agentKey: pairing.agentKey,
        status: "expired" as const,
        createdAt: pairing.createdAt,
        expiresAt: pairing.expiresAt,
        usedAt: pairing.usedAt ?? null,
        telegramUserId: pairing.telegramUserId ?? null,
        telegramChatId: pairing.telegramChatId ?? null,
      };
    }

    return {
      code: pairing.code,
      consumerUserId: pairing.consumerUserId,
      agentKey: pairing.agentKey,
      status: pairing.status,
      createdAt: pairing.createdAt,
      expiresAt: pairing.expiresAt,
      usedAt: pairing.usedAt ?? null,
      telegramUserId: pairing.telegramUserId ?? null,
      telegramChatId: pairing.telegramChatId ?? null,
    };
  },
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
    return upsertBinding(ctx, args);
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

function generatePairingCode() {
  return Math.random().toString(36).slice(2, 12).toUpperCase();
}

async function upsertBinding(
  ctx: MutationCtx,
  args: UpsertBindingArgs,
) {
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
}

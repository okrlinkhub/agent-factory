import { v } from "convex/values";
import { internal } from "./_generated/api.js";
import { action, mutation, query } from "./_generated/server.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";

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
const userAgentStatusValidator = v.union(
  v.literal("draft"),
  v.literal("pairing"),
  v.literal("active"),
  v.literal("disabled"),
  v.literal("failed"),
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

const telegramWebhookStatusValidator = v.object({
  ok: v.boolean(),
  webhookUrl: v.string(),
  currentUrl: v.union(v.null(), v.string()),
  isReady: v.boolean(),
  pendingUpdateCount: v.number(),
  lastErrorMessage: v.union(v.null(), v.string()),
  lastErrorDate: v.union(v.null(), v.number()),
  description: v.string(),
});

const userAgentViewValidator = v.object({
  consumerUserId: v.string(),
  agentKey: v.string(),
  displayName: v.union(v.null(), v.string()),
  telegramUsername: v.union(v.null(), v.string()),
  version: v.union(v.null(), v.string()),
  status: userAgentStatusValidator,
  bindingStatus: v.union(v.null(), bindingStatusValidator),
  pairingStatus: v.union(v.null(), pairingStatusValidator),
  conversationId: v.union(v.null(), v.string()),
  canCreateNewAgent: v.boolean(),
  canDisable: v.boolean(),
  canChat: v.boolean(),
  canManagePushJobs: v.boolean(),
});

const userAgentsOverviewValidator = v.object({
  agents: v.array(userAgentViewValidator),
  activeAgentKey: v.union(v.null(), v.string()),
  canCreateNewAgent: v.boolean(),
});

const webhookReadinessValidator = v.object({
  agentKey: v.string(),
  secretRef: v.union(v.null(), v.string()),
  currentUrl: v.union(v.null(), v.string()),
  pendingUpdateCount: v.number(),
  lastErrorMessage: v.union(v.null(), v.string()),
  lastErrorDate: v.union(v.null(), v.number()),
  webhookReady: v.boolean(),
});

const onboardingStateValidator = v.object({
  agentKey: v.string(),
  telegramUsername: v.union(v.null(), v.string()),
  tokenSecretRef: v.union(v.null(), v.string()),
  tokenImported: v.boolean(),
  webhookReady: v.boolean(),
  pairingCode: v.union(v.null(), v.string()),
  pairingStatus: v.union(v.null(), pairingStatusValidator),
  pairingDeepLink: v.union(v.null(), v.string()),
  nextAction: v.union(
    v.literal("import_token"),
    v.literal("configure_webhook"),
    v.literal("create_pairing"),
    v.literal("complete_pairing"),
    v.literal("ready"),
  ),
});

const operationalReadinessValidator = v.object({
  missingSecrets: v.array(v.string()),
  hasTelegramToken: v.boolean(),
  webhookReady: v.boolean(),
  providerRuntimeConfigPresent: v.boolean(),
  workerRuntimeConfigPresent: v.boolean(),
  issues: v.array(v.string()),
});

type BindingSource = "manual" | "telegram_pairing" | "api";
type UserAgentStatus = "draft" | "pairing" | "active" | "disabled" | "failed";
type PairingStatus = "pending" | "used" | "expired" | null;
type UserAgentView = {
  consumerUserId: string;
  agentKey: string;
  displayName: string | null;
  telegramUsername: string | null;
  version: string | null;
  status: UserAgentStatus;
  bindingStatus: "active" | "revoked" | null;
  pairingStatus: PairingStatus;
  conversationId: string | null;
  canCreateNewAgent: boolean;
  canDisable: boolean;
  canChat: boolean;
  canManagePushJobs: boolean;
};
type UserAgentsOverview = {
  agents: Array<UserAgentView>;
  activeAgentKey: string | null;
  canCreateNewAgent: boolean;
};
type OnboardingNextAction =
  | "import_token"
  | "configure_webhook"
  | "create_pairing"
  | "complete_pairing"
  | "ready";
type OnboardingState = {
  agentKey: string;
  telegramUsername: string | null;
  tokenSecretRef: string | null;
  tokenImported: boolean;
  webhookReady: boolean;
  pairingCode: string | null;
  pairingStatus: PairingStatus;
  pairingDeepLink: string | null;
  nextAction: OnboardingNextAction;
};

type UpsertBindingArgs = {
  consumerUserId: string;
  agentKey: string;
  source?: BindingSource;
  telegramUserId?: string;
  telegramChatId?: string;
  metadata?: Record<string, string>;
  nowMs?: number;
};

export const configureTelegramWebhook = action({
  args: {
    convexSiteUrl: v.string(),
    secretRef: v.optional(v.string()),
  },
  returns: telegramWebhookStatusValidator,
  handler: async (ctx, args) => {
    const secretRef = args.secretRef?.trim() || "telegram.botToken.default";
    const token = await ctx.runQuery(internal.queue.getActiveSecretPlaintext, {
      secretRef,
    });
    if (!token) {
      throw new Error(
        `Missing Telegram token. Import an active '${secretRef}' secret before pairing.`,
      );
    }

    const rawSiteUrl = args.convexSiteUrl.trim();
    if (!rawSiteUrl) {
      throw new Error("convexSiteUrl is required.");
    }

    const normalizedSiteUrl = rawSiteUrl
      .replace(/\/+$/, "")
      .replace(/\.cloud$/i, ".site");
    if (!normalizedSiteUrl.startsWith("https://")) {
      throw new Error("convexSiteUrl must start with https://");
    }

    const webhookUrl = `${normalizedSiteUrl}/agent-factory/telegram/webhook`;
    const telegramApiBaseUrl = `https://api.telegram.org/bot${encodeURIComponent(token)}`;

    const setWebhookResponse = await fetch(`${telegramApiBaseUrl}/setWebhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: webhookUrl,
      }),
    });

    const setWebhookPayload = (await setWebhookResponse.json().catch(() => ({}))) as {
      ok?: boolean;
      description?: string;
    };

    if (!setWebhookResponse.ok || setWebhookPayload.ok !== true) {
      const description =
        typeof setWebhookPayload.description === "string"
          ? setWebhookPayload.description
          : "setWebhook failed";
      throw new Error(`Telegram setWebhook failed: ${description}`);
    }

    const webhookInfoResponse = await fetch(`${telegramApiBaseUrl}/getWebhookInfo`);
    const webhookInfoPayload = (await webhookInfoResponse.json().catch(() => ({}))) as {
      ok?: boolean;
      description?: string;
      result?: {
        url?: string;
        pending_update_count?: number;
        last_error_message?: string;
        last_error_date?: number;
      };
    };

    if (!webhookInfoResponse.ok || webhookInfoPayload.ok !== true) {
      const description =
        typeof webhookInfoPayload.description === "string"
          ? webhookInfoPayload.description
          : "getWebhookInfo failed";
      throw new Error(`Telegram getWebhookInfo failed: ${description}`);
    }

    const currentUrl = typeof webhookInfoPayload.result?.url === "string"
      ? webhookInfoPayload.result.url
      : null;
    const pendingUpdateCount = Number(webhookInfoPayload.result?.pending_update_count ?? 0);
    const lastErrorMessage = typeof webhookInfoPayload.result?.last_error_message === "string"
      ? webhookInfoPayload.result.last_error_message
      : null;
    const lastErrorDate = typeof webhookInfoPayload.result?.last_error_date === "number"
      ? webhookInfoPayload.result.last_error_date
      : null;
    const isReady = currentUrl === webhookUrl;

    return {
      ok: true,
      webhookUrl,
      currentUrl,
      isReady,
      pendingUpdateCount,
      lastErrorMessage,
      lastErrorDate,
      description: "Telegram webhook configured and verified.",
    };
  },
});

export const createPairingCode = mutation({
  args: {
    consumerUserId: v.string(),
    agentKey: v.string(),
    ttlMs: v.optional(v.number()),
    nowMs: v.optional(v.number()),
  },
  returns: pairingCodeViewValidator,
  handler: async (ctx, args) => {
    return await createPairingCodeRecord(ctx, args);
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

export const listUserAgents = query({
  args: {
    consumerUserId: v.string(),
    includeDisabled: v.optional(v.boolean()),
    nowMs: v.optional(v.number()),
  },
  returns: v.array(userAgentViewValidator),
  handler: async (ctx, args) => {
    const overview: UserAgentsOverview = await buildUserAgentsOverview(
      ctx,
      args.consumerUserId,
      args.nowMs ?? Date.now(),
    );
    return (args.includeDisabled ?? true)
      ? overview.agents
      : overview.agents.filter((agent) => agent.status !== "disabled");
  },
});

export const getUserAgent = query({
  args: {
    consumerUserId: v.string(),
    agentKey: v.string(),
    nowMs: v.optional(v.number()),
  },
  returns: v.union(v.null(), userAgentViewValidator),
  handler: async (ctx, args) => {
    const overview: UserAgentsOverview = await buildUserAgentsOverview(
      ctx,
      args.consumerUserId,
      args.nowMs ?? Date.now(),
    );
    return overview.agents.find((agent) => agent.agentKey === args.agentKey) ?? null;
  },
});

export const getActiveUserAgent = query({
  args: {
    consumerUserId: v.string(),
    nowMs: v.optional(v.number()),
  },
  returns: v.union(v.null(), userAgentViewValidator),
  handler: async (ctx, args) => {
    const overview: UserAgentsOverview = await buildUserAgentsOverview(
      ctx,
      args.consumerUserId,
      args.nowMs ?? Date.now(),
    );
    return overview.activeAgentKey
      ? (overview.agents.find((agent) => agent.agentKey === overview.activeAgentKey) ?? null)
      : null;
  },
});

export const getUserAgentsOverview = query({
  args: {
    consumerUserId: v.string(),
    nowMs: v.optional(v.number()),
  },
  returns: userAgentsOverviewValidator,
  handler: async (ctx, args) => {
    const overview: UserAgentsOverview = await buildUserAgentsOverview(
      ctx,
      args.consumerUserId,
      args.nowMs ?? Date.now(),
    );
    return overview;
  },
});

export const createUserAgentPairing = mutation({
  args: {
    consumerUserId: v.string(),
    agentKey: v.string(),
    ttlMs: v.optional(v.number()),
    nowMs: v.optional(v.number()),
  },
  returns: v.object({
    pairing: pairingCodeViewValidator,
    deepLink: v.union(v.null(), v.string()),
  }),
  handler: async (ctx, args) => {
    const pairing = await createPairingCodeRecord(ctx, args);
    const details = await buildUserAgentDetails(
      ctx,
      args.consumerUserId,
      args.agentKey,
      args.nowMs ?? Date.now(),
    );
    return {
      pairing,
      deepLink:
        details.telegramUsername !== null
          ? `https://t.me/${details.telegramUsername}?start=${pairing.code}`
          : null,
    };
  },
});

export const getUserAgentPairingStatus = query({
  args: {
    consumerUserId: v.string(),
    agentKey: v.string(),
    nowMs: v.optional(v.number()),
  },
  returns: v.union(v.null(), pairingCodeViewValidator),
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now();
    const details = await buildUserAgentDetails(ctx, args.consumerUserId, args.agentKey, nowMs);
    if (details.latestPairing) {
      const pairing = details.latestPairing;
      return {
        code: pairing.code,
        consumerUserId: pairing.consumerUserId,
        agentKey: pairing.agentKey,
        status:
          pairing.status === "pending" && pairing.expiresAt <= nowMs
            ? "expired"
            : pairing.status,
        createdAt: pairing.createdAt,
        expiresAt: pairing.expiresAt,
        usedAt: pairing.usedAt ?? null,
        telegramUserId: pairing.telegramUserId ?? null,
        telegramChatId: pairing.telegramChatId ?? null,
      };
    }
    return null;
  },
});

export const importTelegramTokenForAgent = mutation({
  args: {
    consumerUserId: v.string(),
    agentKey: v.string(),
    plaintextValue: v.string(),
    metadata: v.optional(v.record(v.string(), v.string())),
  },
  returns: v.object({
    secretId: v.id("secrets"),
    secretRef: v.string(),
    version: v.number(),
  }),
  handler: async (ctx, args) => {
    const details = await buildUserAgentDetails(
      ctx,
      args.consumerUserId,
      args.agentKey,
      Date.now(),
    );
    if (details.latestBinding === null && details.latestPairing === null) {
      throw new Error("Agent is not yet associated with the provided consumerUserId");
    }
    const profile = await ctx.db
      .query("agentProfiles")
      .withIndex("by_agentKey", (q) => q.eq("agentKey", args.agentKey))
      .unique();
    if (!profile) {
      throw new Error(`Agent profile '${args.agentKey}' not found`);
    }
    const secretRef = resolveTelegramSecretRef(profile, args.agentKey);
    if (!profile.secretsRef.includes(secretRef)) {
      await ctx.db.patch(profile._id, {
        secretsRef: [...profile.secretsRef, secretRef],
      });
    }
    return await importPlaintextSecretRecord(ctx, {
      secretRef,
      plaintextValue: args.plaintextValue,
      metadata: args.metadata,
    });
  },
});

export const getRequiredSecretRefs = query({
  args: {
    agentKey: v.optional(v.string()),
  },
  returns: v.object({
    agentKey: v.union(v.null(), v.string()),
    secretRefs: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    return await getRequiredSecretRefsForAgent(ctx, args.agentKey);
  },
});

export const getProviderOperationalReadiness = query({
  args: {},
  returns: v.object({
    providerRuntimeConfigPresent: v.boolean(),
    workerRuntimeConfigPresent: v.boolean(),
    issues: v.array(v.string()),
  }),
  handler: async (ctx) => {
    return await buildProviderOperationalReadiness(ctx);
  },
});

export const getTelegramAgentReadiness = query({
  args: {
    consumerUserId: v.string(),
    agentKey: v.string(),
    nowMs: v.optional(v.number()),
  },
  returns: operationalReadinessValidator,
  handler: async (ctx, args) => {
    return await buildTelegramAgentReadiness(ctx, args);
  },
});

export const getAgentOperationalReadiness = query({
  args: {
    consumerUserId: v.string(),
    agentKey: v.string(),
    nowMs: v.optional(v.number()),
  },
  returns: operationalReadinessValidator,
  handler: async (ctx, args) => {
    return await buildTelegramAgentReadiness(ctx, args);
  },
});

export const getUserAgentOnboardingState = query({
  args: {
    consumerUserId: v.string(),
    agentKey: v.string(),
    nowMs: v.optional(v.number()),
  },
  returns: onboardingStateValidator,
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now();
    const details = await buildUserAgentDetails(ctx, args.consumerUserId, args.agentKey, nowMs);
    const tokenImported =
      details.telegramTokenSecretRef !== null
        ? await hasActiveSecret(ctx, details.telegramTokenSecretRef)
        : false;
    const pairingStatus =
      details.latestBinding?.status === "active"
        ? "used"
        : details.latestPendingPairing === null
          ? null
          : details.latestPendingPairing.expiresAt <= nowMs
            ? "expired"
            : "pending";
    const webhookReady =
      tokenImported &&
      details.latestBinding?.status === "active" &&
      details.latestBinding.source === "telegram_pairing";
    const pairingCode =
      pairingStatus === "pending" && details.latestPendingPairing !== null
        ? details.latestPendingPairing.code
        : null;
    const nextAction: OnboardingNextAction = !tokenImported
      ? "import_token"
      : !webhookReady
        ? "configure_webhook"
        : pairingStatus === "pending"
          ? "complete_pairing"
          : pairingStatus === "used"
            ? "ready"
            : "create_pairing";
    const result: OnboardingState = {
      agentKey: args.agentKey,
      telegramUsername: details.telegramUsername,
      tokenSecretRef: details.telegramTokenSecretRef,
      tokenImported,
      webhookReady,
      pairingCode,
      pairingStatus,
      pairingDeepLink:
        pairingCode !== null && details.telegramUsername !== null
          ? `https://t.me/${details.telegramUsername}?start=${pairingCode}`
          : null,
      nextAction,
    };
    return result;
  },
});

export const getWebhookReadiness = action({
  args: {
    agentKey: v.string(),
  },
  returns: webhookReadinessValidator,
  handler: async (ctx, args) => {
    const candidateSecretRefs = [`telegram.botToken.${args.agentKey}`, "telegram.botToken"];
    let secretRef: string | null = null;
    let token: string | null = null;
    for (const candidateSecretRef of candidateSecretRefs) {
      const candidateToken = await ctx.runQuery(internal.queue.getActiveSecretPlaintext, {
        secretRef: candidateSecretRef,
      });
      if (candidateToken) {
        secretRef = candidateSecretRef;
        token = candidateToken;
        break;
      }
    }
    if (!token) {
      return {
        agentKey: args.agentKey,
        secretRef,
        currentUrl: null,
        pendingUpdateCount: 0,
        lastErrorMessage: null,
        lastErrorDate: null,
        webhookReady: false,
      };
    }
    const info = await fetchTelegramWebhookInfo(token);
    return {
      agentKey: args.agentKey,
      secretRef,
      currentUrl: info.currentUrl,
      pendingUpdateCount: info.pendingUpdateCount,
      lastErrorMessage: info.lastErrorMessage,
      lastErrorDate: info.lastErrorDate,
      webhookReady:
        info.currentUrl !== null && info.currentUrl.endsWith("/agent-factory/telegram/webhook"),
    };
  },
});

function generatePairingCode() {
  return Math.random().toString(36).slice(2, 12).toUpperCase();
}

async function listBindingsForUser(
  ctx: QueryCtx | MutationCtx,
  consumerUserId: string,
) {
  const [active, revoked] = await Promise.all([
    ctx.db
      .query("identityBindings")
      .withIndex("by_consumerUserId_and_status", (q) =>
        q.eq("consumerUserId", consumerUserId).eq("status", "active"),
      )
      .take(20),
    ctx.db
      .query("identityBindings")
      .withIndex("by_consumerUserId_and_status", (q) =>
        q.eq("consumerUserId", consumerUserId).eq("status", "revoked"),
      )
      .take(100),
  ]);
  return [...active, ...revoked].sort((a, b) => b.boundAt - a.boundAt);
}

async function listPairingsForUserAgent(
  ctx: QueryCtx | MutationCtx,
  consumerUserId: string,
  agentKey: string,
) {
  return await ctx.db
    .query("pairingCodes")
    .withIndex("by_consumerUserId_and_agentKey_and_createdAt", (q) =>
      q.eq("consumerUserId", consumerUserId).eq("agentKey", agentKey),
    )
    .order("desc")
    .take(20);
}

async function hasActiveSecret(
  ctx: QueryCtx | MutationCtx,
  secretRef: string,
) {
  const secret = await ctx.db
    .query("secrets")
    .withIndex("by_secretRef_and_active", (q) =>
      q.eq("secretRef", secretRef).eq("active", true),
    )
    .unique();
  return secret !== null;
}

function resolveTelegramSecretRef(
  profile:
    | {
        secretsRef: Array<string>;
      }
    | null,
  agentKey: string,
) {
  const explicitRef =
    profile?.secretsRef.find(
      (secretRef) =>
        secretRef === "telegram.botToken" || secretRef.startsWith("telegram.botToken."),
    ) ?? null;
  return explicitRef ?? `telegram.botToken.${agentKey}`;
}

function deriveTelegramUsername(
  binding: {
    metadata?: Record<string, string>;
  } | null,
  secretRef: string | null,
) {
  const fromMetadata = binding?.metadata?.telegramUsername?.trim();
  if (fromMetadata) {
    return fromMetadata;
  }
  if (secretRef && secretRef.startsWith("telegram.botToken.")) {
    return secretRef.slice("telegram.botToken.".length) || null;
  }
  return null;
}

function deriveDisplayName(binding: { metadata?: Record<string, string> } | null) {
  const value = binding?.metadata?.displayName?.trim();
  return value && value.length > 0 ? value : null;
}

function deriveConversationId(
  binding:
    | {
        telegramChatId?: string;
      }
    | null,
  consumerUserId: string,
) {
  const telegramChatId = binding?.telegramChatId?.trim();
  if (telegramChatId) {
    return `telegram:${telegramChatId}`;
  }
  return `user:${consumerUserId}`;
}

function deriveUserAgentStatus(input: {
  latestBinding: {
    status: "active" | "revoked";
  } | null;
  latestPendingPairing: {
    expiresAt: number;
  } | null;
  profileEnabled: boolean | null;
  nowMs: number;
}): UserAgentStatus {
  if (input.latestBinding?.status === "active") {
    return input.profileEnabled === false ? "failed" : "active";
  }
  if (
    input.latestPendingPairing !== null &&
    input.latestPendingPairing.expiresAt > input.nowMs
  ) {
    return "pairing";
  }
  if (input.latestBinding?.status === "revoked" || input.profileEnabled === false) {
    return "disabled";
  }
  return "draft";
}

async function buildUserAgentDetails(
  ctx: QueryCtx | MutationCtx,
  consumerUserId: string,
  agentKey: string,
  nowMs: number,
) {
  const [bindings, pairings, profile] = await Promise.all([
    listBindingsForUser(ctx, consumerUserId),
    listPairingsForUserAgent(ctx, consumerUserId, agentKey),
    ctx.db
      .query("agentProfiles")
      .withIndex("by_agentKey", (q) => q.eq("agentKey", agentKey))
      .unique(),
  ]);
  const bindingRows = bindings.filter((binding) => binding.agentKey === agentKey);
  const latestBinding = bindingRows[0] ?? null;
  const latestPairing = pairings[0] ?? null;
  const latestPendingPairing =
    pairings.find((pairing) => pairing.status === "pending") ?? null;
  const telegramTokenSecretRef = resolveTelegramSecretRef(profile, agentKey);
  const telegramUsername = deriveTelegramUsername(latestBinding, telegramTokenSecretRef);
  const displayName = deriveDisplayName(latestBinding);
  const status = deriveUserAgentStatus({
    latestBinding,
    latestPendingPairing,
    profileEnabled: profile?.enabled ?? null,
    nowMs,
  });
  return {
    latestBinding,
    latestPairing,
    latestPendingPairing,
    telegramTokenSecretRef,
    telegramUsername,
    displayName,
    version: profile?.version ?? null,
    status,
    conversationId: deriveConversationId(latestBinding, consumerUserId),
  };
}

async function buildUserAgentsOverview(
  ctx: QueryCtx | MutationCtx,
  consumerUserId: string,
  nowMs: number,
): Promise<UserAgentsOverview> {
  const [bindings, pendingPairings] = await Promise.all([
    listBindingsForUser(ctx, consumerUserId),
    ctx.db
      .query("pairingCodes")
      .withIndex("by_consumerUserId_and_status", (q) =>
        q.eq("consumerUserId", consumerUserId).eq("status", "pending"),
      )
      .take(50),
  ]);
  const agentKeys = Array.from(
    new Set([
      ...bindings.map((binding) => binding.agentKey),
      ...pendingPairings.map((pairing) => pairing.agentKey),
    ]),
  );
  const activeAgentKey = bindings.find((binding) => binding.status === "active")?.agentKey ?? null;
  const canCreateNewAgent = activeAgentKey === null;
  const agents: Array<UserAgentView> = await Promise.all(
    agentKeys.map(async (agentKey) => {
      const details = await buildUserAgentDetails(ctx, consumerUserId, agentKey, nowMs);
      return {
        consumerUserId,
        agentKey,
        displayName: details.displayName,
        telegramUsername: details.telegramUsername,
        version: details.version,
        status: details.status,
        bindingStatus: details.latestBinding?.status ?? null,
        pairingStatus:
          details.latestBinding?.status === "active"
            ? "used"
            : details.latestPendingPairing === null
              ? null
              : details.latestPendingPairing.expiresAt <= nowMs
                ? "expired"
                : "pending",
        conversationId: details.conversationId,
        canCreateNewAgent,
        canDisable: details.status === "active",
        canChat: details.status === "active",
        canManagePushJobs: details.status === "active",
      };
    }),
  );
  return {
    agents,
    activeAgentKey,
    canCreateNewAgent,
  };
}

async function fetchTelegramWebhookInfo(token: string) {
  const telegramApiBaseUrl = `https://api.telegram.org/bot${encodeURIComponent(token)}`;
  const response = await fetch(`${telegramApiBaseUrl}/getWebhookInfo`);
  const payload = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    description?: string;
    result?: {
      url?: string;
      pending_update_count?: number;
      last_error_message?: string;
      last_error_date?: number;
    };
  };
  if (!response.ok || payload.ok !== true) {
    throw new Error(
      `Telegram getWebhookInfo failed: ${
        typeof payload.description === "string" ? payload.description : "unknown error"
      }`,
    );
  }
  return {
    currentUrl: typeof payload.result?.url === "string" ? payload.result.url : null,
    pendingUpdateCount: Number(payload.result?.pending_update_count ?? 0),
    lastErrorMessage:
      typeof payload.result?.last_error_message === "string"
        ? payload.result.last_error_message
        : null,
    lastErrorDate:
      typeof payload.result?.last_error_date === "number"
        ? payload.result.last_error_date
        : null,
  };
}

function encryptSecretValue(plaintext: string): string {
  const units = Array.from(plaintext);
  return units
    .map((char, index) => {
      const code = char.charCodeAt(0);
      const mask = 11 + (index % 7);
      return (code ^ mask).toString(16).padStart(4, "0");
    })
    .join("");
}

async function createPairingCodeRecord(
  ctx: MutationCtx,
  args: {
    consumerUserId: string;
    agentKey: string;
    ttlMs?: number;
    nowMs?: number;
  },
) {
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
      row.expiresAt <= nowMs || row.agentKey === args.agentKey ? "expired" : "pending";
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
    if (!existing) {
      break;
    }
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
}

async function importPlaintextSecretRecord(
  ctx: MutationCtx,
  args: {
    secretRef: string;
    plaintextValue: string;
    metadata?: Record<string, string>;
  },
) {
  const history = await ctx.db
    .query("secrets")
    .withIndex("by_secretRef", (q) => q.eq("secretRef", args.secretRef))
    .collect();
  const nextVersion =
    history.reduce((maxVersion, row) => Math.max(maxVersion, row.version), 0) + 1;
  const previousActive = history.find((row) => row.active);
  const encoded = encryptSecretValue(args.plaintextValue);
  for (const row of history) {
    if (row.active) {
      await ctx.db.patch(row._id, { active: false });
    }
  }
  const secretId = await ctx.db.insert("secrets", {
    secretRef: args.secretRef,
    version: nextVersion,
    encryptedValue: encoded,
    keyId: "component-local",
    algorithm: "xor-hex-v1",
    active: true,
    rotatedFrom: previousActive?.version,
    metadata: args.metadata,
  });
  return {
    secretId,
    secretRef: args.secretRef,
    version: nextVersion,
  };
}

async function getRequiredSecretRefsForAgent(
  ctx: QueryCtx | MutationCtx,
  agentKey?: string,
) {
  if (agentKey) {
    const profile = await ctx.db
      .query("agentProfiles")
      .withIndex("by_agentKey", (q) => q.eq("agentKey", agentKey))
      .unique();
    return {
      agentKey,
      secretRefs: profile?.secretsRef ?? [],
    };
  }
  const profiles = await ctx.db
    .query("agentProfiles")
    .withIndex("by_enabled", (q) => q.eq("enabled", true))
    .take(200);
  return {
    agentKey: null,
    secretRefs: Array.from(new Set(profiles.flatMap((profile) => profile.secretsRef))).sort(),
  };
}

async function buildProviderOperationalReadiness(ctx: QueryCtx | MutationCtx) {
  const providerConfig = await ctx.db
    .query("runtimeConfig")
    .withIndex("by_key", (q) => q.eq("key", "provider"))
    .unique();
  const messageConfig = await ctx.db
    .query("runtimeConfig")
    .withIndex("by_key", (q) => q.eq("key", "message"))
    .unique();
  const issues: Array<string> = [];
  if (!providerConfig?.providerConfig) {
    issues.push("missing_provider_runtime_config");
  }
  if (!messageConfig) {
    issues.push("missing_message_runtime_config");
  }
  return {
    providerRuntimeConfigPresent: providerConfig?.providerConfig !== undefined,
    workerRuntimeConfigPresent: messageConfig !== null,
    issues,
  };
}

async function buildTelegramAgentReadiness(
  ctx: QueryCtx,
  args: {
    consumerUserId: string;
    agentKey: string;
    nowMs?: number;
  },
) {
  const nowMs = args.nowMs ?? Date.now();
  const details = await buildUserAgentDetails(ctx, args.consumerUserId, args.agentKey, nowMs);
  const requiredSecretRefs = await getRequiredSecretRefsForAgent(ctx, args.agentKey);
  const missingSecrets: Array<string> = [];
  for (const secretRef of requiredSecretRefs.secretRefs) {
    const hasSecret = await hasActiveSecret(ctx, secretRef);
    if (!hasSecret) {
      missingSecrets.push(secretRef);
    }
  }
  const providerReadiness = await buildProviderOperationalReadiness(ctx);
  const hasTelegramToken =
    details.telegramTokenSecretRef !== null
      ? await hasActiveSecret(ctx, details.telegramTokenSecretRef)
      : false;
  const webhookReady =
    hasTelegramToken &&
    details.latestBinding?.status === "active" &&
    details.latestBinding.source === "telegram_pairing";
  const issues = [...providerReadiness.issues];
  if (!hasTelegramToken) {
    issues.push("missing_telegram_token");
  }
  if (!webhookReady) {
    issues.push("webhook_not_verified");
  }
  return {
    missingSecrets,
    hasTelegramToken,
    webhookReady,
    providerRuntimeConfigPresent: providerReadiness.providerRuntimeConfigPresent,
    workerRuntimeConfigPresent: providerReadiness.workerRuntimeConfigPresent,
    issues,
  };
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

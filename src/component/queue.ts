import { v } from "convex/values";
import { internal } from "./_generated/api.js";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server.js";
import { computeRetryDelayMs, DEFAULT_CONFIG } from "./config.js";

const queueStatusValidator = v.union(
  v.literal("queued"),
  v.literal("processing"),
  v.literal("done"),
  v.literal("failed"),
  v.literal("dead_letter"),
);

const queuePayloadValidator = v.object({
  provider: v.string(),
  providerUserId: v.string(),
  messageText: v.string(),
  externalMessageId: v.optional(v.string()),
  rawUpdateJson: v.optional(v.string()),
  metadata: v.optional(v.record(v.string(), v.string())),
});

const snapshotReasonValidator = v.union(
  v.literal("drain"),
  v.literal("signal"),
  v.literal("manual"),
);
const DATA_SNAPSHOT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

const claimedJobValidator = v.object({
  messageId: v.id("messageQueue"),
  conversationId: v.string(),
  agentKey: v.string(),
  leaseId: v.string(),
  leaseExpiresAt: v.number(),
  payload: queuePayloadValidator,
});

const secretStatusValidator = v.object({
  secretRef: v.string(),
  hasActive: v.boolean(),
  version: v.union(v.null(), v.number()),
});

export const enqueueMessage = mutation({
  args: {
    conversationId: v.string(),
    agentKey: v.string(),
    payload: queuePayloadValidator,
    priority: v.optional(v.number()),
    scheduledFor: v.optional(v.number()),
    maxAttempts: v.optional(v.number()),
    nowMs: v.optional(v.number()),
  },
  returns: v.id("messageQueue"),
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now();
    const profile = await ctx.db
      .query("agentProfiles")
      .withIndex("by_agentKey", (q) => q.eq("agentKey", args.agentKey))
      .unique();
    if (!profile || !profile.enabled) {
      throw new Error(`Agent profile '${args.agentKey}' not found or disabled`);
    }

    const existingConversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .unique();

    if (!existingConversation) {
      await ctx.db.insert("conversations", {
        conversationId: args.conversationId,
        agentKey: args.agentKey,
        contextHistory: [],
        pendingToolCalls: [],
      });
    }

    const priority = Math.min(
      DEFAULT_CONFIG.queue.maxPriority,
      Math.max(0, args.priority ?? DEFAULT_CONFIG.queue.defaultPriority),
    );

    const messageId = await ctx.db.insert("messageQueue", {
      conversationId: args.conversationId,
      agentKey: args.agentKey,
      payload: args.payload,
      status: "queued",
      priority,
      scheduledFor: args.scheduledFor ?? nowMs,
      attempts: 0,
      maxAttempts: args.maxAttempts ?? DEFAULT_CONFIG.retry.maxAttempts,
    });
    try {
      await ctx.scheduler.runAfter(0, (internal.scheduler as any).reconcileWorkerPoolFromEnqueue, {
        workspaceId: "default",
      });
    } catch (error) {
      console.warn(
        `[queue] failed to schedule reconcile after enqueue: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    return messageId;
  },
});

export const appendConversationMessages = mutation({
  args: {
    conversationId: v.string(),
    workspaceId: v.optional(v.string()),
    messages: v.array(
      v.object({
        role: v.union(
          v.literal("system"),
          v.literal("user"),
          v.literal("assistant"),
          v.literal("tool"),
        ),
        content: v.string(),
        at: v.optional(v.number()),
      }),
    ),
    nowMs: v.optional(v.number()),
  },
  returns: v.object({
    updated: v.boolean(),
    messageCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
      .unique();
    if (!conversation) {
      return { updated: false, messageCount: 0 };
    }
    const nowMs = args.nowMs ?? Date.now();
    const messages = args.messages.map((message, index) => ({
      role: message.role,
      content: message.content,
      at: message.at ?? nowMs + index,
    }));
    const nextContextHistory = [...conversation.contextHistory, ...messages];
    await ctx.db.patch(conversation._id, { contextHistory: nextContextHistory });
    const snapshotKey = `${args.workspaceId ?? "default"}:${conversation.agentKey}`;
    const cache = await ctx.db
      .query("conversationHydrationCache")
      .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
      .first();
    const deltaContext = nextContextHistory.slice(-64);
    const deltaFingerprint = fingerprintConversationDelta(deltaContext);
    if (!cache) {
      await ctx.db.insert("conversationHydrationCache", {
        conversationId: args.conversationId,
        agentKey: conversation.agentKey,
        snapshotKey,
        lastHydratedAt: nowMs,
        deltaContext,
        deltaFingerprint,
      });
    } else {
      await ctx.db.patch(cache._id, {
        agentKey: conversation.agentKey,
        snapshotKey,
        lastHydratedAt: nowMs,
        deltaContext,
        deltaFingerprint,
      });
    }
    return { updated: true, messageCount: messages.length };
  },
});

export const upsertAgentProfile = mutation({
  args: {
    agentKey: v.string(),
    version: v.string(),
    soulMd: v.string(),
    clientMd: v.optional(v.string()),
    skills: v.array(v.string()),
    secretsRef: v.array(v.string()),
    enabled: v.boolean(),
  },
  returns: v.id("agentProfiles"),
  handler: async (ctx, args) => {
    const defaultSecretsRef: Array<string> = ["convex.url", "fly.apiToken"];
    const secretsRef = Array.from(
      new Set([...args.secretsRef, ...defaultSecretsRef]),
    );
    const existing = await ctx.db
      .query("agentProfiles")
      .withIndex("by_agentKey", (q) => q.eq("agentKey", args.agentKey))
      .unique();
    if (!existing) {
      return await ctx.db.insert("agentProfiles", { ...args, secretsRef });
    }
    await ctx.db.patch(existing._id, { ...args, secretsRef });
    return existing._id;
  },
});

export const importPlaintextSecret = mutation({
  args: {
    secretRef: v.string(),
    plaintextValue: v.string(),
    metadata: v.optional(v.record(v.string(), v.string())),
  },
  returns: v.object({
    secretId: v.id("secrets"),
    secretRef: v.string(),
    version: v.number(),
  }),
  handler: async (ctx, args) => {
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
  },
});

export const getSecretsStatus = query({
  args: {
    secretRefs: v.array(v.string()),
  },
  returns: v.array(secretStatusValidator),
  handler: async (ctx, args) => {
    const statuses: Array<{
      secretRef: string;
      hasActive: boolean;
      version: number | null;
    }> = [];
    for (const ref of args.secretRefs) {
      const active = await ctx.db
        .query("secrets")
        .withIndex("by_secretRef_and_active", (q) =>
          q.eq("secretRef", ref).eq("active", true),
        )
        .unique();
      statuses.push({
        secretRef: ref,
        hasActive: active !== null,
        version: active?.version ?? null,
      });
    }
    return statuses;
  },
});

export const getActiveSecretPlaintext = internalQuery({
  args: {
    secretRef: v.string(),
  },
  returns: v.union(v.null(), v.string()),
  handler: async (ctx, args) => {
    const active = await ctx.db
      .query("secrets")
      .withIndex("by_secretRef_and_active", (q) =>
        q.eq("secretRef", args.secretRef).eq("active", true),
      )
      .unique();
    if (!active) {
      return null;
    }
    return decryptSecretValue(active.encryptedValue, active.algorithm);
  },
});

export const generateMediaUploadUrl = mutation({
  args: {},
  returns: v.object({
    uploadUrl: v.string(),
  }),
  handler: async (ctx) => {
    const uploadUrl = await ctx.storage.generateUploadUrl();
    return { uploadUrl };
  },
});

export const getStorageFileUrl = query({
  args: {
    storageId: v.id("_storage"),
  },
  returns: v.union(v.null(), v.string()),
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

export const attachMessageMetadata = mutation({
  args: {
    messageId: v.id("messageQueue"),
    metadata: v.record(v.string(), v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) return false;
    await ctx.db.patch(message._id, {
      payload: {
        ...message.payload,
        metadata: {
          ...(message.payload.metadata ?? {}),
          ...args.metadata,
        },
      },
    });
    return true;
  },
});

export const claimNextJob = mutation({
  args: {
    workerId: v.string(),
    nowMs: v.optional(v.number()),
  },
  returns: v.union(v.null(), claimedJobValidator),
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now();
    const candidates = await ctx.db
      .query("messageQueue")
      .withIndex("by_status_and_scheduledFor", (q) =>
        q.eq("status", "queued").lte("scheduledFor", nowMs),
      )
      .take(DEFAULT_CONFIG.queue.claimBatchSize);

    candidates.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      if (a.scheduledFor !== b.scheduledFor) return a.scheduledFor - b.scheduledFor;
      return a._creationTime - b._creationTime;
    });

    for (const candidate of candidates) {
      const conversation = await ctx.db
        .query("conversations")
        .withIndex("by_conversationId", (q) =>
          q.eq("conversationId", candidate.conversationId),
        )
        .unique();
      if (!conversation) continue;

      const lock = conversation.processingLock;
      if (lock && lock.leaseExpiresAt > nowMs) continue;

      const leaseId = `${nowMs}-${Math.random().toString(36).slice(2, 10)}`;
      const leaseExpiresAt = nowMs + DEFAULT_CONFIG.lease.leaseMs;

      await ctx.db.patch(candidate._id, {
        status: "processing",
        claimedBy: args.workerId,
        leaseId,
        leaseExpiresAt,
      });

      await ctx.db.patch(conversation._id, {
        processingLock: {
          leaseId,
          workerId: args.workerId,
          leaseExpiresAt,
          heartbeatAt: nowMs,
          claimedMessageId: candidate._id,
        },
      });

      const worker = await ctx.db
        .query("workers")
        .withIndex("by_workerId", (q) => q.eq("workerId", args.workerId))
        .unique();

      if (!worker) {
        await ctx.db.insert("workers", {
          workerId: args.workerId,
          provider: "fly",
          status: "active",
          load: 1,
          heartbeatAt: nowMs,
          lastClaimAt: nowMs,
          scheduledShutdownAt: undefined,
          stoppedAt: undefined,
          capabilities: [],
        });
      } else {
        await ctx.db.patch(worker._id, {
          status: "active",
          load: worker.load + 1,
          heartbeatAt: nowMs,
          lastClaimAt: nowMs,
          scheduledShutdownAt: undefined,
          stoppedAt: undefined,
        });
      }

      return {
        messageId: candidate._id,
        conversationId: candidate.conversationId,
        agentKey: candidate.agentKey,
        leaseId,
        leaseExpiresAt,
        payload: candidate.payload,
      };
    }
    return null;
  },
});

export const heartbeatJob = mutation({
  args: {
    workerId: v.string(),
    messageId: v.id("messageQueue"),
    leaseId: v.string(),
    nowMs: v.optional(v.number()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now();
    const message = await ctx.db.get(args.messageId);
    if (
      !message ||
      message.status !== "processing" ||
      message.leaseId !== args.leaseId ||
      message.claimedBy !== args.workerId
    ) {
      return false;
    }

    const leaseExpiresAt = nowMs + DEFAULT_CONFIG.lease.leaseMs;
    await ctx.db.patch(message._id, {
      leaseExpiresAt,
    });

    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", message.conversationId),
      )
      .unique();
    if (
      conversation?.processingLock &&
      conversation.processingLock.leaseId === args.leaseId
    ) {
      await ctx.db.patch(conversation._id, {
        processingLock: {
          ...conversation.processingLock,
          leaseExpiresAt,
          heartbeatAt: nowMs,
        },
      });
    }

    const worker = await ctx.db
      .query("workers")
      .withIndex("by_workerId", (q) => q.eq("workerId", args.workerId))
      .unique();
    if (worker?.status === "active") {
      await ctx.db.patch(worker._id, { heartbeatAt: nowMs });
    }

    return true;
  },
});

export const completeJob = mutation({
  args: {
    workerId: v.string(),
    messageId: v.id("messageQueue"),
    leaseId: v.string(),
    nowMs: v.optional(v.number()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now();
    const message = await ctx.db.get(args.messageId);
    if (
      !message ||
      message.status !== "processing" ||
      message.leaseId !== args.leaseId ||
      message.claimedBy !== args.workerId
    ) {
      return false;
    }

    await ctx.db.patch(message._id, {
      status: "done",
      claimedBy: undefined,
      leaseId: undefined,
      leaseExpiresAt: undefined,
      lastError: undefined,
      nextRetryAt: undefined,
    });

    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", message.conversationId),
      )
      .unique();
    if (
      conversation?.processingLock &&
      conversation.processingLock.claimedMessageId === message._id
    ) {
      await ctx.db.patch(conversation._id, { processingLock: undefined });
    }

    const worker = await ctx.db
      .query("workers")
      .withIndex("by_workerId", (q) => q.eq("workerId", args.workerId))
      .unique();
    if (worker) {
      const nextLoad = Math.max(0, worker.load - 1);
      const shutdownBaseMs = worker.lastClaimAt ?? nowMs;
      const nextScheduledShutdownAt =
        nextLoad === 0
          ? shutdownBaseMs + DEFAULT_CONFIG.scaling.idleTimeoutMs
          : undefined;
      await ctx.db.patch(worker._id, {
        load: nextLoad,
        heartbeatAt: nowMs,
        scheduledShutdownAt: nextScheduledShutdownAt,
        stoppedAt: undefined,
      });
      if (nextScheduledShutdownAt !== undefined) {
        const delayMs = Math.max(0, nextScheduledShutdownAt - nowMs) + 1_000;
        try {
          await ctx.scheduler.runAfter(
            delayMs,
            (internal.scheduler as any).enforceIdleShutdowns,
            {},
          );
        } catch (error) {
          console.warn(
            `[queue] failed to schedule idle-shutdown watchdog: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    }
    return true;
  },
});

export const failJob = mutation({
  args: {
    workerId: v.string(),
    messageId: v.id("messageQueue"),
    leaseId: v.string(),
    errorMessage: v.string(),
    nowMs: v.optional(v.number()),
  },
  returns: v.object({
    requeued: v.boolean(),
    deadLettered: v.boolean(),
    nextScheduledFor: v.union(v.null(), v.number()),
  }),
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now();
    const message = await ctx.db.get(args.messageId);
    if (
      !message ||
      message.status !== "processing" ||
      message.leaseId !== args.leaseId ||
      message.claimedBy !== args.workerId
    ) {
      return { requeued: false, deadLettered: false, nextScheduledFor: null };
    }

    const attempts = message.attempts + 1;
    const reachedMaxAttempts = attempts >= message.maxAttempts;
    let nextScheduledFor: number | null = null;

    if (reachedMaxAttempts) {
      await ctx.db.patch(message._id, {
        status: "dead_letter",
        attempts,
        deadLetteredAt: nowMs,
        lastError: args.errorMessage,
        claimedBy: undefined,
        leaseId: undefined,
        leaseExpiresAt: undefined,
      });
    } else {
      const retryDelayMs = computeRetryDelayMs(attempts, DEFAULT_CONFIG.retry, nowMs);
      nextScheduledFor = nowMs + retryDelayMs;
      await ctx.db.patch(message._id, {
        status: "queued",
        attempts,
        scheduledFor: nextScheduledFor,
        nextRetryAt: nextScheduledFor,
        lastError: args.errorMessage,
        claimedBy: undefined,
        leaseId: undefined,
        leaseExpiresAt: undefined,
      });
    }

    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", message.conversationId),
      )
      .unique();
    if (
      conversation?.processingLock &&
      conversation.processingLock.claimedMessageId === message._id
    ) {
      await ctx.db.patch(conversation._id, { processingLock: undefined });
    }

    const worker = await ctx.db
      .query("workers")
      .withIndex("by_workerId", (q) => q.eq("workerId", args.workerId))
      .unique();
    if (worker) {
      const nextLoad = Math.max(0, worker.load - 1);
      const shutdownBaseMs = worker.lastClaimAt ?? nowMs;
      const nextScheduledShutdownAt =
        nextLoad === 0
          ? shutdownBaseMs + DEFAULT_CONFIG.scaling.idleTimeoutMs
          : undefined;
      await ctx.db.patch(worker._id, {
        load: nextLoad,
        heartbeatAt: nowMs,
        scheduledShutdownAt: nextScheduledShutdownAt,
        stoppedAt: undefined,
      });
      if (nextScheduledShutdownAt !== undefined) {
        const delayMs = Math.max(0, nextScheduledShutdownAt - nowMs) + 1_000;
        try {
          await ctx.scheduler.runAfter(
            delayMs,
            (internal.scheduler as any).enforceIdleShutdowns,
            {},
          );
        } catch (error) {
          console.warn(
            `[queue] failed to schedule idle-shutdown watchdog: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    }

    return {
      requeued: !reachedMaxAttempts,
      deadLettered: reachedMaxAttempts,
      nextScheduledFor,
    };
  },
});

export const releaseExpiredLeases = internalMutation({
  args: {
    nowMs: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    requeued: v.number(),
    unlocked: v.number(),
  }),
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now();
    const limit = args.limit ?? 100;

    const stuck = await ctx.db
      .query("messageQueue")
      .withIndex("by_status_and_leaseExpiresAt", (q) =>
        q.eq("status", "processing").lte("leaseExpiresAt", nowMs),
      )
      .take(limit);

    let requeued = 0;
    let unlocked = 0;
    for (const message of stuck) {
      await ctx.db.patch(message._id, {
        status: "queued",
        scheduledFor: nowMs,
        claimedBy: undefined,
        leaseId: undefined,
        leaseExpiresAt: undefined,
        lastError: "Lease expired while processing",
      });
      requeued += 1;

      const conversation = await ctx.db
        .query("conversations")
        .withIndex("by_conversationId", (q) =>
          q.eq("conversationId", message.conversationId),
        )
        .unique();
      if (
        conversation?.processingLock &&
        conversation.processingLock.claimedMessageId === message._id
      ) {
        await ctx.db.patch(conversation._id, { processingLock: undefined });
        unlocked += 1;
      }
    }

    return { requeued, unlocked };
  },
});

export const releaseStuckJobs = mutation({
  args: {
    nowMs: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    requeued: v.number(),
    unlocked: v.number(),
  }),
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now();
    const limit = args.limit ?? 100;

    const stuck = await ctx.db
      .query("messageQueue")
      .withIndex("by_status_and_leaseExpiresAt", (q) =>
        q.eq("status", "processing").lte("leaseExpiresAt", nowMs),
      )
      .take(limit);

    let requeued = 0;
    let unlocked = 0;
    for (const message of stuck) {
      await ctx.db.patch(message._id, {
        status: "queued",
        scheduledFor: nowMs,
        claimedBy: undefined,
        leaseId: undefined,
        leaseExpiresAt: undefined,
        lastError: "Lease expired while processing",
      });
      requeued += 1;

      const conversation = await ctx.db
        .query("conversations")
        .withIndex("by_conversationId", (q) =>
          q.eq("conversationId", message.conversationId),
        )
        .unique();
      if (
        conversation?.processingLock &&
        conversation.processingLock.claimedMessageId === message._id
      ) {
        await ctx.db.patch(conversation._id, { processingLock: undefined });
        unlocked += 1;
      }
    }

    return { requeued, unlocked };
  },
});

export const getHydrationBundleForClaimedJob = query({
  args: {
    messageId: v.id("messageQueue"),
    workspaceId: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      messageId: v.id("messageQueue"),
      conversationId: v.string(),
      agentKey: v.string(),
      payload: queuePayloadValidator,
      conversationState: v.object({
        contextHistory: v.array(
          v.object({
            role: v.union(
              v.literal("system"),
              v.literal("user"),
              v.literal("assistant"),
              v.literal("tool"),
            ),
            content: v.string(),
            at: v.number(),
          }),
        ),
        pendingToolCalls: v.array(
          v.object({
            toolName: v.string(),
            callId: v.string(),
            status: v.union(
              v.literal("pending"),
              v.literal("running"),
              v.literal("done"),
              v.literal("failed"),
            ),
          }),
        ),
      }),
      telegramBotToken: v.union(v.null(), v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message || message.status !== "processing") return null;

    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", message.conversationId),
      )
      .unique();
    const profile = await ctx.db
      .query("agentProfiles")
      .withIndex("by_agentKey", (q) => q.eq("agentKey", message.agentKey))
      .unique();
    if (!conversation || !profile) return null;

    const snapshotKey = `${args.workspaceId}:${message.agentKey}`;
    const conversationCache = await ctx.db
      .query("conversationHydrationCache")
      .withIndex("by_conversationId", (q) => q.eq("conversationId", message.conversationId))
      .first();

    let telegramBotToken: string | null = null;
    const telegramSecretRefs = profile.secretsRef.filter(
      (ref) => ref === "telegram.botToken" || ref.startsWith("telegram.botToken."),
    );
    for (const telegramSecretRef of telegramSecretRefs) {
      const activeSecret = await ctx.db
        .query("secrets")
        .withIndex("by_secretRef_and_active", (q) =>
          q.eq("secretRef", telegramSecretRef).eq("active", true),
        )
        .unique();
      if (activeSecret) {
        telegramBotToken = decryptSecretValue(activeSecret.encryptedValue, activeSecret.algorithm);
        break;
      }
    }

    const contextHistory =
      conversationCache && conversationCache.snapshotKey === snapshotKey
        ? conversationCache.deltaContext
        : conversation.contextHistory;

    return {
      messageId: message._id,
      conversationId: message.conversationId,
      agentKey: message.agentKey,
      payload: message.payload,
      conversationState: {
        contextHistory,
        pendingToolCalls: conversation.pendingToolCalls,
      },
      telegramBotToken,
    };
  },
});

export const getQueueStats = query({
  args: {
    nowMs: v.optional(v.number()),
  },
  returns: v.object({
    queuedReady: v.number(),
    processing: v.number(),
    deadLetter: v.number(),
  }),
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now();
    const queued = await ctx.db
      .query("messageQueue")
      .withIndex("by_status_and_scheduledFor", (q) => q.eq("status", "queued"))
      .collect();

    const processing = await ctx.db
      .query("messageQueue")
      .withIndex("by_status_and_scheduledFor", (q) => q.eq("status", "processing"))
      .collect();

    const deadLetter = await ctx.db
      .query("messageQueue")
      .withIndex("by_status_and_scheduledFor", (q) => q.eq("status", "dead_letter"))
      .collect();

    return {
      queuedReady: queued.filter((job) => job.scheduledFor <= nowMs).length,
      processing: processing.length,
      deadLetter: deadLetter.length,
    };
  },
});

export const hasQueuedJobsForConversation = query({
  args: {
    conversationId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const queuedJob = await ctx.db
      .query("messageQueue")
      .withIndex("by_conversationId_and_status", (q) =>
        q.eq("conversationId", args.conversationId).eq("status", "queued"),
      )
      .first();

    return queuedJob !== null;
  },
});

export const getReadyConversationCountForScheduler = internalQuery({
  args: {
    nowMs: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now();
    const limit = Math.max(1, args.limit ?? 1000);
    const queuedJobs = await ctx.db
      .query("messageQueue")
      .withIndex("by_status_and_scheduledFor", (q) =>
        q.eq("status", "queued").lte("scheduledFor", nowMs),
      )
      .take(limit);
    const conversationIds = [...new Set(queuedJobs.map((job) => job.conversationId))];
    let readyConversations = 0;
    for (const conversationId of conversationIds) {
      const conversation = await ctx.db
        .query("conversations")
        .withIndex("by_conversationId", (q) => q.eq("conversationId", conversationId))
        .unique();
      const lock = conversation?.processingLock;
      if (!lock || lock.leaseExpiresAt <= nowMs) {
        readyConversations += 1;
      }
    }
    return readyConversations;
  },
});

export const getActiveConversationCountForScheduler = internalQuery({
  args: {
    nowMs: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now();
    const limit = Math.max(1, args.limit ?? 1000);
    const queuedJobs = await ctx.db
      .query("messageQueue")
      .withIndex("by_status_and_scheduledFor", (q) =>
        q.eq("status", "queued").lte("scheduledFor", nowMs),
      )
      .take(limit);
    const processingJobs = await ctx.db
      .query("messageQueue")
      .withIndex("by_status_and_leaseExpiresAt", (q) =>
        q.eq("status", "processing").gt("leaseExpiresAt", nowMs),
      )
      .take(limit);

    const conversationIds = new Set<string>();
    for (const job of queuedJobs) {
      conversationIds.add(job.conversationId);
    }
    for (const job of processingJobs) {
      conversationIds.add(job.conversationId);
    }
    return conversationIds.size;
  },
});

export const listJobsByStatus = query({
  args: {
    status: queueStatusValidator,
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("messageQueue"),
      _creationTime: v.number(),
      conversationId: v.string(),
      agentKey: v.string(),
      status: queueStatusValidator,
      priority: v.number(),
      scheduledFor: v.number(),
      attempts: v.number(),
      maxAttempts: v.number(),
      lastError: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const jobs = await ctx.db
      .query("messageQueue")
      .withIndex("by_status_and_scheduledFor", (q) => q.eq("status", args.status))
      .order("asc")
      .take(args.limit ?? 100);
    return jobs.map((job) => ({
      _id: job._id,
      _creationTime: job._creationTime,
      conversationId: job.conversationId,
      agentKey: job.agentKey,
      status: job.status,
      priority: job.priority,
      scheduledFor: job.scheduledFor,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      lastError: job.lastError,
    }));
  },
});

export const upsertWorkerState = internalMutation({
  args: {
    workerId: v.string(),
    provider: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("stopped"),
    ),
    load: v.number(),
    nowMs: v.optional(v.number()),
    scheduledShutdownAt: v.optional(v.number()),
    stoppedAt: v.optional(v.number()),
    machineId: v.optional(v.string()),
    appName: v.optional(v.string()),
    region: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now();
    const worker = await ctx.db
      .query("workers")
      .withIndex("by_workerId", (q) => q.eq("workerId", args.workerId))
      .unique();
    if (!worker) {
      await ctx.db.insert("workers", {
        workerId: args.workerId,
        provider: args.provider,
        status: args.status,
        load: args.load,
        heartbeatAt: nowMs,
        scheduledShutdownAt: args.scheduledShutdownAt,
        stoppedAt: args.status === "stopped" ? (args.stoppedAt ?? nowMs) : undefined,
        machineRef:
          args.machineId && args.appName
            ? {
                appName: args.appName,
                machineId: args.machineId,
                region: args.region,
              }
            : undefined,
        capabilities: [],
      });
      return null;
    }

    await ctx.db.patch(worker._id, {
      status: args.status,
      load: args.load,
      heartbeatAt: args.status === "active" ? nowMs : worker.heartbeatAt,
      scheduledShutdownAt: args.scheduledShutdownAt ?? worker.scheduledShutdownAt,
      stoppedAt:
        args.status === "active"
          ? undefined
          : (args.stoppedAt ?? worker.stoppedAt ?? nowMs),
      machineRef:
        args.machineId && args.appName
          ? {
              appName: args.appName,
              machineId: args.machineId,
              region: args.region,
            }
          : worker.machineRef,
    });
    return null;
  },
});

export const getWorkerControlState = query({
  args: {
    workerId: v.string(),
  },
  returns: v.object({
    shouldStop: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const worker = await ctx.db
      .query("workers")
      .withIndex("by_workerId", (q) => q.eq("workerId", args.workerId))
      .unique();
    return {
      shouldStop: !worker || worker.status === "stopped",
    };
  },
});

export const prepareDataSnapshotUpload = mutation({
  args: {
    workerId: v.string(),
    workspaceId: v.string(),
    agentKey: v.string(),
    conversationId: v.optional(v.string()),
    reason: snapshotReasonValidator,
    nowMs: v.optional(v.number()),
  },
  returns: v.object({
    snapshotId: v.id("dataSnapshots"),
    uploadUrl: v.string(),
    expiresAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now();
    const expiresAt = nowMs + DATA_SNAPSHOT_RETENTION_MS;
    const snapshotId = await ctx.db.insert("dataSnapshots", {
      workspaceId: args.workspaceId,
      agentKey: args.agentKey,
      workerId: args.workerId,
      conversationId: args.conversationId,
      reason: args.reason,
      formatVersion: 1,
      status: "uploading",
      createdAt: nowMs,
      expiresAt,
    });
    const uploadUrl = await ctx.storage.generateUploadUrl();
    return { snapshotId, uploadUrl, expiresAt };
  },
});

export const finalizeDataSnapshotUpload = mutation({
  args: {
    workerId: v.string(),
    snapshotId: v.id("dataSnapshots"),
    storageId: v.id("_storage"),
    sha256: v.string(),
    sizeBytes: v.number(),
    nowMs: v.optional(v.number()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now();
    const snapshot = await ctx.db.get(args.snapshotId);
    if (!snapshot || snapshot.workerId !== args.workerId) return false;
    await ctx.db.patch(snapshot._id, {
      archiveFileId: args.storageId,
      sha256: args.sha256,
      sizeBytes: args.sizeBytes,
      status: "ready",
      completedAt: nowMs,
    });
    const worker = await ctx.db
      .query("workers")
      .withIndex("by_workerId", (q) => q.eq("workerId", args.workerId))
      .unique();
    if (worker) {
      await ctx.db.patch(worker._id, {
        lastSnapshotId: snapshot._id,
      });
    }
    return true;
  },
});

export const failDataSnapshotUpload = mutation({
  args: {
    workerId: v.string(),
    snapshotId: v.id("dataSnapshots"),
    error: v.string(),
    nowMs: v.optional(v.number()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now();
    const snapshot = await ctx.db.get(args.snapshotId);
    if (!snapshot || snapshot.workerId !== args.workerId) return false;
    await ctx.db.patch(snapshot._id, {
      status: "failed",
      error: args.error,
      completedAt: nowMs,
    });
    return true;
  },
});

export const getLatestDataSnapshotForRestore = query({
  args: {
    workspaceId: v.string(),
    agentKey: v.string(),
    conversationId: v.optional(v.string()),
    nowMs: v.optional(v.number()),
  },
  returns: v.union(
    v.null(),
    v.object({
      snapshotId: v.id("dataSnapshots"),
      downloadUrl: v.string(),
      sha256: v.union(v.null(), v.string()),
      sizeBytes: v.union(v.null(), v.number()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now();
    const candidates = await ctx.db
      .query("dataSnapshots")
      .withIndex("by_workspaceId_and_agentKey_and_createdAt", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("agentKey", args.agentKey),
      )
      .order("desc")
      .take(50);
    const ready = candidates.filter(
      (snapshot) =>
        snapshot.status === "ready" &&
        snapshot.archiveFileId !== undefined &&
        snapshot.expiresAt > nowMs,
    );
    const preferred =
      (args.conversationId
        ? ready.find((snapshot) => snapshot.conversationId === args.conversationId)
        : undefined) ?? ready[0];
    if (!preferred || !preferred.archiveFileId) return null;
    const downloadUrl = await ctx.storage.getUrl(preferred.archiveFileId);
    if (!downloadUrl) return null;
    return {
      snapshotId: preferred._id,
      downloadUrl,
      sha256: preferred.sha256 ?? null,
      sizeBytes: preferred.sizeBytes ?? null,
      createdAt: preferred.createdAt,
    };
  },
});

export const listWorkersForScheduler = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      workerId: v.string(),
      status: v.union(
        v.literal("active"),
        v.literal("stopped"),
      ),
      load: v.number(),
      heartbeatAt: v.number(),
      lastClaimAt: v.union(v.null(), v.number()),
      scheduledShutdownAt: v.union(v.null(), v.number()),
      stoppedAt: v.union(v.null(), v.number()),
      machineId: v.union(v.null(), v.string()),
      appName: v.union(v.null(), v.string()),
      region: v.union(v.null(), v.string()),
    }),
  ),
  handler: async (ctx) => {
    const rows = await ctx.db.query("workers").collect();
    return rows.map((worker) => ({
      workerId: worker.workerId,
      status: worker.status,
      load: worker.load,
      heartbeatAt: worker.heartbeatAt,
      lastClaimAt: worker.lastClaimAt ?? null,
      scheduledShutdownAt: worker.scheduledShutdownAt ?? null,
      stoppedAt: worker.stoppedAt ?? null,
      machineId: worker.machineRef?.machineId ?? null,
      appName: worker.machineRef?.appName ?? null,
      region: worker.machineRef?.region ?? null,
    }));
  },
});

export const expireOldDataSnapshots = internalMutation({
  args: {
    nowMs: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now();
    const limit = args.limit ?? 100;
    const rows = await ctx.db
      .query("dataSnapshots")
      .withIndex("by_status_and_expiresAt", (q) =>
        q.eq("status", "ready").lte("expiresAt", nowMs),
      )
      .take(limit);
    for (const row of rows) {
      await ctx.db.patch(row._id, { status: "expired" });
    }
    return rows.length;
  },
});

export const getWorkerStats = query({
  args: {},
  returns: v.object({
    activeCount: v.number(),
    idleCount: v.number(),
    workers: v.array(
      v.object({
        workerId: v.string(),
        status: v.union(
          v.literal("active"),
          v.literal("stopped"),
        ),
        load: v.number(),
        heartbeatAt: v.number(),
        machineId: v.union(v.null(), v.string()),
        appName: v.union(v.null(), v.string()),
      }),
    ),
  }),
  handler: async (ctx) => {
    const activeWorkers = await ctx.db
      .query("workers")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    const withLoad = activeWorkers.filter((w) => w.load > 0);
    const idle = activeWorkers.filter((w) => w.load === 0);

    return {
      activeCount: withLoad.length,
      idleCount: idle.length,
      workers: activeWorkers.map((worker) => ({
        workerId: worker.workerId,
        status: worker.status,
        load: worker.load,
        heartbeatAt: worker.heartbeatAt,
        machineId: worker.machineRef?.machineId ?? null,
        appName: worker.machineRef?.appName ?? null,
      })),
    };
  },
});

function fingerprintConversationDelta(
  deltaContext: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string; at: number }>,
): string {
  const payload = deltaContext.map((entry) => `${entry.role}:${entry.at}:${entry.content}`).join("|");
  let hash = 2166136261;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `f${(hash >>> 0).toString(16)}`;
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

function decryptSecretValue(encryptedValue: string, algorithm: string): string {
  if (algorithm !== "xor-hex-v1") {
    throw new Error(`Unsupported secret algorithm '${algorithm}'`);
  }
  if (encryptedValue.length % 4 !== 0) {
    throw new Error("Invalid secret payload");
  }

  let out = "";
  for (let i = 0; i < encryptedValue.length; i += 4) {
    const chunk = encryptedValue.slice(i, i + 4);
    const value = Number.parseInt(chunk, 16);
    if (Number.isNaN(value)) {
      throw new Error("Invalid secret payload");
    }
    const mask = 11 + ((i / 4) % 7);
    out += String.fromCharCode(value ^ mask);
  }
  return out;
}
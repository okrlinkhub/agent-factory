import { v } from "convex/values";
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

    return await ctx.db.insert("messageQueue", {
      conversationId: args.conversationId,
      agentKey: args.agentKey,
      payload: args.payload,
      status: "queued",
      priority,
      scheduledFor: args.scheduledFor ?? nowMs,
      attempts: 0,
      maxAttempts: args.maxAttempts ?? DEFAULT_CONFIG.retry.maxAttempts,
    });
  },
});

export const upsertAgentProfile = mutation({
  args: {
    agentKey: v.string(),
    version: v.string(),
    soulMd: v.string(),
    clientMd: v.optional(v.string()),
    skills: v.array(v.string()),
    runtimeConfig: v.record(
      v.string(),
      v.union(v.string(), v.number(), v.boolean()),
    ),
    secretsRef: v.array(v.string()),
    enabled: v.boolean(),
  },
  returns: v.id("agentProfiles"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("agentProfiles")
      .withIndex("by_agentKey", (q) => q.eq("agentKey", args.agentKey))
      .unique();
    if (!existing) {
      return await ctx.db.insert("agentProfiles", args);
    }
    await ctx.db.patch(existing._id, args);
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
          capabilities: [],
        });
      } else {
        await ctx.db.patch(worker._id, {
          status: "active",
          load: worker.load + 1,
          heartbeatAt: nowMs,
          lastClaimAt: nowMs,
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
    if (worker) {
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
      await ctx.db.patch(worker._id, {
        load: Math.max(0, worker.load - 1),
        heartbeatAt: nowMs,
      });
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
      await ctx.db.patch(worker._id, {
        load: Math.max(0, worker.load - 1),
        heartbeatAt: nowMs,
      });
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

export const prepareHydrationSnapshot = internalMutation({
  args: {
    workspaceId: v.string(),
    agentKey: v.string(),
    nowMs: v.optional(v.number()),
  },
  returns: v.object({
    snapshotId: v.id("hydrationSnapshots"),
    snapshotKey: v.string(),
    reused: v.boolean(),
    expiresAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now();
    const snapshotKey = `${args.workspaceId}:${args.agentKey}`;
    const agentProfile = await ctx.db
      .query("agentProfiles")
      .withIndex("by_agentKey", (q) => q.eq("agentKey", args.agentKey))
      .unique();
    if (!agentProfile) throw new Error(`Agent profile '${args.agentKey}' not found`);

    const docs = await ctx.db
      .query("workspaceDocuments")
      .withIndex("by_workspaceId_and_updatedAt", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(200);

    const skills = (
      await ctx.db
        .query("agentSkills")
        .withIndex("by_agentKey_and_enabled", (q) =>
          q.eq("agentKey", args.agentKey).eq("enabled", true),
        )
        .collect()
    ).filter((skill) => skill.workspaceId === args.workspaceId);

    const secretFingerprints: Array<string> = [];
    for (const ref of agentProfile.secretsRef) {
      const activeSecret = await ctx.db
        .query("secrets")
        .withIndex("by_secretRef_and_active", (q) =>
          q.eq("secretRef", ref).eq("active", true),
        )
        .unique();
      if (activeSecret) {
        secretFingerprints.push(`${activeSecret.secretRef}:${activeSecret.version}`);
      }
    }

    const sourceFingerprint = [
      agentProfile.version,
      ...docs.map((doc) => `${doc.path}:${doc.contentHash}:${doc.version}`),
      ...skills.map((skill) => `${skill.skillKey}:${skill.updatedAt}`),
      ...secretFingerprints,
    ].join("|");

    const existing = await ctx.db
      .query("hydrationSnapshots")
      .withIndex("by_snapshotKey", (q) => q.eq("snapshotKey", snapshotKey))
      .first();

    const expiresAt = nowMs + DEFAULT_CONFIG.hydration.snapshotTtlMs;
    if (
      existing &&
      existing.sourceFingerprint === sourceFingerprint &&
      existing.expiresAt > nowMs &&
      existing.status === "ready"
    ) {
      return {
        snapshotId: existing._id,
        snapshotKey,
        reused: true,
        expiresAt: existing.expiresAt,
      };
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "stale",
        expiresAt: nowMs,
      });
    }

    const promptSections = docs
      .filter((doc) => doc.isActive)
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((doc) => ({
        section: `${doc.docType}:${doc.path}`,
        content: doc.content,
      }));

    const memoryWindow = docs
      .filter(
        (doc) =>
          doc.docType === "memory_daily" || doc.docType === "memory_longterm",
      )
      .slice(0, 10)
      .map((doc) => ({
        path: doc.path,
        excerpt: doc.content.slice(0, 2_000),
      }));

    const snapshotId = await ctx.db.insert("hydrationSnapshots", {
      workspaceId: args.workspaceId,
      agentKey: args.agentKey,
      snapshotKey,
      snapshotVersion: (existing?.snapshotVersion ?? 0) + 1,
      sourceFingerprint,
      compiledPromptStack: promptSections,
      skillsBundle: skills.map((skill) => ({
        skillKey: skill.skillKey,
        manifestMd: skill.manifestMd,
      })),
      memoryWindow,
      tokenEstimate: estimateTokens(promptSections, memoryWindow),
      builtAt: nowMs,
      expiresAt,
      status: "ready",
    });

    return {
      snapshotId,
      snapshotKey,
      reused: false,
      expiresAt,
    };
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
      snapshot: v.union(
        v.null(),
        v.object({
          snapshotId: v.id("hydrationSnapshots"),
          snapshotKey: v.string(),
          compiledPromptStack: v.array(
            v.object({
              section: v.string(),
              content: v.string(),
            }),
          ),
          skillsBundle: v.array(
            v.object({
              skillKey: v.string(),
              manifestMd: v.string(),
            }),
          ),
          memoryWindow: v.array(
            v.object({
              path: v.string(),
              excerpt: v.string(),
            }),
          ),
        }),
      ),
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
      secretRefs: v.array(v.string()),
      secretValues: v.record(v.string(), v.string()),
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
    const snapshot = await ctx.db
      .query("hydrationSnapshots")
      .withIndex("by_snapshotKey", (q) => q.eq("snapshotKey", snapshotKey))
      .first();

    const secretValues: Record<string, string> = {};
    for (const secretRef of profile.secretsRef) {
      const activeSecret = await ctx.db
        .query("secrets")
        .withIndex("by_secretRef_and_active", (q) =>
          q.eq("secretRef", secretRef).eq("active", true),
        )
        .unique();
      if (!activeSecret) continue;
      secretValues[secretRef] = decryptSecretValue(
        activeSecret.encryptedValue,
        activeSecret.algorithm,
      );
    }

    const telegramSecretRef = profile.secretsRef.find(
      (ref) => ref === "telegram.botToken" || ref.startsWith("telegram.botToken."),
    );
    const telegramBotToken = telegramSecretRef ? secretValues[telegramSecretRef] ?? null : null;

    return {
      messageId: message._id,
      conversationId: message.conversationId,
      agentKey: message.agentKey,
      payload: message.payload,
      snapshot: snapshot
        ? {
            snapshotId: snapshot._id,
            snapshotKey: snapshot.snapshotKey,
            compiledPromptStack: snapshot.compiledPromptStack,
            skillsBundle: snapshot.skillsBundle,
            memoryWindow: snapshot.memoryWindow,
          }
        : null,
      conversationState: {
        contextHistory: conversation.contextHistory,
        pendingToolCalls: conversation.pendingToolCalls,
      },
      secretRefs: profile.secretsRef,
      secretValues,
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
      v.literal("starting"),
      v.literal("active"),
      v.literal("idle"),
      v.literal("draining"),
      v.literal("stopped"),
      v.literal("failed"),
    ),
    load: v.number(),
    nowMs: v.optional(v.number()),
    scheduledShutdownAt: v.optional(v.number()),
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
      heartbeatAt: nowMs,
      scheduledShutdownAt: args.scheduledShutdownAt,
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

export const getWorkerStats = query({
  args: {},
  returns: v.object({
    activeCount: v.number(),
    idleCount: v.number(),
    workers: v.array(
      v.object({
        workerId: v.string(),
        status: v.union(
          v.literal("starting"),
          v.literal("active"),
          v.literal("idle"),
          v.literal("draining"),
          v.literal("stopped"),
          v.literal("failed"),
        ),
        load: v.number(),
        heartbeatAt: v.number(),
        machineId: v.union(v.null(), v.string()),
        appName: v.union(v.null(), v.string()),
      }),
    ),
  }),
  handler: async (ctx) => {
    const workers = await ctx.db
      .query("workers")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    const idleWorkers = await ctx.db
      .query("workers")
      .withIndex("by_status", (q) => q.eq("status", "idle"))
      .collect();
    const startingWorkers = await ctx.db
      .query("workers")
      .withIndex("by_status", (q) => q.eq("status", "starting"))
      .collect();

    const merged = [...workers, ...idleWorkers, ...startingWorkers];
    return {
      activeCount: workers.length + startingWorkers.length,
      idleCount: idleWorkers.length,
      workers: merged.map((worker) => ({
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

export const listHydrationRebuildTargets = internalQuery({
  args: {
    nowMs: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      workspaceId: v.string(),
      agentKey: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now();
    const limit = args.limit ?? 100;
    const expiredReady = await ctx.db
      .query("hydrationSnapshots")
      .withIndex("by_status_and_expiresAt", (q) =>
        q.eq("status", "ready").lte("expiresAt", nowMs),
      )
      .take(limit);

    const stale = await ctx.db
      .query("hydrationSnapshots")
      .withIndex("by_status_and_expiresAt", (q) => q.eq("status", "stale"))
      .take(limit);

    const unique = new Map<string, { workspaceId: string; agentKey: string }>();
    for (const row of [...expiredReady, ...stale]) {
      const key = `${row.workspaceId}:${row.agentKey}`;
      if (!unique.has(key)) {
        unique.set(key, { workspaceId: row.workspaceId, agentKey: row.agentKey });
      }
      if (unique.size >= limit) break;
    }
    return [...unique.values()];
  },
});

function estimateTokens(
  promptSections: Array<{ section: string; content: string }>,
  memoryWindow: Array<{ path: string; excerpt: string }>,
): number {
  const sectionChars = promptSections.reduce(
    (sum, section) => sum + section.section.length + section.content.length,
    0,
  );
  const memoryChars = memoryWindow.reduce(
    (sum, memory) => sum + memory.path.length + memory.excerpt.length,
    0,
  );
  return Math.ceil((sectionChars + memoryChars) / 4);
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

import { v } from "convex/values";
import { internal } from "./_generated/api.js";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server.js";
import { computeRetryDelayMs, DEFAULT_CONFIG, providerConfigValidator } from "./config.js";
import {
  canTransitionWorkerStatus,
  isWorkerClaimable,
  isWorkerRunning,
  isWorkerTerminal,
  workerStatusValidator,
} from "./workerLifecycle.js";

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

const workerAssignmentValidator = v.object({
  conversationId: v.string(),
  agentKey: v.string(),
  leaseId: v.string(),
  assignedAt: v.number(),
});

const secretStatusValidator = v.object({
  secretRef: v.string(),
  hasActive: v.boolean(),
  version: v.union(v.null(), v.number()),
});

const bridgeProfileConfigValidator = v.object({
  enabled: v.boolean(),
  baseUrl: v.optional(v.string()),
  serviceId: v.optional(v.string()),
  appKey: v.optional(v.string()),
  serviceKeySecretRef: v.optional(v.string()),
  appBaseUrlMapJsonSecretRef: v.optional(v.string()),
});

const bridgeRuntimeConfigValidator = v.object({
  baseUrl: v.union(v.null(), v.string()),
  appBaseUrlMapJson: v.union(v.null(), v.string()),
  serviceId: v.union(v.null(), v.string()),
  appKey: v.union(v.null(), v.string()),
  serviceKey: v.union(v.null(), v.string()),
  serviceKeySecretRef: v.union(v.null(), v.string()),
});

const messageRuntimeConfigValidator = v.object({
  systemPrompt: v.optional(v.string()),
});

const globalSkillStatusValidator = v.union(v.literal("active"), v.literal("disabled"));
const globalSkillReleaseChannelValidator = v.union(v.literal("stable"), v.literal("canary"));
const globalSkillModuleFormatValidator = v.union(v.literal("esm"), v.literal("cjs"));

const globalSkillManifestItemValidator = v.object({
  slug: v.string(),
  version: v.string(),
  moduleFormat: globalSkillModuleFormatValidator,
  entryPoint: v.string(),
  sourceJs: v.string(),
  sha256: v.string(),
});

const BRIDGE_SECRET_REFS = {
  serviceKey: "agent-bridge.serviceKey",
  baseUrl: "agent-bridge.baseUrl",
  baseUrlMapJson: "agent-bridge.baseUrlMapJson",
  serviceId: "agent-bridge.serviceId",
  appKey: "agent-bridge.appKey",
} as const;

const RUNTIME_CONFIG_KEYS = {
  provider: "provider",
  message: "message",
} as const;

export const enqueueMessage = mutation({
  args: {
    conversationId: v.string(),
    agentKey: v.string(),
    payload: queuePayloadValidator,
    priority: v.optional(v.number()),
    scheduledFor: v.optional(v.number()),
    maxAttempts: v.optional(v.number()),
    nowMs: v.optional(v.number()),
    providerConfig: v.optional(providerConfigValidator),
  },
  returns: v.id("messageQueue"),
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now();
    const messageRuntimeConfigRow = await ctx.db
      .query("runtimeConfig")
      .withIndex("by_key", (q) => q.eq("key", RUNTIME_CONFIG_KEYS.message))
      .unique();
    const profile = await ctx.db
      .query("agentProfiles")
      .withIndex("by_agentKey", (q) => q.eq("agentKey", args.agentKey))
      .unique();
    if (!profile || !profile.enabled) {
      throw new Error(`Agent profile '${args.agentKey}' not found or disabled`);
    }
    const providerUserIdStr =
      typeof args.payload.providerUserId === "string" &&
      args.payload.providerUserId.trim().length > 0
        ? args.payload.providerUserId.trim()
        : null;

    if (providerUserIdStr === null) {
      throw new Error(
        `providerUserId is required but missing in payload.providerUserId=${JSON.stringify(args.payload.providerUserId)}`,
      );
    }

    const payload = {
      ...args.payload,
      messageText: appendSystemPromptToMessage(
        args.payload.messageText,
        messageRuntimeConfigRow?.messageConfig?.systemPrompt,
      ),
      providerUserId: providerUserIdStr,
      metadata: {
        ...(args.payload.metadata ?? {}),
        providerUserId: providerUserIdStr,
      },
    };

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
    } else if (existingConversation.agentKey !== args.agentKey) {
      throw new Error(
        `Conversation '${args.conversationId}' is already bound to agent '${existingConversation.agentKey}', cannot enqueue for '${args.agentKey}'.`,
      );
    }

    const priority = Math.min(
      DEFAULT_CONFIG.queue.maxPriority,
      Math.max(0, args.priority ?? DEFAULT_CONFIG.queue.defaultPriority),
    );

    const messageId = await ctx.db.insert("messageQueue", {
      conversationId: args.conversationId,
      agentKey: args.agentKey,
      payload,
      status: "queued",
      priority,
      scheduledFor: args.scheduledFor ?? nowMs,
      attempts: 0,
      maxAttempts: args.maxAttempts ?? DEFAULT_CONFIG.retry.maxAttempts,
    });
    try {
      await ctx.scheduler.runAfter(0, (internal.scheduler as any).reconcileWorkerPoolFromEnqueue, {
        workspaceId: "default",
        providerConfig: args.providerConfig,
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
    secretsRef: v.array(v.string()),
    bridgeConfig: v.optional(bridgeProfileConfigValidator),
    enabled: v.boolean(),
  },
  returns: v.id("agentProfiles"),
  handler: async (ctx, args) => {
    const defaultSecretsRef: Array<string> = ["convex.url", "fly.apiToken"];
    const bridgeSecretsRef = getBridgeSecretRefsForProfile(args.agentKey, args.bridgeConfig);
    const secretsRef = Array.from(
      new Set([...args.secretsRef, ...defaultSecretsRef, ...bridgeSecretsRef]),
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

export const getProviderRuntimeConfig = internalQuery({
  args: {},
  returns: v.union(v.null(), providerConfigValidator),
  handler: async (ctx) => {
    const row = await ctx.db
      .query("runtimeConfig")
      .withIndex("by_key", (q) => q.eq("key", RUNTIME_CONFIG_KEYS.provider))
      .unique();
    if (!row?.providerConfig) {
      return null;
    }
    return row.providerConfig;
  },
});

export const upsertProviderRuntimeConfig = internalMutation({
  args: {
    providerConfig: providerConfigValidator,
    nowMs: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now();
    const existing = await ctx.db
      .query("runtimeConfig")
      .withIndex("by_key", (q) => q.eq("key", RUNTIME_CONFIG_KEYS.provider))
      .unique();
    if (!existing) {
      await ctx.db.insert("runtimeConfig", {
        key: RUNTIME_CONFIG_KEYS.provider,
        providerConfig: args.providerConfig,
        updatedAt: nowMs,
      });
      return null;
    }
    await ctx.db.patch(existing._id, {
      providerConfig: args.providerConfig,
      updatedAt: nowMs,
    });
    return null;
  },
});

export const providerRuntimeConfig = query({
  args: {},
  returns: v.union(v.null(), providerConfigValidator),
  handler: async (ctx) => {
    const row = await ctx.db
      .query("runtimeConfig")
      .withIndex("by_key", (q) => q.eq("key", RUNTIME_CONFIG_KEYS.provider))
      .unique();
    if (!row?.providerConfig) {
      return null;
    }
    return row.providerConfig;
  },
});

export const setProviderRuntimeConfig = mutation({
  args: {
    providerConfig: providerConfigValidator,
    nowMs: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now();
    const existing = await ctx.db
      .query("runtimeConfig")
      .withIndex("by_key", (q) => q.eq("key", RUNTIME_CONFIG_KEYS.provider))
      .unique();
    if (!existing) {
      await ctx.db.insert("runtimeConfig", {
        key: RUNTIME_CONFIG_KEYS.provider,
        providerConfig: args.providerConfig,
        updatedAt: nowMs,
      });
      return null;
    }
    await ctx.db.patch(existing._id, {
      providerConfig: args.providerConfig,
      updatedAt: nowMs,
    });
    return null;
  },
});

export const getMessageRuntimeConfig = internalQuery({
  args: {},
  returns: v.union(v.null(), messageRuntimeConfigValidator),
  handler: async (ctx) => {
    const row = await ctx.db
      .query("runtimeConfig")
      .withIndex("by_key", (q) => q.eq("key", RUNTIME_CONFIG_KEYS.message))
      .unique();
    if (!row?.messageConfig) {
      return null;
    }
    return row.messageConfig;
  },
});

export const upsertMessageRuntimeConfig = internalMutation({
  args: {
    messageConfig: messageRuntimeConfigValidator,
    nowMs: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now();
    const normalizedMessageConfig = normalizeMessageRuntimeConfig(args.messageConfig);
    const existing = await ctx.db
      .query("runtimeConfig")
      .withIndex("by_key", (q) => q.eq("key", RUNTIME_CONFIG_KEYS.message))
      .unique();
    if (normalizedMessageConfig === null) {
      if (existing) {
        await ctx.db.delete(existing._id);
      }
      return null;
    }
    if (!existing) {
      await ctx.db.insert("runtimeConfig", {
        key: RUNTIME_CONFIG_KEYS.message,
        messageConfig: normalizedMessageConfig,
        updatedAt: nowMs,
      });
      return null;
    }
    await ctx.db.patch(existing._id, {
      messageConfig: normalizedMessageConfig,
      updatedAt: nowMs,
    });
    return null;
  },
});

export const messageRuntimeConfig = query({
  args: {},
  returns: v.union(v.null(), messageRuntimeConfigValidator),
  handler: async (ctx) => {
    const row = await ctx.db
      .query("runtimeConfig")
      .withIndex("by_key", (q) => q.eq("key", RUNTIME_CONFIG_KEYS.message))
      .unique();
    if (!row?.messageConfig) {
      return null;
    }
    return row.messageConfig;
  },
});

export const setMessageRuntimeConfig = mutation({
  args: {
    messageConfig: messageRuntimeConfigValidator,
    nowMs: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now();
    const normalizedMessageConfig = normalizeMessageRuntimeConfig(args.messageConfig);
    const existing = await ctx.db
      .query("runtimeConfig")
      .withIndex("by_key", (q) => q.eq("key", RUNTIME_CONFIG_KEYS.message))
      .unique();
    if (normalizedMessageConfig === null) {
      if (existing) {
        await ctx.db.delete(existing._id);
      }
      return null;
    }
    if (!existing) {
      await ctx.db.insert("runtimeConfig", {
        key: RUNTIME_CONFIG_KEYS.message,
        messageConfig: normalizedMessageConfig,
        updatedAt: nowMs,
      });
      return null;
    }
    await ctx.db.patch(existing._id, {
      messageConfig: normalizedMessageConfig,
      updatedAt: nowMs,
    });
    return null;
  },
});

export const deployGlobalSkill = mutation({
  args: {
    slug: v.string(),
    displayName: v.optional(v.string()),
    description: v.optional(v.string()),
    version: v.string(),
    sourceJs: v.string(),
    entryPoint: v.optional(v.string()),
    moduleFormat: v.optional(globalSkillModuleFormatValidator),
    releaseChannel: v.optional(globalSkillReleaseChannelValidator),
    actor: v.optional(v.string()),
    nowMs: v.optional(v.number()),
  },
  returns: v.object({
    skillId: v.id("globalSkills"),
    versionId: v.id("globalSkillVersions"),
    releaseId: v.id("globalSkillReleases"),
    slug: v.string(),
    version: v.string(),
    sha256: v.string(),
    releaseChannel: globalSkillReleaseChannelValidator,
  }),
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now();
    const slug = args.slug.trim().toLowerCase();
    const version = args.version.trim();
    const entryPoint = (args.entryPoint ?? "default").trim();
    const releaseChannel = args.releaseChannel ?? "stable";
    const moduleFormat = args.moduleFormat ?? "esm";
    const actor = args.actor?.trim() || "system";
    const sourceJs = args.sourceJs.trim();

    if (!/^[a-z0-9][a-z0-9-_]{1,127}$/.test(slug)) {
      throw new Error("Invalid skill slug. Use lowercase letters, numbers, '-' and '_'.");
    }
    if (!/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(version)) {
      throw new Error("Invalid skill version. Use semantic versioning format.");
    }
    if (sourceJs.length < 16) {
      throw new Error("Skill source is too short.");
    }
    if (sourceJs.length > 200_000) {
      throw new Error("Skill source too large (max 200KB).");
    }
    if (!entryPoint) {
      throw new Error("entryPoint is required.");
    }

    const sha256 = await computeSha256Hex(sourceJs);

    const existingSkill = await ctx.db
      .query("globalSkills")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    const skillId =
      existingSkill?._id ??
      (await ctx.db.insert("globalSkills", {
        slug,
        displayName: args.displayName?.trim() || slug,
        description: args.description?.trim(),
        status: "active",
        createdBy: actor,
        updatedBy: actor,
        createdAt: nowMs,
        updatedAt: nowMs,
      }));

    if (existingSkill) {
      await ctx.db.patch(skillId, {
        displayName: args.displayName?.trim() || existingSkill.displayName,
        description:
          args.description !== undefined ? args.description.trim() : existingSkill.description,
        status: "active",
        updatedBy: actor,
        updatedAt: nowMs,
      });
    }

    const existingVersion = await ctx.db
      .query("globalSkillVersions")
      .withIndex("by_skillId_and_version", (q) => q.eq("skillId", skillId).eq("version", version))
      .unique();

    let versionId = existingVersion?._id;
    if (!existingVersion) {
      versionId = await ctx.db.insert("globalSkillVersions", {
        skillId,
        version,
        moduleFormat,
        entryPoint,
        sourceJs,
        sha256,
        createdBy: actor,
        createdAt: nowMs,
      });
    } else if (existingVersion.sha256 !== sha256) {
      throw new Error(`Skill ${slug}@${version} already exists with a different source.`);
    }

    const activeReleases = await ctx.db
      .query("globalSkillReleases")
      .withIndex("by_skillId_and_releaseChannel_and_isActive", (q) =>
        q.eq("skillId", skillId).eq("releaseChannel", releaseChannel).eq("isActive", true),
      )
      .collect();
    for (const release of activeReleases) {
      await ctx.db.patch(release._id, { isActive: false });
    }

    const releaseId = await ctx.db.insert("globalSkillReleases", {
      skillId,
      versionId: versionId!,
      releaseChannel,
      isActive: true,
      activatedBy: actor,
      activatedAt: nowMs,
    });

    return {
      skillId,
      versionId: versionId!,
      releaseId,
      slug,
      version,
      sha256,
      releaseChannel,
    };
  },
});

export const listGlobalSkills = query({
  args: {
    releaseChannel: v.optional(globalSkillReleaseChannelValidator),
    status: v.optional(globalSkillStatusValidator),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      skillId: v.id("globalSkills"),
      slug: v.string(),
      displayName: v.string(),
      description: v.optional(v.string()),
      status: globalSkillStatusValidator,
      updatedAt: v.number(),
      activeRelease: v.union(
        v.null(),
        v.object({
          releaseId: v.id("globalSkillReleases"),
          versionId: v.id("globalSkillVersions"),
          version: v.string(),
          sha256: v.string(),
          moduleFormat: globalSkillModuleFormatValidator,
          entryPoint: v.string(),
          releaseChannel: globalSkillReleaseChannelValidator,
          activatedAt: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const releaseChannel = args.releaseChannel ?? "stable";
    const limit = Math.max(1, Math.min(args.limit ?? 200, 500));
    const skills =
      args.status !== undefined
        ? await ctx.db
            .query("globalSkills")
            .withIndex("by_status", (q) => q.eq("status", args.status!))
            .take(limit)
        : await ctx.db.query("globalSkills").take(limit);

    const sortedSkills = [...skills].sort((a, b) => a.slug.localeCompare(b.slug));
    const out: Array<{
      skillId: any;
      slug: string;
      displayName: string;
      description?: string;
      status: "active" | "disabled";
      updatedAt: number;
      activeRelease: {
        releaseId: any;
        versionId: any;
        version: string;
        sha256: string;
        moduleFormat: "esm" | "cjs";
        entryPoint: string;
        releaseChannel: "stable" | "canary";
        activatedAt: number;
      } | null;
    }> = [];

    for (const skill of sortedSkills) {
      const activeRelease = await ctx.db
        .query("globalSkillReleases")
        .withIndex("by_skillId_and_releaseChannel_and_isActive", (q) =>
          q.eq("skillId", skill._id).eq("releaseChannel", releaseChannel).eq("isActive", true),
        )
        .first();

      let activeReleaseRow: (typeof out)[number]["activeRelease"] = null;
      if (activeRelease) {
        const version = await ctx.db.get(activeRelease.versionId);
        if (version) {
          activeReleaseRow = {
            releaseId: activeRelease._id,
            versionId: version._id,
            version: version.version,
            sha256: version.sha256,
            moduleFormat: version.moduleFormat,
            entryPoint: version.entryPoint,
            releaseChannel: activeRelease.releaseChannel,
            activatedAt: activeRelease.activatedAt,
          };
        }
      }

      out.push({
        skillId: skill._id,
        slug: skill.slug,
        displayName: skill.displayName,
        description: skill.description,
        status: skill.status,
        updatedAt: skill.updatedAt,
        activeRelease: activeReleaseRow,
      });
    }
    return out;
  },
});

export const getWorkerGlobalSkillsManifest = query({
  args: {
    workspaceId: v.optional(v.string()),
    workerId: v.optional(v.string()),
    releaseChannel: v.optional(globalSkillReleaseChannelValidator),
  },
  returns: v.object({
    manifestVersion: v.string(),
    generatedAt: v.number(),
    releaseChannel: globalSkillReleaseChannelValidator,
    workspaceId: v.string(),
    skills: v.array(globalSkillManifestItemValidator),
  }),
  handler: async (ctx, args) => {
    const nowMs = Date.now();
    const releaseChannel = args.releaseChannel ?? "stable";
    const activeSkills = await ctx.db
      .query("globalSkills")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    const sortedSkills = [...activeSkills].sort((a, b) => a.slug.localeCompare(b.slug));

    const manifestSkills: Array<{
      slug: string;
      version: string;
      moduleFormat: "esm" | "cjs";
      entryPoint: string;
      sourceJs: string;
      sha256: string;
    }> = [];

    for (const skill of sortedSkills) {
      const activeRelease = await ctx.db
        .query("globalSkillReleases")
        .withIndex("by_skillId_and_releaseChannel_and_isActive", (q) =>
          q.eq("skillId", skill._id).eq("releaseChannel", releaseChannel).eq("isActive", true),
        )
        .first();
      if (!activeRelease) continue;

      const version = await ctx.db.get(activeRelease.versionId);
      if (!version) continue;
      manifestSkills.push({
        slug: skill.slug,
        version: version.version,
        moduleFormat: version.moduleFormat,
        entryPoint: version.entryPoint,
        sourceJs: version.sourceJs,
        sha256: version.sha256,
      });
    }

    manifestSkills.sort((a, b) => {
      if (a.slug !== b.slug) return a.slug.localeCompare(b.slug);
      return a.version.localeCompare(b.version);
    });

    const fingerprintSeed = manifestSkills
      .map((row) => `${row.slug}@${row.version}:${row.sha256}`)
      .join("|");
    const manifestVersion = await computeSha256Hex(fingerprintSeed || "empty");

    return {
      manifestVersion,
      generatedAt: nowMs,
      releaseChannel,
      workspaceId: args.workspaceId ?? "default",
      skills: manifestSkills,
    };
  },
});

export const setGlobalSkillStatus = mutation({
  args: {
    slug: v.string(),
    status: globalSkillStatusValidator,
    actor: v.optional(v.string()),
    nowMs: v.optional(v.number()),
  },
  returns: v.object({
    updated: v.boolean(),
    slug: v.string(),
    status: globalSkillStatusValidator,
  }),
  handler: async (ctx, args) => {
    const slug = args.slug.trim().toLowerCase();
    const nowMs = args.nowMs ?? Date.now();
    const actor = args.actor?.trim() || "system";
    const skill = await ctx.db
      .query("globalSkills")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!skill) {
      return { updated: false, slug, status: args.status };
    }
    await ctx.db.patch(skill._id, {
      status: args.status,
      updatedBy: actor,
      updatedAt: nowMs,
    });
    return { updated: true, slug, status: args.status };
  },
});

export const deleteGlobalSkill = mutation({
  args: {
    slug: v.string(),
  },
  returns: v.object({
    deleted: v.boolean(),
    slug: v.string(),
    deletedVersions: v.number(),
    deletedReleases: v.number(),
  }),
  handler: async (ctx, args) => {
    const slug = args.slug.trim().toLowerCase();
    const skill = await ctx.db
      .query("globalSkills")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!skill) {
      return { deleted: false, slug, deletedVersions: 0, deletedReleases: 0 };
    }

    const stableActiveReleases = await ctx.db
      .query("globalSkillReleases")
      .withIndex("by_skillId_and_releaseChannel_and_isActive", (q) =>
        q.eq("skillId", skill._id).eq("releaseChannel", "stable").eq("isActive", true),
      )
      .collect();
    const stableInactiveReleases = await ctx.db
      .query("globalSkillReleases")
      .withIndex("by_skillId_and_releaseChannel_and_isActive", (q) =>
        q.eq("skillId", skill._id).eq("releaseChannel", "stable").eq("isActive", false),
      )
      .collect();
    const canaryActiveReleases = await ctx.db
      .query("globalSkillReleases")
      .withIndex("by_skillId_and_releaseChannel_and_isActive", (q) =>
        q.eq("skillId", skill._id).eq("releaseChannel", "canary").eq("isActive", true),
      )
      .collect();
    const canaryInactiveReleases = await ctx.db
      .query("globalSkillReleases")
      .withIndex("by_skillId_and_releaseChannel_and_isActive", (q) =>
        q.eq("skillId", skill._id).eq("releaseChannel", "canary").eq("isActive", false),
      )
      .collect();
    const allReleases = [
      ...stableActiveReleases,
      ...stableInactiveReleases,
      ...canaryActiveReleases,
      ...canaryInactiveReleases,
    ];
    const versions = await ctx.db
      .query("globalSkillVersions")
      .withIndex("by_skillId_and_createdAt", (q) => q.eq("skillId", skill._id))
      .collect();

    for (const release of allReleases) {
      await ctx.db.delete(release._id);
    }
    for (const version of versions) {
      await ctx.db.delete(version._id);
    }
    await ctx.db.delete(skill._id);

    return {
      deleted: true,
      slug,
      deletedVersions: versions.length,
      deletedReleases: allReleases.length,
    };
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
    conversationId: v.optional(v.string()),
    nowMs: v.optional(v.number()),
  },
  returns: v.union(v.null(), claimedJobValidator),
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now();
    const worker = await ctx.db
      .query("workers")
      .withIndex("by_workerId", (q) => q.eq("workerId", args.workerId))
      .unique();
    if (worker && !isWorkerClaimable(worker.status)) {
      return null;
    }
    if (
      worker?.assignment &&
      args.conversationId &&
      worker.assignment.conversationId !== args.conversationId
    ) {
      return null;
    }
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
      if (args.conversationId && candidate.conversationId !== args.conversationId) {
        continue;
      }
      if (
        worker?.assignment &&
        candidate.conversationId !== worker.assignment.conversationId
      ) {
        continue;
      }

      const conversation = await ctx.db
        .query("conversations")
        .withIndex("by_conversationId", (q) =>
          q.eq("conversationId", candidate.conversationId),
        )
        .unique();
      if (!conversation) continue;
      if (conversation.agentKey !== candidate.agentKey) continue;
      if (
        worker?.assignment &&
        conversation.agentKey !== worker.assignment.agentKey
      ) {
        continue;
      }

      const lock = conversation.processingLock;
      if (lock && lock.leaseExpiresAt > nowMs) continue;

      const leaseId = `${nowMs}-${Math.random().toString(36).slice(2, 10)}`;
      const leaseExpiresAt = nowMs + DEFAULT_CONFIG.lease.leaseMs;
      const nextAssignment = {
        conversationId: candidate.conversationId,
        agentKey: candidate.agentKey,
        leaseId,
        assignedAt: worker?.assignment?.assignedAt ?? nowMs,
      };

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
          assignment: nextAssignment,
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
          assignment: nextAssignment,
        });
      }

      await scheduleLeaseRecoveryWatchdog(ctx, nowMs);

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
    if (worker && isWorkerRunning(worker.status)) {
      const nextPatch: {
        heartbeatAt: number;
        assignment?: {
          conversationId: string;
          agentKey: string;
          leaseId: string;
          assignedAt: number;
        };
      } = { heartbeatAt: nowMs };
      if (
        !worker.assignment ||
        worker.assignment.conversationId !== message.conversationId ||
        worker.assignment.agentKey !== message.agentKey ||
        worker.assignment.leaseId !== args.leaseId
      ) {
        nextPatch.assignment = {
          conversationId: message.conversationId,
          agentKey: message.agentKey,
          leaseId: args.leaseId,
          assignedAt: worker.assignment?.assignedAt ?? nowMs,
        };
      }
      await ctx.db.patch(worker._id, nextPatch);
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
    providerConfig: v.optional(providerConfigValidator),
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
      const nextScheduledShutdownAt = computeNextScheduledShutdownAt(worker, nextLoad, nowMs);
      await ctx.db.patch(worker._id, {
        load: nextLoad,
        heartbeatAt: nowMs,
        scheduledShutdownAt: nextScheduledShutdownAt,
        assignment: getAssignmentForCompletedConversation(worker, message),
      });
      if (nextScheduledShutdownAt !== undefined) {
        await scheduleIdleShutdownWatchdog(ctx, nextScheduledShutdownAt, nowMs, args.providerConfig);
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
    providerConfig: v.optional(providerConfigValidator),
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
      const nextScheduledShutdownAt = computeNextScheduledShutdownAt(worker, nextLoad, nowMs);
      await ctx.db.patch(worker._id, {
        load: nextLoad,
        heartbeatAt: nowMs,
        scheduledShutdownAt: nextScheduledShutdownAt,
        assignment: getAssignmentForCompletedConversation(worker, message),
      });
      if (nextScheduledShutdownAt !== undefined) {
        await scheduleIdleShutdownWatchdog(ctx, nextScheduledShutdownAt, nowMs, args.providerConfig);
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
    const invalidProcessing = (await ctx.db
      .query("messageQueue")
      .withIndex("by_status_and_scheduledFor", (q) => q.eq("status", "processing"))
      .take(limit)
    ).filter(
      (message) =>
        message.leaseExpiresAt === undefined ||
        message.leaseId === undefined ||
        message.claimedBy === undefined,
    );
    const processingRows = dedupeMessagesById([...stuck, ...invalidProcessing]);

    let requeued = 0;
    let unlocked = 0;
    for (const message of processingRows) {
      const claimedWorkerId = message.claimedBy;
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

      if (claimedWorkerId) {
        const worker = await ctx.db
          .query("workers")
          .withIndex("by_workerId", (q) => q.eq("workerId", claimedWorkerId))
          .unique();
        if (worker && !isWorkerTerminal(worker.status)) {
          const nextLoad = Math.max(0, worker.load - 1);
          const nextScheduledShutdownAt = computeNextScheduledShutdownAt(worker, nextLoad, nowMs);
          await ctx.db.patch(worker._id, {
            load: nextLoad,
            heartbeatAt: nowMs,
            scheduledShutdownAt: nextScheduledShutdownAt,
            assignment: clearAssignmentForMessage(worker, message, nextLoad),
          });
          if (nextScheduledShutdownAt !== undefined) {
            await scheduleIdleShutdownWatchdog(ctx, nextScheduledShutdownAt, nowMs);
          }
        }
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
    const invalidProcessing = (await ctx.db
      .query("messageQueue")
      .withIndex("by_status_and_scheduledFor", (q) => q.eq("status", "processing"))
      .take(limit)
    ).filter(
      (message) =>
        message.leaseExpiresAt === undefined ||
        message.leaseId === undefined ||
        message.claimedBy === undefined,
    );
    const processingRows = dedupeMessagesById([...stuck, ...invalidProcessing]);

    let requeued = 0;
    let unlocked = 0;
    for (const message of processingRows) {
      const claimedWorkerId = message.claimedBy;
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

      if (claimedWorkerId) {
        const worker = await ctx.db
          .query("workers")
          .withIndex("by_workerId", (q) => q.eq("workerId", claimedWorkerId))
          .unique();
        if (worker && !isWorkerTerminal(worker.status)) {
          const nextLoad = Math.max(0, worker.load - 1);
          const nextScheduledShutdownAt = computeNextScheduledShutdownAt(worker, nextLoad, nowMs);
          await ctx.db.patch(worker._id, {
            load: nextLoad,
            heartbeatAt: nowMs,
            scheduledShutdownAt: nextScheduledShutdownAt,
            assignment: clearAssignmentForMessage(worker, message, nextLoad),
          });
          if (nextScheduledShutdownAt !== undefined) {
            await scheduleIdleShutdownWatchdog(ctx, nextScheduledShutdownAt, nowMs);
          }
        }
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
      bridgeRuntimeConfig: v.union(v.null(), bridgeRuntimeConfigValidator),
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
    const bridgeRuntimeConfig = await resolveBridgeRuntimeConfig(ctx, profile);

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
      bridgeRuntimeConfig,
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

export const getActiveConversationIdsForScheduler = internalQuery({
  args: {
    nowMs: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.string()),
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
    return Array.from(
      new Set([...queuedJobs, ...processingJobs].map((job) => job.conversationId)),
    ).sort();
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
    status: workerStatusValidator,
    load: v.number(),
    nowMs: v.optional(v.number()),
    scheduledShutdownAt: v.optional(v.number()),
    stoppedAt: v.optional(v.number()),
    machineId: v.optional(v.string()),
    appName: v.optional(v.string()),
    region: v.optional(v.string()),
    clearLastSnapshotId: v.optional(v.boolean()),
    clearMachineRef: v.optional(v.boolean()),
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
        stoppedAt:
          args.status === "stopped" || args.status === "stopping"
            ? (args.stoppedAt ?? nowMs)
            : undefined,
        assignment: undefined,
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

    if (!canTransitionWorkerStatus(worker.status, args.status)) {
      throw new Error(
        `Worker '${args.workerId}' cannot transition from '${worker.status}' to '${args.status}'.`,
      );
    }

    await ctx.db.patch(worker._id, {
      status: args.status,
      load: args.load,
      heartbeatAt: isWorkerRunning(args.status) ? nowMs : worker.heartbeatAt,
      scheduledShutdownAt: args.scheduledShutdownAt ?? worker.scheduledShutdownAt,
      stoppedAt:
        args.status === "stopped" || args.status === "stopping"
          ? (args.stoppedAt ?? worker.stoppedAt ?? nowMs)
          : undefined,
      lastSnapshotId: args.clearLastSnapshotId ? undefined : worker.lastSnapshotId,
      assignment: worker.assignment,
      machineRef:
        args.clearMachineRef
          ? undefined
          : args.machineId && args.appName
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
    const nowMs = Date.now();
    const staleHeartbeatCutoff = nowMs - DEFAULT_CONFIG.lease.staleAfterMs;
    return {
      shouldStop:
        !worker ||
        !isWorkerClaimable(worker.status) ||
        worker.heartbeatAt <= staleHeartbeatCutoff ||
        (worker.scheduledShutdownAt !== undefined && worker.scheduledShutdownAt <= nowMs),
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
        status: worker.status === "draining" ? "stopping" : worker.status,
        stoppedAt:
          worker.status === "draining" ? (worker.stoppedAt ?? nowMs) : worker.stoppedAt,
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
    const preferred = args.conversationId
      ? ready.find((snapshot) => snapshot.conversationId === args.conversationId)
      : ready[0];
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
      status: workerStatusValidator,
      load: v.number(),
      heartbeatAt: v.number(),
      lastClaimAt: v.union(v.null(), v.number()),
      scheduledShutdownAt: v.union(v.null(), v.number()),
      stoppedAt: v.union(v.null(), v.number()),
      lastSnapshotId: v.union(v.null(), v.id("dataSnapshots")),
      assignment: v.union(v.null(), workerAssignmentValidator),
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
      lastSnapshotId: worker.lastSnapshotId ?? null,
      assignment: worker.assignment ?? null,
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
        status: workerStatusValidator,
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

async function resolveBridgeRuntimeConfig(
  ctx: any,
  profile: {
    agentKey: string;
    bridgeConfig?: {
      enabled: boolean;
      baseUrl?: string;
      serviceId?: string;
      appKey?: string;
      serviceKeySecretRef?: string;
      appBaseUrlMapJsonSecretRef?: string;
    };
  },
): Promise<{
  baseUrl: string | null;
  appBaseUrlMapJson: string | null;
  serviceId: string | null;
  appKey: string | null;
  serviceKey: string | null;
  serviceKeySecretRef: string | null;
} | null> {
  if (!profile.bridgeConfig?.enabled) {
    return null;
  }

  const configuredServiceKeySecretRef = profile.bridgeConfig.serviceKeySecretRef ?? null;
  const configuredBaseUrlMapSecretRef = profile.bridgeConfig.appBaseUrlMapJsonSecretRef ?? null;
  const [serviceKeySecretRef, serviceKey] = await resolveFirstActiveSecretValue(
    ctx,
    getScopedSecretRefCandidates(
      profile.agentKey,
      BRIDGE_SECRET_REFS.serviceKey,
      configuredServiceKeySecretRef,
    ),
  );

  const [, baseUrlFromSecret] = await resolveFirstActiveSecretValue(
    ctx,
    getScopedSecretRefCandidates(profile.agentKey, BRIDGE_SECRET_REFS.baseUrl),
  );
  const [, appBaseUrlMapJsonFromSecret] = await resolveFirstActiveSecretValue(
    ctx,
    getScopedSecretRefCandidates(
      profile.agentKey,
      BRIDGE_SECRET_REFS.baseUrlMapJson,
      configuredBaseUrlMapSecretRef,
    ),
  );
  const [, serviceIdFromSecret] = await resolveFirstActiveSecretValue(
    ctx,
    getScopedSecretRefCandidates(profile.agentKey, BRIDGE_SECRET_REFS.serviceId),
  );
  const [, appKeyFromSecret] = await resolveFirstActiveSecretValue(
    ctx,
    getScopedSecretRefCandidates(profile.agentKey, BRIDGE_SECRET_REFS.appKey),
  );

  return {
    baseUrl: profile.bridgeConfig.baseUrl ?? baseUrlFromSecret,
    appBaseUrlMapJson: appBaseUrlMapJsonFromSecret,
    serviceId: profile.bridgeConfig.serviceId ?? serviceIdFromSecret,
    appKey: profile.bridgeConfig.appKey ?? appKeyFromSecret,
    serviceKey,
    serviceKeySecretRef,
  };
}

function appendSystemPromptToMessage(messageText: string, systemPrompt?: string): string {
  const normalizedSystemPrompt = normalizeSystemPrompt(systemPrompt);
  if (normalizedSystemPrompt === null) {
    return messageText;
  }
  const normalizedMessageText = messageText.trimEnd();
  if (normalizedMessageText.length === 0) {
    return normalizedSystemPrompt;
  }
  return `${normalizedMessageText}\n\n${normalizedSystemPrompt}`;
}

async function scheduleIdleShutdownWatchdog(
  ctx: any,
  scheduledShutdownAt: number,
  nowMs: number,
  providerConfig?: typeof DEFAULT_CONFIG.provider,
) {
  const delayMs = Math.max(0, scheduledShutdownAt - nowMs) + 1_000;
  try {
    await ctx.scheduler.runAfter(delayMs, (internal.scheduler as any).enforceIdleShutdowns, {
      providerConfig,
    });
  } catch (error) {
    console.warn(
      `[queue] failed to schedule idle-shutdown watchdog: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function scheduleLeaseRecoveryWatchdog(ctx: any, _nowMs: number) {
  const delayMs = DEFAULT_CONFIG.lease.leaseMs + 1_000;
  try {
    await ctx.scheduler.runAfter(delayMs, (internal.scheduler as any).reconcileWorkerPoolInternal, {
      workspaceId: "default",
    });
  } catch (error) {
    console.warn(
      `[queue] failed to schedule lease-recovery watchdog: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function computeNextScheduledShutdownAt(
  worker: {
    lastClaimAt?: number;
    scheduledShutdownAt?: number;
  },
  nextLoad: number,
  nowMs: number,
): number | undefined {
  if (nextLoad > 0) {
    return undefined;
  }
  const shutdownBaseMs = worker.lastClaimAt ?? nowMs;
  return worker.scheduledShutdownAt ?? shutdownBaseMs + DEFAULT_CONFIG.scaling.idleTimeoutMs;
}

function getAssignmentForCompletedConversation(
  worker: {
    assignment?: {
      conversationId: string;
      agentKey: string;
      leaseId: string;
      assignedAt: number;
    };
  },
  message: {
    conversationId: string;
    agentKey: string;
    leaseId?: string;
  },
) {
  if (
    worker.assignment &&
    worker.assignment.conversationId === message.conversationId &&
    worker.assignment.agentKey === message.agentKey
  ) {
    return {
      ...worker.assignment,
      leaseId: message.leaseId ?? worker.assignment.leaseId,
    };
  }
  return worker.assignment;
}

function clearAssignmentForMessage(
  worker: {
    assignment?: {
      conversationId: string;
      agentKey: string;
      leaseId: string;
      assignedAt: number;
    };
  },
  message: {
    conversationId: string;
    agentKey: string;
  },
  nextLoad: number,
) {
  if (
    nextLoad === 0 &&
    worker.assignment &&
    worker.assignment.conversationId === message.conversationId &&
    worker.assignment.agentKey === message.agentKey
  ) {
    return undefined;
  }
  return worker.assignment;
}

function dedupeMessagesById<T extends { _id: string }>(messages: Array<T>): Array<T> {
  const seen = new Set<string>();
  const deduped: Array<T> = [];
  for (const message of messages) {
    if (seen.has(message._id)) {
      continue;
    }
    seen.add(message._id);
    deduped.push(message);
  }
  return deduped;
}

function normalizeMessageRuntimeConfig(
  messageConfig: { systemPrompt?: string } | null | undefined,
): { systemPrompt?: string } | null {
  const systemPrompt = normalizeSystemPrompt(messageConfig?.systemPrompt);
  if (systemPrompt === null) {
    return null;
  }
  return { systemPrompt };
}

function normalizeSystemPrompt(systemPrompt?: string | null): string | null {
  if (typeof systemPrompt !== "string") {
    return null;
  }
  const normalizedSystemPrompt = systemPrompt.trim();
  return normalizedSystemPrompt.length > 0 ? normalizedSystemPrompt : null;
}

function getBridgeSecretRefsForProfile(
  agentKey: string,
  bridgeConfig:
    | {
        enabled: boolean;
        serviceKeySecretRef?: string;
        appBaseUrlMapJsonSecretRef?: string;
      }
    | undefined,
): Array<string> {
  if (!bridgeConfig?.enabled) {
    return [];
  }
  const refs: Array<string> = [
    bridgeConfig.serviceKeySecretRef ?? `${BRIDGE_SECRET_REFS.serviceKey}.${agentKey}`,
    bridgeConfig.appBaseUrlMapJsonSecretRef ??
      `${BRIDGE_SECRET_REFS.baseUrlMapJson}.${agentKey}`,
  ];
  return refs;
}

function getScopedSecretRefCandidates(
  agentKey: string,
  globalPrefix: string,
  preferredRef?: string | null,
): Array<string> {
  const refs: Array<string> = [];
  if (preferredRef && preferredRef.trim().length > 0) {
    refs.push(preferredRef.trim());
  }
  refs.push(`${globalPrefix}.${agentKey}`);
  refs.push(globalPrefix);
  return Array.from(new Set(refs));
}

async function resolveFirstActiveSecretValue(
  ctx: any,
  secretRefs: Array<string>,
): Promise<[string | null, string | null]> {
  for (const secretRef of secretRefs) {
    const active = await ctx.db
      .query("secrets")
      .withIndex("by_secretRef_and_active", (q: any) =>
        q.eq("secretRef", secretRef).eq("active", true),
      )
      .unique();
    if (active) {
      return [secretRef, decryptSecretValue(active.encryptedValue, active.algorithm)];
    }
  }
  return [null, null];
}

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

async function computeSha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
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
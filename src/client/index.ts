import {
  actionGeneric,
  httpActionGeneric,
  mutationGeneric,
  queryGeneric,
} from "convex/server";
import type { Auth, HttpRouter } from "convex/server";
import { v } from "convex/values";
import type { ComponentApi } from "../component/_generated/component.js";
import { parseTelegramWebhookSecretToken } from "../component/identity.js";
import {
  providerConfigValidator,
  scalingPolicyValidator,
  type ProviderConfig,
} from "../component/config.js";

const telegramAttachmentKindValidator = v.union(
  v.literal("photo"),
  v.literal("video"),
  v.literal("audio"),
  v.literal("voice"),
  v.literal("document"),
);

const telegramAttachmentValidator = v.object({
  kind: telegramAttachmentKindValidator,
  status: v.union(v.literal("ready"), v.literal("expired")),
  storageId: v.string(),
  telegramFileId: v.string(),
  fileName: v.optional(v.string()),
  mimeType: v.optional(v.string()),
  sizeBytes: v.optional(v.number()),
  expiresAt: v.number(),
});

const pushPeriodicityValidator = v.union(
  v.literal("manual"),
  v.literal("daily"),
  v.literal("weekly"),
  v.literal("monthly"),
);

const pushSuggestedTimeValidator = v.union(
  v.object({
    kind: v.literal("daily"),
    time: v.string(),
  }),
  v.object({
    kind: v.literal("weekly"),
    weekday: v.number(),
    time: v.string(),
  }),
  v.object({
    kind: v.literal("monthly"),
    dayOfMonth: v.union(v.number(), v.literal("last")),
    time: v.string(),
  }),
);

const pushScheduleValidator = v.union(
  v.object({
    kind: v.literal("manual"),
  }),
  v.object({
    kind: v.literal("daily"),
    time: v.string(),
  }),
  v.object({
    kind: v.literal("weekly"),
    weekday: v.number(),
    time: v.string(),
  }),
  v.object({
    kind: v.literal("monthly"),
    dayOfMonth: v.union(v.number(), v.literal("last")),
    time: v.string(),
  }),
);

const messageRuntimeConfigValidator = v.object({
  systemPrompt: v.optional(v.string()),
  telegramAttachmentRetentionMs: v.optional(v.number()),
});

const messageTemplateValidator = v.object({
  title: v.string(),
  text: v.string(),
  tags: v.array(v.string()),
  enabled: v.optional(v.boolean()),
  actorUserId: v.string(),
});

const globalSkillManifestFileValidator = v.object({
  path: v.string(),
  content: v.string(),
  sha256: v.string(),
});
export {
  bridgeFunctionKeyFromToolName,
  executeBridgeFunction,
  isBridgeToolName,
  maybeExecuteBridgeToolCall,
  resolveBridgeRuntimeConfig,
  type BridgeExecutionResult,
  type HydratedBridgeRuntimeConfig,
  type ResolvedBridgeRuntimeConfig,
} from "./bridge.js";

export function exposeApi(
  component: ComponentApi,
  options: {
    auth: (
      ctx: { auth: Auth },
      operation:
        | { type: "read" }
        | {
            type: "write";
            conversationId?: string;
            agentKey?: string;
          },
    ) => Promise<string>;
    providerConfig?: ProviderConfig;
  },
) {
  return {
    queueStats: queryGeneric({
      args: {},
      handler: async (ctx) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery(component.lib.queueStats, {});
      },
    }),
    getProviderRuntimeConfig: queryGeneric({
      args: {},
      handler: async (ctx) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery((component.queue as any).providerRuntimeConfig, {});
      },
    }),
    setProviderRuntimeConfig: mutationGeneric({
      args: {
        providerConfig: providerConfigValidator,
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "write" });
        await ctx.runMutation((component.queue as any).setProviderRuntimeConfig, args);
        return null;
      },
    }),
    getMessageRuntimeConfig: queryGeneric({
      args: {},
      handler: async (ctx) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery((component.queue as any).messageRuntimeConfig, {});
      },
    }),
    setMessageRuntimeConfig: mutationGeneric({
      args: {
        messageConfig: messageRuntimeConfigValidator,
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "write" });
        await ctx.runMutation((component.queue as any).setMessageRuntimeConfig, args);
        return null;
      },
    }),
    createMessageTemplate: mutationGeneric({
      args: messageTemplateValidator,
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "write" });
        return await ctx.runMutation((component.lib as any).createMessageTemplate, args);
      },
    }),
    updateMessageTemplate: mutationGeneric({
      args: {
        templateId: v.string(),
        title: v.optional(v.string()),
        text: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        enabled: v.optional(v.boolean()),
        actorUserId: v.string(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "write" });
        return await ctx.runMutation((component.lib as any).updateMessageTemplate, args);
      },
    }),
    deleteMessageTemplate: mutationGeneric({
      args: {
        templateId: v.string(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "write" });
        return await ctx.runMutation((component.lib as any).deleteMessageTemplate, args);
      },
    }),
    listMessageTemplatesByCompany: queryGeneric({
      args: {
        includeDisabled: v.optional(v.boolean()),
        limit: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery((component.lib as any).listMessageTemplatesByCompany, args);
      },
    }),
    enqueue: mutationGeneric({
      args: {
        conversationId: v.string(),
        agentKey: v.string(),
        provider: v.string(),
        providerUserId: v.string(),
        messageText: v.string(),
        externalMessageId: v.optional(v.string()),
        rawUpdateJson: v.optional(v.string()),
        metadata: v.optional(v.record(v.string(), v.string())),
        attachments: v.optional(v.array(telegramAttachmentValidator)),
        priority: v.optional(v.number()),
        providerConfig: v.optional(providerConfigValidator),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, {
          type: "write",
          conversationId: args.conversationId,
          agentKey: args.agentKey,
        });
        return await ctx.runMutation(component.lib.enqueue, {
          conversationId: args.conversationId,
          agentKey: args.agentKey,
          payload: {
            provider: args.provider,
            providerUserId: args.providerUserId,
            messageText: args.messageText,
            externalMessageId: args.externalMessageId,
            rawUpdateJson: args.rawUpdateJson,
            metadata: args.metadata,
            attachments: args.attachments,
          },
          priority: args.priority,
          providerConfig: args.providerConfig ?? options.providerConfig,
        });
      },
    }),
    workerStats: queryGeneric({
      args: {},
      handler: async (ctx) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery(component.lib.workerStats, {});
      },
    }),
    workerClaim: mutationGeneric({
      args: {
        workerId: v.string(),
        conversationId: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "write" });
        return await ctx.runMutation(component.queue.claimNextJob, args);
      },
    }),
    workerHeartbeat: mutationGeneric({
      args: {
        workerId: v.string(),
        messageId: v.string(),
        leaseId: v.string(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "write" });
        return await ctx.runMutation(component.queue.heartbeatJob, args);
      },
    }),
    workerComplete: mutationGeneric({
      args: {
        workerId: v.string(),
        messageId: v.string(),
        leaseId: v.string(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "write" });
        return await ctx.runMutation(component.queue.completeJob, {
          ...args,
          providerConfig: options.providerConfig,
        });
      },
    }),
    workerFail: mutationGeneric({
      args: {
        workerId: v.string(),
        messageId: v.string(),
        leaseId: v.string(),
        errorMessage: v.string(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "write" });
        return await ctx.runMutation(component.queue.failJob, {
          ...args,
          providerConfig: options.providerConfig,
        });
      },
    }),
    workerHydrationBundle: queryGeneric({
      args: {
        messageId: v.string(),
        workspaceId: v.string(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery(component.queue.getHydrationBundleForClaimedJob, args);
      },
    }),
    workerGlobalSkillsManifest: queryGeneric({
      args: {
        workspaceId: v.optional(v.string()),
        workerId: v.optional(v.string()),
        releaseChannel: v.optional(v.union(v.literal("stable"), v.literal("canary"))),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery((component.queue as any).getWorkerGlobalSkillsManifest, args);
      },
    }),
    workerConversationHasQueued: queryGeneric({
      args: {
        conversationId: v.string(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery(component.queue.hasQueuedJobsForConversation, args);
      },
    }),
    workerAppendConversationMessages: mutationGeneric({
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
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "write", conversationId: args.conversationId });
        return await ctx.runMutation(component.lib.appendConversationMessages, args);
      },
    }),
    workerControlState: queryGeneric({
      args: {
        workerId: v.string(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery((component.queue as any).getWorkerControlState, args);
      },
    }),
    workerPrepareSnapshotUpload: mutationGeneric({
      args: {
        workerId: v.string(),
        workspaceId: v.string(),
        agentKey: v.string(),
        conversationId: v.string(),
        reason: v.union(v.literal("drain"), v.literal("signal"), v.literal("manual")),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "write" });
        return await ctx.runMutation((component.queue as any).prepareDataSnapshotUpload, args);
      },
    }),
    workerFinalizeSnapshotUpload: mutationGeneric({
      args: {
        workerId: v.string(),
        snapshotId: v.string(),
        storageId: v.string(),
        sha256: v.string(),
        sizeBytes: v.number(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "write" });
        return await ctx.runMutation((component.queue as any).finalizeDataSnapshotUpload, args);
      },
    }),
    workerFailSnapshotUpload: mutationGeneric({
      args: {
        workerId: v.string(),
        snapshotId: v.string(),
        error: v.string(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "write" });
        return await ctx.runMutation((component.queue as any).failDataSnapshotUpload, args);
      },
    }),
    workerLatestSnapshotForRestore: queryGeneric({
      args: {
        workspaceId: v.string(),
        agentKey: v.string(),
        conversationId: v.string(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery((component.queue as any).getLatestDataSnapshotForRestore, args);
      },
    }),
    workerGenerateMediaUploadUrl: mutationGeneric({
      args: {},
      handler: async (ctx) => {
        await options.auth(ctx, { type: "write" });
        return await ctx.runMutation((component.queue as any).generateMediaUploadUrl, {});
      },
    }),
    workerGetStorageFileUrl: queryGeneric({
      args: {
        storageId: v.string(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery((component.queue as any).getStorageFileUrl, args);
      },
    }),
    workerAttachMessageMetadata: mutationGeneric({
      args: {
        messageId: v.string(),
        metadata: v.record(v.string(), v.string()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "write" });
        return await ctx.runMutation((component.queue as any).attachMessageMetadata, args);
      },
    }),
    globalSkillsDeploy: mutationGeneric({
      args: {
        slug: v.string(),
        displayName: v.optional(v.string()),
        description: v.optional(v.string()),
        version: v.string(),
        files: v.array(globalSkillManifestFileValidator),
        entryPoint: v.optional(v.string()),
        moduleFormat: v.optional(v.union(v.literal("esm"), v.literal("cjs"))),
        releaseChannel: v.optional(v.union(v.literal("stable"), v.literal("canary"))),
        actor: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "write" });
        return await ctx.runMutation((component.queue as any).deployGlobalSkill, args);
      },
    }),
    globalSkillsList: queryGeneric({
      args: {
        releaseChannel: v.optional(v.union(v.literal("stable"), v.literal("canary"))),
        status: v.optional(v.union(v.literal("active"), v.literal("disabled"))),
        limit: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery((component.queue as any).listGlobalSkills, args);
      },
    }),
    globalSkillsSetStatus: mutationGeneric({
      args: {
        slug: v.string(),
        status: v.union(v.literal("active"), v.literal("disabled")),
        actor: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "write" });
        return await ctx.runMutation((component.queue as any).setGlobalSkillStatus, args);
      },
    }),
    globalSkillsDelete: mutationGeneric({
      args: {
        slug: v.string(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "write" });
        return await ctx.runMutation((component.queue as any).deleteGlobalSkill, args);
      },
    }),
    seedDefaultAgent: mutationGeneric({
      args: {},
      handler: async (ctx) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runMutation(component.lib.configureAgent, {
          agentKey: "default",
          version: "1.0.0",
          secretsRef: ["telegram.botToken"],
          botIdentity: "telegram-bot-default",
          enabled: true,
        });
      },
    }),
    importSecret: mutationGeneric({
      args: {
        secretRef: v.string(),
        plaintextValue: v.string(),
        metadata: v.optional(v.record(v.string(), v.string())),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runMutation(component.lib.importSecret, args);
      },
    }),
    secretStatus: queryGeneric({
      args: {
        secretRefs: v.array(v.string()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery(component.lib.secretStatus, {
          secretRefs: args.secretRefs,
        });
      },
    }),
    startWorkers: actionGeneric({
      args: {
        flyApiToken: v.optional(v.string()),
        convexUrl: v.optional(v.string()),
        workspaceId: v.optional(v.string()),
        scalingPolicy: v.optional(scalingPolicyValidator),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runAction(component.lib.reconcileWorkers, {
          flyApiToken: args.flyApiToken,
          convexUrl: args.convexUrl,
          workspaceId: args.workspaceId,
          scalingPolicy: args.scalingPolicy,
          providerConfig: options.providerConfig,
        });
      },
    }),
    checkIdleShutdowns: actionGeneric({
      args: {
        flyApiToken: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runAction((component.lib as any).checkIdleShutdowns, {
          flyApiToken: args.flyApiToken,
          providerConfig: options.providerConfig,
        });
      },
    }),
    deleteFlyVolume: actionGeneric({
      args: {
        appName: v.string(),
        volumeId: v.string(),
        flyApiToken: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runAction((component.lib as any).deleteFlyVolume, args);
      },
    }),
    runFlyCleanup: actionGeneric({
      args: {
        flyApiToken: v.optional(v.string()),
        machineConcurrency: v.optional(v.number()),
        volumeConcurrency: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runAction((component.lib as any).runFlyCleanup, {
          flyApiToken: args.flyApiToken,
          machineConcurrency: args.machineConcurrency,
          volumeConcurrency: args.volumeConcurrency,
          providerConfig: options.providerConfig,
        });
      },
    }),
    recoverQueue: actionGeneric({
      args: {
        nowMs: v.optional(v.number()),
        releaseLimit: v.optional(v.number()),
        workspaceId: v.optional(v.string()),
        scalingPolicy: v.optional(scalingPolicyValidator),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        const released = await ctx.runMutation(component.lib.releaseStuckJobs, {
          nowMs: args.nowMs,
          limit: args.releaseLimit,
        });
        const reconcile = await ctx.runAction(component.lib.reconcileWorkers, {
          workspaceId: args.workspaceId,
          scalingPolicy: args.scalingPolicy,
          providerConfig: options.providerConfig,
        });
        return {
          released,
          reconcile,
        };
      },
    }),
    bindUserAgent: mutationGeneric({
      args: {
        consumerUserId: v.string(),
        agentKey: v.string(),
        botIdentity: v.optional(v.string()),
        source: v.optional(
          v.union(v.literal("manual"), v.literal("telegram_pairing"), v.literal("api")),
        ),
        telegramUserId: v.optional(v.string()),
        telegramChatId: v.optional(v.string()),
        metadata: v.optional(v.record(v.string(), v.string())),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runMutation(component.lib.bindUserAgent, args);
      },
    }),
    revokeUserAgentBinding: mutationGeneric({
      args: {
        consumerUserId: v.string(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runMutation(component.lib.revokeUserAgentBinding, args);
      },
    }),
    myAgentKey: queryGeneric({
      args: {
        consumerUserId: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        const authUserId = await options.auth(ctx, { type: "read" });
        const consumerUserId = args.consumerUserId ?? authUserId;
        return await ctx.runQuery(component.lib.resolveAgentForUser, {
          consumerUserId,
        });
      },
    }),
    getUserAgentBinding: queryGeneric({
      args: {
        consumerUserId: v.string(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery(component.lib.getUserAgentBinding, args);
      },
    }),
    listUserAgents: queryGeneric({
      args: {
        consumerUserId: v.string(),
        includeDisabled: v.optional(v.boolean()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery((component.lib as any).listUserAgents, args);
      },
    }),
    getUserAgent: queryGeneric({
      args: {
        consumerUserId: v.string(),
        agentKey: v.string(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery((component.lib as any).getUserAgent, args);
      },
    }),
    getActiveUserAgent: queryGeneric({
      args: {
        consumerUserId: v.string(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery((component.lib as any).getActiveUserAgent, args);
      },
    }),
    getUserAgentsOverview: queryGeneric({
      args: {
        consumerUserId: v.string(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery((component.lib as any).getUserAgentsOverview, args);
      },
    }),
    resolveAgentForTelegram: queryGeneric({
      args: {
        botIdentity: v.optional(v.string()),
        telegramUserId: v.optional(v.string()),
        telegramChatId: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery(component.lib.resolveAgentForTelegram, args);
      },
    }),
    createPairingCode: mutationGeneric({
      args: {
        consumerUserId: v.string(),
        agentKey: v.string(),
        ttlMs: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runMutation(component.lib.createPairingCode, args);
      },
    }),
    createUserAgentPairing: mutationGeneric({
      args: {
        consumerUserId: v.string(),
        agentKey: v.string(),
        ttlMs: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "write", agentKey: args.agentKey });
        return await ctx.runMutation((component.lib as any).createUserAgentPairing, args);
      },
    }),
    consumePairingCode: mutationGeneric({
      args: {
        code: v.string(),
        botIdentity: v.optional(v.string()),
        telegramUserId: v.string(),
        telegramChatId: v.string(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runMutation(component.lib.consumePairingCode, args);
      },
    }),
    getPairingCodeStatus: queryGeneric({
      args: {
        code: v.string(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery(component.lib.getPairingCodeStatus, args);
      },
    }),
    getUserAgentPairingStatus: queryGeneric({
      args: {
        consumerUserId: v.string(),
        agentKey: v.string(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery((component.lib as any).getUserAgentPairingStatus, args);
      },
    }),
    importTelegramTokenForAgent: actionGeneric({
      args: {
        consumerUserId: v.string(),
        agentKey: v.string(),
        plaintextValue: v.string(),
        metadata: v.optional(v.record(v.string(), v.string())),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "write", agentKey: args.agentKey });
        return await ctx.runAction((component.lib as any).importTelegramTokenForAgent, args);
      },
    }),
    reconcileTelegramBotIdentityForAgent: actionGeneric({
      args: {
        agentKey: v.string(),
        secretRef: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "write", agentKey: args.agentKey });
        return await ctx.runAction((component.lib as any).reconcileTelegramBotIdentityForAgent, args);
      },
    }),
    getUserAgentOnboardingState: queryGeneric({
      args: {
        consumerUserId: v.string(),
        agentKey: v.string(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery((component.lib as any).getUserAgentOnboardingState, args);
      },
    }),
    getRequiredSecretRefs: queryGeneric({
      args: {
        agentKey: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery((component.lib as any).getRequiredSecretRefs, args);
      },
    }),
    getProviderOperationalReadiness: queryGeneric({
      args: {},
      handler: async (ctx) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery((component.lib as any).getProviderOperationalReadiness, {});
      },
    }),
    getTelegramAgentReadiness: queryGeneric({
      args: {
        consumerUserId: v.string(),
        agentKey: v.string(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery((component.lib as any).getTelegramAgentReadiness, args);
      },
    }),
    getAgentOperationalReadiness: queryGeneric({
      args: {
        consumerUserId: v.string(),
        agentKey: v.string(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery((component.lib as any).getAgentOperationalReadiness, args);
      },
    }),
    configureTelegramWebhook: actionGeneric({
      args: {
        convexSiteUrl: v.string(),
        secretRef: v.optional(v.string()),
        agentKey: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runAction(component.lib.configureTelegramWebhook, args);
      },
    }),
    softResetTelegramBindingsMissingBotIdentity: mutationGeneric({
      args: {
        nowMs: v.optional(v.number()),
        revokeActiveBindings: v.optional(v.boolean()),
        expirePendingPairings: v.optional(v.boolean()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "write" });
        return await ctx.runMutation(
          (component.lib as any).softResetTelegramBindingsMissingBotIdentity,
          args,
        );
      },
    }),
    getWebhookReadiness: actionGeneric({
      args: {
        agentKey: v.string(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runAction((component.lib as any).getWebhookReadiness, args);
      },
    }),
    createPushTemplate: mutationGeneric({
      args: {
        companyId: v.string(),
        templateKey: v.string(),
        title: v.string(),
        text: v.string(),
        periodicity: pushPeriodicityValidator,
        suggestedTimes: v.array(pushSuggestedTimeValidator),
        enabled: v.optional(v.boolean()),
        actorUserId: v.string(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "write" });
        return await ctx.runMutation((component.lib as any).createPushTemplate, args);
      },
    }),
    updatePushTemplate: mutationGeneric({
      args: {
        templateId: v.string(),
        title: v.optional(v.string()),
        text: v.optional(v.string()),
        periodicity: v.optional(pushPeriodicityValidator),
        suggestedTimes: v.optional(v.array(pushSuggestedTimeValidator)),
        enabled: v.optional(v.boolean()),
        actorUserId: v.string(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "write" });
        return await ctx.runMutation((component.lib as any).updatePushTemplate, args);
      },
    }),
    deletePushTemplate: mutationGeneric({
      args: {
        templateId: v.string(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "write" });
        return await ctx.runMutation((component.lib as any).deletePushTemplate, args);
      },
    }),
    listPushTemplatesByCompany: queryGeneric({
      args: {
        companyId: v.string(),
        includeDisabled: v.optional(v.boolean()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery((component.lib as any).listPushTemplatesByCompany, args);
      },
    }),
    createPushJobFromTemplate: mutationGeneric({
      args: {
        companyId: v.string(),
        consumerUserId: v.string(),
        templateId: v.string(),
        timezone: v.string(),
        schedule: v.optional(pushScheduleValidator),
        enabled: v.optional(v.boolean()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "write" });
        return await ctx.runMutation((component.lib as any).createPushJobFromTemplate, args);
      },
    }),
    createPushJobCustom: mutationGeneric({
      args: {
        companyId: v.string(),
        consumerUserId: v.string(),
        title: v.string(),
        text: v.string(),
        periodicity: pushPeriodicityValidator,
        timezone: v.string(),
        schedule: pushScheduleValidator,
        enabled: v.optional(v.boolean()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "write" });
        return await ctx.runMutation((component.lib as any).createPushJobCustom, args);
      },
    }),
    updatePushJob: mutationGeneric({
      args: {
        jobId: v.string(),
        title: v.optional(v.string()),
        text: v.optional(v.string()),
        periodicity: v.optional(pushPeriodicityValidator),
        timezone: v.optional(v.string()),
        schedule: v.optional(pushScheduleValidator),
        enabled: v.optional(v.boolean()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "write" });
        return await ctx.runMutation((component.lib as any).updatePushJob, args);
      },
    }),
    deletePushJob: mutationGeneric({
      args: {
        jobId: v.string(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "write" });
        return await ctx.runMutation((component.lib as any).deletePushJob, args);
      },
    }),
    setPushJobEnabled: mutationGeneric({
      args: {
        jobId: v.string(),
        enabled: v.boolean(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "write" });
        return await ctx.runMutation((component.lib as any).setPushJobEnabled, args);
      },
    }),
    listPushJobsForUser: queryGeneric({
      args: {
        consumerUserId: v.string(),
        includeDisabled: v.optional(v.boolean()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery((component.lib as any).listPushJobsForUser, args);
      },
    }),
    listQueueItemsForConversation: queryGeneric({
      args: {
        conversationId: v.string(),
        limit: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery((component.lib as any).listQueueItemsForConversation, args);
      },
    }),
    listQueueItemsForUserAgent: queryGeneric({
      args: {
        consumerUserId: v.string(),
        agentKey: v.string(),
        statuses: v.optional(v.array(v.union(
          v.literal("queued"),
          v.literal("processing"),
          v.literal("done"),
          v.literal("failed"),
          v.literal("dead_letter"),
        ))),
        limit: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery((component.lib as any).listQueueItemsForUserAgent, args);
      },
    }),
    getConversationViewForUserAgent: queryGeneric({
      args: {
        consumerUserId: v.string(),
        agentKey: v.string(),
        limit: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery((component.lib as any).getConversationViewForUserAgent, args);
      },
    }),
    sendMessageToUserAgent: mutationGeneric({
      args: {
        consumerUserId: v.string(),
        agentKey: v.string(),
        content: v.string(),
        metadata: v.optional(v.record(v.string(), v.string())),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, {
          type: "write",
          agentKey: args.agentKey,
        });
        return await ctx.runMutation((component.lib as any).sendMessageToUserAgent, {
          ...args,
          providerConfig: options.providerConfig,
        });
      },
    }),
    sendMessageTemplateToUserAgent: mutationGeneric({
      args: {
        consumerUserId: v.string(),
        agentKey: v.string(),
        templateId: v.string(),
        metadata: v.optional(v.record(v.string(), v.string())),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, {
          type: "write",
          agentKey: args.agentKey,
        });
        return await ctx.runMutation((component.lib as any).sendMessageTemplateToUserAgent, {
          ...args,
          providerConfig: options.providerConfig,
        });
      },
    }),
    listSnapshotsForConversation: queryGeneric({
      args: {
        conversationId: v.string(),
        limit: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery((component.lib as any).listSnapshotsForConversation, args);
      },
    }),
    listSnapshotsForUserAgent: queryGeneric({
      args: {
        consumerUserId: v.string(),
        agentKey: v.string(),
        limit: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery((component.lib as any).listSnapshotsForUserAgent, args);
      },
    }),
    getLatestSnapshotForUserAgent: queryGeneric({
      args: {
        consumerUserId: v.string(),
        agentKey: v.string(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery((component.lib as any).getLatestSnapshotForUserAgent, args);
      },
    }),
    triggerPushJobNow: mutationGeneric({
      args: {
        jobId: v.string(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "write" });
        return await ctx.runMutation((component.lib as any).triggerPushJobNow, {
          ...args,
          providerConfig: options.providerConfig,
        });
      },
    }),
    listPushJobsForAgent: queryGeneric({
      args: {
        consumerUserId: v.string(),
        agentKey: v.string(),
        includeDisabled: v.optional(v.boolean()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery((component.lib as any).listPushJobsForAgent, args);
      },
    }),
    createPushJobFromTemplateForAgent: mutationGeneric({
      args: {
        companyId: v.string(),
        consumerUserId: v.string(),
        agentKey: v.string(),
        templateId: v.string(),
        timezone: v.string(),
        schedule: v.optional(pushScheduleValidator),
        enabled: v.optional(v.boolean()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "write", agentKey: args.agentKey });
        return await ctx.runMutation((component.lib as any).createPushJobFromTemplateForAgent, args);
      },
    }),
    createPushJobCustomForAgent: mutationGeneric({
      args: {
        companyId: v.string(),
        consumerUserId: v.string(),
        agentKey: v.string(),
        title: v.string(),
        text: v.string(),
        periodicity: pushPeriodicityValidator,
        timezone: v.string(),
        schedule: pushScheduleValidator,
        enabled: v.optional(v.boolean()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "write", agentKey: args.agentKey });
        return await ctx.runMutation((component.lib as any).createPushJobCustomForAgent, args);
      },
    }),
    updatePushJobForAgent: mutationGeneric({
      args: {
        consumerUserId: v.string(),
        agentKey: v.string(),
        jobId: v.string(),
        title: v.optional(v.string()),
        text: v.optional(v.string()),
        periodicity: v.optional(pushPeriodicityValidator),
        timezone: v.optional(v.string()),
        schedule: v.optional(pushScheduleValidator),
        enabled: v.optional(v.boolean()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "write", agentKey: args.agentKey });
        return await ctx.runMutation((component.lib as any).updatePushJobForAgent, args);
      },
    }),
    triggerPushJobNowForAgent: mutationGeneric({
      args: {
        consumerUserId: v.string(),
        agentKey: v.string(),
        jobId: v.string(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "write", agentKey: args.agentKey });
        return await ctx.runMutation((component.lib as any).triggerPushJobNowForAgent, {
          ...args,
          providerConfig: options.providerConfig,
        });
      },
    }),
    listPushDispatchesForAgent: queryGeneric({
      args: {
        consumerUserId: v.string(),
        agentKey: v.string(),
        limit: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery((component.lib as any).listPushDispatchesForAgent, args);
      },
    }),
    getUserAgentPushStats: queryGeneric({
      args: {
        consumerUserId: v.string(),
        agentKey: v.string(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery((component.lib as any).getUserAgentPushStats, args);
      },
    }),
    getUserAgentConversationStats: queryGeneric({
      args: {
        consumerUserId: v.string(),
        agentKey: v.string(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery((component.lib as any).getUserAgentConversationStats, args);
      },
    }),
    getUserAgentUsageStats: queryGeneric({
      args: {
        consumerUserId: v.string(),
        agentKey: v.string(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery((component.lib as any).getUserAgentUsageStats, args);
      },
    }),
    dispatchDuePushJobs: mutationGeneric({
      args: {
        nowMs: v.optional(v.number()),
        limit: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "write" });
        return await ctx.runMutation((component.lib as any).dispatchDuePushJobs, {
          ...args,
          providerConfig: options.providerConfig,
        });
      },
    }),
    sendBroadcastToAllActiveAgents: mutationGeneric({
      args: {
        companyId: v.string(),
        title: v.string(),
        text: v.string(),
        requestedBy: v.string(),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "write" });
        return await ctx.runMutation((component.lib as any).sendBroadcastToAllActiveAgents, {
          ...args,
          providerConfig: options.providerConfig,
        });
      },
    }),
    listPushDispatchesByJob: queryGeneric({
      args: {
        jobId: v.string(),
        limit: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery((component.lib as any).listPushDispatchesByJob, args);
      },
    }),
  };
}

/**
 * Register a Telegram webhook ingress route.
 * The route only enqueues jobs in Convex and does not process messages.
 */
export function registerRoutes(
  http: HttpRouter,
  component: ComponentApi,
  {
    pathPrefix = "/agent-factory",
    resolveAgentKey,
    resolveAgentKeyFromBinding = true,
    fallbackAgentKey = "default",
    requireBindingForTelegram = false,
    providerConfig,
  }: {
    pathPrefix?: string;
    resolveAgentKey?: (update: unknown) => string;
    resolveAgentKeyFromBinding?: boolean;
    fallbackAgentKey?: string;
    requireBindingForTelegram?: boolean;
    providerConfig?: ProviderConfig;
  } = {},
) {
  http.route({
    path: `${pathPrefix}/telegram/webhook`,
    method: "POST",
    handler: httpActionGeneric(async (ctx, request) => {
      const botIdentity = parseTelegramWebhookSecretToken(
        request.headers.get("X-Telegram-Bot-Api-Secret-Token"),
      );
      if (!botIdentity) {
        return new Response(
          JSON.stringify({ ok: false, error: "missing or invalid telegram webhook secret token" }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
      const update = (await request.json()) as {
        update_id?: number;
        message?: {
          text?: string;
          caption?: string;
          message_id?: number;
          photo?: Array<{ file_id?: string; file_size?: number }>;
          video?: {
            file_id?: string;
            duration?: number;
            file_name?: string;
            mime_type?: string;
            file_size?: number;
          };
          audio?: {
            file_id?: string;
            duration?: number;
            file_name?: string;
            mime_type?: string;
            file_size?: number;
          };
          voice?: { file_id?: string; duration?: number; mime_type?: string; file_size?: number };
          document?: {
            file_id?: string;
            file_name?: string;
            mime_type?: string;
            file_size?: number;
          };
          chat?: { id?: number | string };
          from?: { id?: number | string };
        };
      };

      const message = update.message;
      if (!message?.chat?.id || !message?.from?.id) {
        return new Response(JSON.stringify({ ok: true, ignored: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const telegramUserId = String(message.from.id);
      const telegramChatId = String(message.chat.id);
      const text = typeof message.text === "string" ? message.text.trim() : "";
      const caption = typeof message.caption === "string" ? message.caption.trim() : "";
      const attachmentCandidates = collectTelegramAttachmentCandidates(message);

      const startCommandCode = text ? parseStartCommandCode(text) : null;
      const isStartCommand = text.trimStart().startsWith("/start");
      if (startCommandCode) {
        try {
          const pairing = await ctx.runMutation(component.lib.consumePairingCode, {
            code: startCommandCode,
            botIdentity,
            telegramUserId,
            telegramChatId,
          });
          return new Response(
            JSON.stringify({
              ok: true,
              pairing: {
                status: pairing.status,
                consumerUserId: pairing.consumerUserId,
                agentKey: pairing.agentKey,
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        } catch (error) {
          return new Response(
            JSON.stringify({
              ok: true,
              pairing: {
                status: "failed",
                error: error instanceof Error ? error.message : String(error),
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      }
      if (isStartCommand) {
        return new Response(
          JSON.stringify({
            ok: true,
            pairing: {
              status: "failed",
              error: "missing or invalid pairing code in /start command",
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const mappedRaw = resolveAgentKeyFromBinding
        ? await ctx.runQuery(component.lib.resolveAgentForTelegram, {
            botIdentity,
            telegramUserId,
            telegramChatId,
          })
        : { consumerUserId: null, agentKey: null, conversationId: null };
      const mapped = {
        consumerUserId: mappedRaw.consumerUserId,
        agentKey: mappedRaw.agentKey,
        conversationId: "conversationId" in mappedRaw ? mappedRaw.conversationId : null,
      };
      const configuredAgentKey = resolveAgentKey ? resolveAgentKey(update) : null;
      const agentKey = configuredAgentKey ?? mapped.agentKey ?? fallbackAgentKey;
      if (!agentKey || (requireBindingForTelegram && !configuredAgentKey && !mapped.agentKey)) {
        return new Response(
          JSON.stringify({ ok: false, error: "no active binding for telegram user" }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const messageText = buildTelegramMessageText(text, caption, attachmentCandidates);
      if (!messageText) {
        return new Response(JSON.stringify({ ok: true, ignored: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      const metadata: Record<string, string> = {
        telegramBotIdentity: botIdentity,
        telegramChatId,
        telegramUserId,
      };
      if (attachmentCandidates.length > 0) {
        metadata.telegramMediaType = Array.from(
          new Set(attachmentCandidates.map((attachment) => attachment.kind)),
        ).join("+");
        for (const attachment of attachmentCandidates) {
          const [firstLetter = ""] = attachment.kind;
          const metadataKey = `telegram${firstLetter.toUpperCase()}${attachment.kind.slice(1)}FileId`;
          metadata[metadataKey] = attachment.telegramFileId;
        }
      }
      const attachments =
        attachmentCandidates.length > 0
          ? await ctx.runAction((component.queue as any).prepareTelegramAttachmentsForEnqueue, {
              agentKey,
              attachments: attachmentCandidates,
            })
          : undefined;
      await ctx.runMutation(component.lib.enqueue, {
        conversationId: mapped.conversationId ?? buildTelegramIngressConversationId(botIdentity, telegramChatId),
        agentKey,
        payload: {
          provider: "telegram",
          providerUserId: telegramUserId,
          messageText,
          externalMessageId: String(message.message_id ?? update.update_id ?? ""),
          rawUpdateJson: JSON.stringify(update),
          metadata,
          attachments,
        },
        providerConfig,
      });
      return new Response(JSON.stringify({ ok: true }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      });
    }),
  });
}

function parseStartCommandCode(messageText: string): string | null {
  const match = messageText.match(/^\/start(?:@\w+)?\s+([A-Za-z0-9_-]{4,128})\s*$/);
  return match?.[1] ?? null;
}

function buildTelegramIngressConversationId(botIdentity: string, telegramChatId: string) {
  return `telegram:${botIdentity}:${telegramChatId}`;
}

type TelegramWebhookMessage = {
  text?: string;
  caption?: string;
  message_id?: number;
  photo?: Array<{ file_id?: string; file_size?: number }>;
  video?: {
    file_id?: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
  };
  audio?: {
    file_id?: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
  };
  voice?: {
    file_id?: string;
    mime_type?: string;
    file_size?: number;
  };
  document?: {
    file_id?: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
  };
};

type TelegramAttachmentCandidate = {
  kind: "photo" | "video" | "audio" | "voice" | "document";
  telegramFileId: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
};

function collectTelegramAttachmentCandidates(
  message: TelegramWebhookMessage,
): Array<TelegramAttachmentCandidate> {
  const attachments: Array<TelegramAttachmentCandidate> = [];
  const largestPhoto = Array.isArray(message.photo) ? message.photo[message.photo.length - 1] : null;
  if (largestPhoto?.file_id) {
    attachments.push({
      kind: "photo",
      telegramFileId: largestPhoto.file_id,
      sizeBytes: largestPhoto.file_size,
      mimeType: "image/jpeg",
    });
  }
  if (message.video?.file_id) {
    attachments.push({
      kind: "video",
      telegramFileId: message.video.file_id,
      fileName: message.video.file_name,
      mimeType: message.video.mime_type,
      sizeBytes: message.video.file_size,
    });
  }
  if (message.audio?.file_id) {
    attachments.push({
      kind: "audio",
      telegramFileId: message.audio.file_id,
      fileName: message.audio.file_name,
      mimeType: message.audio.mime_type,
      sizeBytes: message.audio.file_size,
    });
  }
  if (message.voice?.file_id) {
    attachments.push({
      kind: "voice",
      telegramFileId: message.voice.file_id,
      mimeType: message.voice.mime_type,
      sizeBytes: message.voice.file_size,
    });
  }
  if (message.document?.file_id) {
    attachments.push({
      kind: "document",
      telegramFileId: message.document.file_id,
      fileName: message.document.file_name,
      mimeType: message.document.mime_type,
      sizeBytes: message.document.file_size,
    });
  }
  return attachments;
}

function buildTelegramMessageText(
  text: string,
  caption: string,
  attachments: Array<TelegramAttachmentCandidate>,
): string {
  if (text) {
    return text;
  }
  if (caption) {
    return caption;
  }
  if (attachments.length === 0) {
    return "";
  }
  const kinds = Array.from(new Set(attachments.map((attachment) => attachment.kind)));
  const label = kinds.join(" + ");
  return `[telegram media] ${label} message`;
}


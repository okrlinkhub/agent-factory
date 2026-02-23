import {
  actionGeneric,
  httpActionGeneric,
  mutationGeneric,
  queryGeneric,
} from "convex/server";
import type { Auth, HttpRouter } from "convex/server";
import { v } from "convex/values";
import type { ComponentApi } from "../component/_generated/component.js";
import {
  providerConfigValidator,
  scalingPolicyValidator,
  type ProviderConfig,
} from "../component/config.js";
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
        const { conversationId: _, ...claimArgs } = args;
        return await ctx.runMutation(component.queue.claimNextJob, claimArgs);
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
        return await ctx.runMutation(component.queue.completeJob, args);
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
        return await ctx.runMutation(component.queue.failJob, args);
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
        conversationId: v.optional(v.string()),
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
        conversationId: v.optional(v.string()),
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
    seedDefaultAgent: mutationGeneric({
      args: {},
      handler: async (ctx) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runMutation(component.lib.configureAgent, {
          agentKey: "default",
          version: "1.0.0",
          soulMd: "# Soul",
          clientMd: "# Client",
          skills: ["agent-bridge"],
          secretsRef: ["telegram.botToken"],
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
    resolveAgentForTelegram: queryGeneric({
      args: {
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
    consumePairingCode: mutationGeneric({
      args: {
        code: v.string(),
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
    configureTelegramWebhook: actionGeneric({
      args: {
        convexSiteUrl: v.string(),
        secretRef: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runAction(component.lib.configureTelegramWebhook, args);
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
      const update = (await request.json()) as {
        update_id?: number;
        message?: {
          text?: string;
          caption?: string;
          message_id?: number;
          photo?: Array<{ file_id?: string }>;
          video?: { file_id?: string; duration?: number };
          audio?: { file_id?: string; duration?: number };
          voice?: { file_id?: string; duration?: number };
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
      const hasPhoto = Array.isArray(message.photo) && message.photo.length > 0;
      const hasVideo = !!message.video;
      const hasAudio = !!message.audio || !!message.voice;

      const startCommandCode = text ? parseStartCommandCode(text) : null;
      const isStartCommand = text.trimStart().startsWith("/start");
      if (startCommandCode) {
        try {
          const pairing = await ctx.runMutation(component.lib.consumePairingCode, {
            code: startCommandCode,
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

      const mapped = resolveAgentKeyFromBinding
        ? await ctx.runQuery(component.lib.resolveAgentForTelegram, {
            telegramUserId,
            telegramChatId,
          })
        : { consumerUserId: null, agentKey: null };
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
      const messageText =
        text ||
        caption ||
        (hasPhoto && hasVideo && hasAudio
          ? "[telegram media] photo + video + audio message"
          : hasPhoto && hasVideo
            ? "[telegram media] photo + video message"
            : hasPhoto && hasAudio
              ? "[telegram media] photo + audio message"
              : hasVideo && hasAudio
                ? "[telegram media] video + audio message"
                : hasPhoto
            ? "[telegram media] photo message"
            : hasVideo
              ? "[telegram media] video message"
            : hasAudio
              ? "[telegram media] audio message"
              : "");
      if (!messageText) {
        return new Response(JSON.stringify({ ok: true, ignored: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      const metadata: Record<string, string> = {
        telegramChatId,
        telegramUserId,
      };
      if (hasPhoto) {
        metadata.telegramMediaType = "photo";
        const largestPhoto = message.photo?.[message.photo.length - 1];
        if (largestPhoto?.file_id) {
          metadata.telegramPhotoFileId = largestPhoto.file_id;
        }
      }
      if (message.audio?.file_id) {
        metadata.telegramMediaType = hasPhoto ? "photo+audio" : hasVideo ? "video+audio" : "audio";
        metadata.telegramAudioFileId = message.audio.file_id;
      }
      if (message.voice?.file_id) {
        metadata.telegramMediaType = hasPhoto ? "photo+voice" : hasVideo ? "video+voice" : "voice";
        metadata.telegramVoiceFileId = message.voice.file_id;
      }
      if (message.video?.file_id) {
        metadata.telegramMediaType = hasPhoto ? "photo+video" : "video";
        metadata.telegramVideoFileId = message.video.file_id;
      }
      await ctx.runMutation(component.lib.enqueue, {
        conversationId: `telegram:${telegramChatId}`,
        agentKey,
        payload: {
          provider: "telegram",
          providerUserId: telegramUserId,
          messageText,
          externalMessageId: String(message.message_id ?? update.update_id ?? ""),
          rawUpdateJson: JSON.stringify(update),
          metadata,
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
  return match ? match[1] : null;
}

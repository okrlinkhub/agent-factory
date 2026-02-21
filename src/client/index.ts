import {
  actionGeneric,
  httpActionGeneric,
  mutationGeneric,
  queryGeneric,
} from "convex/server";
import type { Auth, HttpRouter } from "convex/server";
import { v } from "convex/values";
import type { ComponentApi } from "../component/_generated/component.js";

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
          runtimeConfig: { model: "gpt-5" },
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
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runAction(component.lib.reconcileWorkers, {
          flyApiToken: args.flyApiToken,
          convexUrl: args.convexUrl,
          workspaceId: args.workspaceId,
        });
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
  }: {
    pathPrefix?: string;
    resolveAgentKey?: (update: unknown) => string;
    resolveAgentKeyFromBinding?: boolean;
    fallbackAgentKey?: string;
    requireBindingForTelegram?: boolean;
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
          message_id?: number;
          chat?: { id?: number | string };
          from?: { id?: number | string };
        };
      };

      const message = update.message;
      if (!message?.chat?.id || !message?.from?.id || !message.text) {
        return new Response(JSON.stringify({ ok: false, error: "invalid payload" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const telegramUserId = String(message.from.id);
      const telegramChatId = String(message.chat.id);
      const startCommandCode = parseStartCommandCode(message.text);
      const isStartCommand = message.text.trimStart().startsWith("/start");
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
      await ctx.runMutation(component.lib.enqueue, {
        conversationId: `telegram:${telegramChatId}`,
        agentKey,
        payload: {
          provider: "telegram",
          providerUserId: telegramUserId,
          messageText: message.text,
          externalMessageId: String(message.message_id ?? update.update_id ?? ""),
          rawUpdateJson: JSON.stringify(update),
        },
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

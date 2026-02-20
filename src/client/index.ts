import {
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
            conversationId: string;
            agentKey: string;
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
  }: {
    pathPrefix?: string;
    resolveAgentKey?: (update: unknown) => string;
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

      const agentKey = resolveAgentKey ? resolveAgentKey(update) : "default";
      await ctx.runMutation(component.lib.enqueue, {
        conversationId: `telegram:${message.chat.id}`,
        agentKey,
        payload: {
          provider: "telegram",
          providerUserId: String(message.from.id),
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

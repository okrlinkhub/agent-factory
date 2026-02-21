/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    identity: {
      bindUserAgent: FunctionReference<
        "mutation",
        "internal",
        {
          agentKey: string;
          consumerUserId: string;
          metadata?: Record<string, string>;
          nowMs?: number;
          source?: "manual" | "telegram_pairing" | "api";
          telegramChatId?: string;
          telegramUserId?: string;
        },
        {
          agentKey: string;
          boundAt: number;
          consumerUserId: string;
          metadata: null | Record<string, string>;
          revokedAt: null | number;
          source: "manual" | "telegram_pairing" | "api";
          status: "active" | "revoked";
          telegramChatId: null | string;
          telegramUserId: null | string;
        },
        Name
      >;
      consumePairingCode: FunctionReference<
        "mutation",
        "internal",
        {
          code: string;
          nowMs?: number;
          telegramChatId: string;
          telegramUserId: string;
        },
        {
          agentKey: string;
          code: string;
          consumerUserId: string;
          createdAt: number;
          expiresAt: number;
          status: "pending" | "used" | "expired";
          telegramChatId: null | string;
          telegramUserId: null | string;
          usedAt: null | number;
        },
        Name
      >;
      createPairingCode: FunctionReference<
        "mutation",
        "internal",
        {
          agentKey: string;
          consumerUserId: string;
          nowMs?: number;
          ttlMs?: number;
        },
        {
          agentKey: string;
          code: string;
          consumerUserId: string;
          createdAt: number;
          expiresAt: number;
          status: "pending" | "used" | "expired";
          telegramChatId: null | string;
          telegramUserId: null | string;
          usedAt: null | number;
        },
        Name
      >;
      getPairingCodeStatus: FunctionReference<
        "query",
        "internal",
        { code: string; nowMs?: number },
        null | {
          agentKey: string;
          code: string;
          consumerUserId: string;
          createdAt: number;
          expiresAt: number;
          status: "pending" | "used" | "expired";
          telegramChatId: null | string;
          telegramUserId: null | string;
          usedAt: null | number;
        },
        Name
      >;
      getUserAgentBinding: FunctionReference<
        "query",
        "internal",
        { consumerUserId: string },
        null | {
          agentKey: string;
          boundAt: number;
          consumerUserId: string;
          metadata: null | Record<string, string>;
          revokedAt: null | number;
          source: "manual" | "telegram_pairing" | "api";
          status: "active" | "revoked";
          telegramChatId: null | string;
          telegramUserId: null | string;
        },
        Name
      >;
      resolveAgentForTelegram: FunctionReference<
        "query",
        "internal",
        { telegramChatId?: string; telegramUserId?: string },
        { agentKey: null | string; consumerUserId: null | string },
        Name
      >;
      resolveAgentForUser: FunctionReference<
        "query",
        "internal",
        { consumerUserId: string },
        { agentKey: null | string; consumerUserId: string },
        Name
      >;
      revokeUserAgentBinding: FunctionReference<
        "mutation",
        "internal",
        { consumerUserId: string; nowMs?: number },
        { revoked: number },
        Name
      >;
    };
    lib: {
      appendConversationMessages: FunctionReference<
        "mutation",
        "internal",
        {
          conversationId: string;
          messages: Array<{
            at?: number;
            content: string;
            role: "system" | "user" | "assistant" | "tool";
          }>;
          nowMs?: number;
        },
        { messageCount: number; updated: boolean },
        Name
      >;
      bindUserAgent: FunctionReference<
        "mutation",
        "internal",
        {
          agentKey: string;
          consumerUserId: string;
          metadata?: Record<string, string>;
          nowMs?: number;
          source?: "manual" | "telegram_pairing" | "api";
          telegramChatId?: string;
          telegramUserId?: string;
        },
        {
          agentKey: string;
          boundAt: number;
          consumerUserId: string;
          metadata: null | Record<string, string>;
          revokedAt: null | number;
          source: "manual" | "telegram_pairing" | "api";
          status: "active" | "revoked";
          telegramChatId: null | string;
          telegramUserId: null | string;
        },
        Name
      >;
      claim: FunctionReference<
        "mutation",
        "internal",
        { nowMs?: number; workerId: string },
        null | {
          agentKey: string;
          conversationId: string;
          leaseExpiresAt: number;
          leaseId: string;
          messageId: string;
          payload: {
            externalMessageId?: string;
            messageText: string;
            metadata?: Record<string, string>;
            provider: string;
            providerUserId: string;
            rawUpdateJson?: string;
          };
        },
        Name
      >;
      complete: FunctionReference<
        "mutation",
        "internal",
        {
          leaseId: string;
          messageId: string;
          nowMs?: number;
          workerId: string;
        },
        boolean,
        Name
      >;
      configureAgent: FunctionReference<
        "mutation",
        "internal",
        {
          agentKey: string;
          clientMd?: string;
          enabled: boolean;
          runtimeConfig: Record<string, string | number | boolean>;
          secretsRef: Array<string>;
          skills: Array<string>;
          soulMd: string;
          version: string;
        },
        string,
        Name
      >;
      consumePairingCode: FunctionReference<
        "mutation",
        "internal",
        {
          code: string;
          nowMs?: number;
          telegramChatId: string;
          telegramUserId: string;
        },
        {
          agentKey: string;
          code: string;
          consumerUserId: string;
          createdAt: number;
          expiresAt: number;
          status: "pending" | "used" | "expired";
          telegramChatId: null | string;
          telegramUserId: null | string;
          usedAt: null | number;
        },
        Name
      >;
      createPairingCode: FunctionReference<
        "mutation",
        "internal",
        {
          agentKey: string;
          consumerUserId: string;
          nowMs?: number;
          ttlMs?: number;
        },
        {
          agentKey: string;
          code: string;
          consumerUserId: string;
          createdAt: number;
          expiresAt: number;
          status: "pending" | "used" | "expired";
          telegramChatId: null | string;
          telegramUserId: null | string;
          usedAt: null | number;
        },
        Name
      >;
      enqueue: FunctionReference<
        "mutation",
        "internal",
        {
          agentKey: string;
          conversationId: string;
          maxAttempts?: number;
          nowMs?: number;
          payload: {
            externalMessageId?: string;
            messageText: string;
            metadata?: Record<string, string>;
            provider: string;
            providerUserId: string;
            rawUpdateJson?: string;
          };
          priority?: number;
          scheduledFor?: number;
        },
        string,
        Name
      >;
      fail: FunctionReference<
        "mutation",
        "internal",
        {
          errorMessage: string;
          leaseId: string;
          messageId: string;
          nowMs?: number;
          workerId: string;
        },
        {
          deadLettered: boolean;
          nextScheduledFor: null | number;
          requeued: boolean;
        },
        Name
      >;
      getHydrationBundle: FunctionReference<
        "query",
        "internal",
        { messageId: string; workspaceId: string },
        null | {
          agentKey: string;
          conversationId: string;
          conversationState: {
            contextHistory: Array<{
              at: number;
              content: string;
              role: "system" | "user" | "assistant" | "tool";
            }>;
            pendingToolCalls: Array<{
              callId: string;
              status: "pending" | "running" | "done" | "failed";
              toolName: string;
            }>;
          };
          messageId: string;
          payload: {
            externalMessageId?: string;
            messageText: string;
            metadata?: Record<string, string>;
            provider: string;
            providerUserId: string;
            rawUpdateJson?: string;
          };
          runtimeConfig: Record<string, string | number | boolean>;
          secretRefs: Array<string>;
          secretValues: Record<string, string>;
          snapshot: null | {
            compiledPromptStack: Array<{ content: string; section: string }>;
            memoryWindow: Array<{ excerpt: string; path: string }>;
            skillsBundle: Array<{ manifestMd: string; skillKey: string }>;
            snapshotId: string;
            snapshotKey: string;
          };
          telegramBotToken: null | string;
        },
        Name
      >;
      getPairingCodeStatus: FunctionReference<
        "query",
        "internal",
        { code: string; nowMs?: number },
        null | {
          agentKey: string;
          code: string;
          consumerUserId: string;
          createdAt: number;
          expiresAt: number;
          status: "pending" | "used" | "expired";
          telegramChatId: null | string;
          telegramUserId: null | string;
          usedAt: null | number;
        },
        Name
      >;
      getUserAgentBinding: FunctionReference<
        "query",
        "internal",
        { consumerUserId: string },
        null | {
          agentKey: string;
          boundAt: number;
          consumerUserId: string;
          metadata: null | Record<string, string>;
          revokedAt: null | number;
          source: "manual" | "telegram_pairing" | "api";
          status: "active" | "revoked";
          telegramChatId: null | string;
          telegramUserId: null | string;
        },
        Name
      >;
      heartbeat: FunctionReference<
        "mutation",
        "internal",
        {
          leaseId: string;
          messageId: string;
          nowMs?: number;
          workerId: string;
        },
        boolean,
        Name
      >;
      importSecret: FunctionReference<
        "mutation",
        "internal",
        {
          metadata?: Record<string, string>;
          plaintextValue: string;
          secretRef: string;
        },
        { secretId: string; secretRef: string; version: number },
        Name
      >;
      queueStats: FunctionReference<
        "query",
        "internal",
        { nowMs?: number },
        { deadLetter: number; processing: number; queuedReady: number },
        Name
      >;
      reconcileWorkers: FunctionReference<
        "action",
        "internal",
        {
          convexUrl?: string;
          flyApiToken?: string;
          nowMs?: number;
          providerConfig?: {
            appName: string;
            image: string;
            kind: "fly" | "runpod" | "ecs";
            organizationSlug: string;
            region: string;
            volumeName: string;
            volumePath: string;
            volumeSizeGb: number;
          };
          scalingPolicy?: {
            drainStep: number;
            idleTimeoutMs: number;
            maxWorkers: number;
            minWorkers: number;
            queuePerWorkerTarget: number;
            reconcileIntervalMs: number;
            spawnStep: number;
          };
          workspaceId?: string;
        },
        {
          activeWorkers: number;
          desiredWorkers: number;
          spawned: number;
          terminated: number;
        },
        Name
      >;
      resolveAgentForTelegram: FunctionReference<
        "query",
        "internal",
        { telegramChatId?: string; telegramUserId?: string },
        { agentKey: null | string; consumerUserId: null | string },
        Name
      >;
      resolveAgentForUser: FunctionReference<
        "query",
        "internal",
        { consumerUserId: string },
        { agentKey: null | string; consumerUserId: string },
        Name
      >;
      revokeUserAgentBinding: FunctionReference<
        "mutation",
        "internal",
        { consumerUserId: string; nowMs?: number },
        { revoked: number },
        Name
      >;
      secretStatus: FunctionReference<
        "query",
        "internal",
        { secretRefs: Array<string> },
        Array<{
          hasActive: boolean;
          secretRef: string;
          version: null | number;
        }>,
        Name
      >;
      workerStats: FunctionReference<
        "query",
        "internal",
        {},
        {
          activeCount: number;
          idleCount: number;
          workers: Array<{
            appName: null | string;
            heartbeatAt: number;
            load: number;
            machineId: null | string;
            status:
              | "starting"
              | "active"
              | "idle"
              | "draining"
              | "stopped"
              | "failed";
            workerId: string;
          }>;
        },
        Name
      >;
    };
    queue: {
      appendConversationMessages: FunctionReference<
        "mutation",
        "internal",
        {
          conversationId: string;
          messages: Array<{
            at?: number;
            content: string;
            role: "system" | "user" | "assistant" | "tool";
          }>;
          nowMs?: number;
        },
        { messageCount: number; updated: boolean },
        Name
      >;
      claimNextJob: FunctionReference<
        "mutation",
        "internal",
        { nowMs?: number; workerId: string },
        null | {
          agentKey: string;
          conversationId: string;
          leaseExpiresAt: number;
          leaseId: string;
          messageId: string;
          payload: {
            externalMessageId?: string;
            messageText: string;
            metadata?: Record<string, string>;
            provider: string;
            providerUserId: string;
            rawUpdateJson?: string;
          };
        },
        Name
      >;
      completeJob: FunctionReference<
        "mutation",
        "internal",
        {
          leaseId: string;
          messageId: string;
          nowMs?: number;
          workerId: string;
        },
        boolean,
        Name
      >;
      enqueueMessage: FunctionReference<
        "mutation",
        "internal",
        {
          agentKey: string;
          conversationId: string;
          maxAttempts?: number;
          nowMs?: number;
          payload: {
            externalMessageId?: string;
            messageText: string;
            metadata?: Record<string, string>;
            provider: string;
            providerUserId: string;
            rawUpdateJson?: string;
          };
          priority?: number;
          scheduledFor?: number;
        },
        string,
        Name
      >;
      failJob: FunctionReference<
        "mutation",
        "internal",
        {
          errorMessage: string;
          leaseId: string;
          messageId: string;
          nowMs?: number;
          workerId: string;
        },
        {
          deadLettered: boolean;
          nextScheduledFor: null | number;
          requeued: boolean;
        },
        Name
      >;
      getHydrationBundleForClaimedJob: FunctionReference<
        "query",
        "internal",
        { messageId: string; workspaceId: string },
        null | {
          agentKey: string;
          conversationId: string;
          conversationState: {
            contextHistory: Array<{
              at: number;
              content: string;
              role: "system" | "user" | "assistant" | "tool";
            }>;
            pendingToolCalls: Array<{
              callId: string;
              status: "pending" | "running" | "done" | "failed";
              toolName: string;
            }>;
          };
          messageId: string;
          payload: {
            externalMessageId?: string;
            messageText: string;
            metadata?: Record<string, string>;
            provider: string;
            providerUserId: string;
            rawUpdateJson?: string;
          };
          runtimeConfig: Record<string, string | number | boolean>;
          secretRefs: Array<string>;
          secretValues: Record<string, string>;
          snapshot: null | {
            compiledPromptStack: Array<{ content: string; section: string }>;
            memoryWindow: Array<{ excerpt: string; path: string }>;
            skillsBundle: Array<{ manifestMd: string; skillKey: string }>;
            snapshotId: string;
            snapshotKey: string;
          };
          telegramBotToken: null | string;
        },
        Name
      >;
      getQueueStats: FunctionReference<
        "query",
        "internal",
        { nowMs?: number },
        { deadLetter: number; processing: number; queuedReady: number },
        Name
      >;
      getSecretsStatus: FunctionReference<
        "query",
        "internal",
        { secretRefs: Array<string> },
        Array<{
          hasActive: boolean;
          secretRef: string;
          version: null | number;
        }>,
        Name
      >;
      getWorkerStats: FunctionReference<
        "query",
        "internal",
        {},
        {
          activeCount: number;
          idleCount: number;
          workers: Array<{
            appName: null | string;
            heartbeatAt: number;
            load: number;
            machineId: null | string;
            status:
              | "starting"
              | "active"
              | "idle"
              | "draining"
              | "stopped"
              | "failed";
            workerId: string;
          }>;
        },
        Name
      >;
      heartbeatJob: FunctionReference<
        "mutation",
        "internal",
        {
          leaseId: string;
          messageId: string;
          nowMs?: number;
          workerId: string;
        },
        boolean,
        Name
      >;
      importPlaintextSecret: FunctionReference<
        "mutation",
        "internal",
        {
          metadata?: Record<string, string>;
          plaintextValue: string;
          secretRef: string;
        },
        { secretId: string; secretRef: string; version: number },
        Name
      >;
      listJobsByStatus: FunctionReference<
        "query",
        "internal",
        {
          limit?: number;
          status: "queued" | "processing" | "done" | "failed" | "dead_letter";
        },
        Array<{
          _creationTime: number;
          _id: string;
          agentKey: string;
          attempts: number;
          conversationId: string;
          lastError?: string;
          maxAttempts: number;
          priority: number;
          scheduledFor: number;
          status: "queued" | "processing" | "done" | "failed" | "dead_letter";
        }>,
        Name
      >;
      upsertAgentProfile: FunctionReference<
        "mutation",
        "internal",
        {
          agentKey: string;
          clientMd?: string;
          enabled: boolean;
          runtimeConfig: Record<string, string | number | boolean>;
          secretsRef: Array<string>;
          skills: Array<string>;
          soulMd: string;
          version: string;
        },
        string,
        Name
      >;
    };
    scheduler: {
      reconcileWorkerPool: FunctionReference<
        "action",
        "internal",
        {
          convexUrl?: string;
          flyApiToken?: string;
          nowMs?: number;
          providerConfig?: {
            appName: string;
            image: string;
            kind: "fly" | "runpod" | "ecs";
            organizationSlug: string;
            region: string;
            volumeName: string;
            volumePath: string;
            volumeSizeGb: number;
          };
          scalingPolicy?: {
            drainStep: number;
            idleTimeoutMs: number;
            maxWorkers: number;
            minWorkers: number;
            queuePerWorkerTarget: number;
            reconcileIntervalMs: number;
            spawnStep: number;
          };
          workspaceId?: string;
        },
        {
          activeWorkers: number;
          desiredWorkers: number;
          spawned: number;
          terminated: number;
        },
        Name
      >;
    };
  };

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
      configureTelegramWebhook: FunctionReference<
        "action",
        "internal",
        { convexSiteUrl: string; secretRef?: string },
        {
          currentUrl: null | string;
          description: string;
          isReady: boolean;
          lastErrorDate: null | number;
          lastErrorMessage: null | string;
          ok: boolean;
          pendingUpdateCount: number;
          webhookUrl: string;
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
          workspaceId?: string;
        },
        { messageCount: number; updated: boolean },
        Name
      >;
      attachMessageMetadata: FunctionReference<
        "mutation",
        "internal",
        { messageId: string; metadata: Record<string, string> },
        boolean,
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
      checkIdleShutdowns: FunctionReference<
        "action",
        "internal",
        {
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
        },
        {
          checked: number;
          nextCheckScheduled: boolean;
          pending: number;
          stopped: number;
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
          bridgeConfig?: {
            appBaseUrlMapJsonSecretRef?: string;
            appKey?: string;
            baseUrl?: string;
            enabled: boolean;
            serviceId?: string;
            serviceKeySecretRef?: string;
          };
          clientMd?: string;
          enabled: boolean;
          providerUserId?: string;
          secretsRef: Array<string>;
          skills: Array<string>;
          soulMd: string;
          version: string;
        },
        string,
        Name
      >;
      configureTelegramWebhook: FunctionReference<
        "action",
        "internal",
        { convexSiteUrl: string; secretRef?: string },
        {
          currentUrl: null | string;
          description: string;
          isReady: boolean;
          lastErrorDate: null | number;
          lastErrorMessage: null | string;
          ok: boolean;
          pendingUpdateCount: number;
          webhookUrl: string;
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
      createPushJobCustom: FunctionReference<
        "mutation",
        "internal",
        {
          companyId: string;
          consumerUserId: string;
          enabled?: boolean;
          nowMs?: number;
          periodicity: "manual" | "daily" | "weekly" | "monthly";
          schedule:
            | { kind: "manual" }
            | { kind: "daily"; time: string }
            | { kind: "weekly"; time: string; weekday: number }
            | { dayOfMonth: number | "last"; kind: "monthly"; time: string };
          text: string;
          timezone: string;
          title: string;
        },
        string,
        Name
      >;
      createPushJobFromTemplate: FunctionReference<
        "mutation",
        "internal",
        {
          companyId: string;
          consumerUserId: string;
          enabled?: boolean;
          nowMs?: number;
          schedule?:
            | { kind: "manual" }
            | { kind: "daily"; time: string }
            | { kind: "weekly"; time: string; weekday: number }
            | { dayOfMonth: number | "last"; kind: "monthly"; time: string };
          templateId: string;
          timezone: string;
        },
        string,
        Name
      >;
      createPushTemplate: FunctionReference<
        "mutation",
        "internal",
        {
          actorUserId: string;
          companyId: string;
          enabled?: boolean;
          nowMs?: number;
          periodicity: "manual" | "daily" | "weekly" | "monthly";
          suggestedTimes: Array<
            | { kind: "daily"; time: string }
            | { kind: "weekly"; time: string; weekday: number }
            | { dayOfMonth: number | "last"; kind: "monthly"; time: string }
          >;
          templateKey: string;
          text: string;
          title: string;
        },
        string,
        Name
      >;
      deleteFlyVolume: FunctionReference<
        "action",
        "internal",
        { appName: string; flyApiToken?: string; volumeId: string },
        { message: string; ok: boolean; status: number },
        Name
      >;
      deletePushJob: FunctionReference<
        "mutation",
        "internal",
        { jobId: string },
        boolean,
        Name
      >;
      deletePushTemplate: FunctionReference<
        "mutation",
        "internal",
        { templateId: string },
        boolean,
        Name
      >;
      dispatchDuePushJobs: FunctionReference<
        "mutation",
        "internal",
        {
          limit?: number;
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
        },
        { enqueued: number; failed: number; scanned: number; skipped: number },
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
          workerId: string;
        },
        {
          deadLettered: boolean;
          nextScheduledFor: null | number;
          requeued: boolean;
        },
        Name
      >;
      generateMediaUploadUrl: FunctionReference<
        "mutation",
        "internal",
        {},
        { uploadUrl: string },
        Name
      >;
      getHydrationBundle: FunctionReference<
        "query",
        "internal",
        { messageId: string; workspaceId: string },
        null | {
          agentKey: string;
          bridgeRuntimeConfig: null | {
            appBaseUrlMapJson: null | string;
            appKey: null | string;
            baseUrl: null | string;
            serviceId: null | string;
            serviceKey: null | string;
            serviceKeySecretRef: null | string;
          };
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
      getStorageFileUrl: FunctionReference<
        "query",
        "internal",
        { storageId: string },
        null | string,
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
      listPushDispatchesByJob: FunctionReference<
        "query",
        "internal",
        { jobId: string; limit?: number },
        Array<{
          _id: string;
          createdAt: number;
          error: null | string;
          runKey: string;
          scheduledFor: number;
          status: "enqueued" | "skipped" | "failed";
        }>,
        Name
      >;
      listPushJobsForUser: FunctionReference<
        "query",
        "internal",
        { consumerUserId: string; includeDisabled?: boolean },
        Array<{
          _id: string;
          agentKey: null | string;
          companyId: string;
          consumerUserId: string;
          createdAt: number;
          enabled: boolean;
          lastRunAt: null | number;
          lastRunKey: null | string;
          nextRunAt: null | number;
          periodicity: "manual" | "daily" | "weekly" | "monthly";
          schedule:
            | { kind: "manual" }
            | { kind: "daily"; time: string }
            | { kind: "weekly"; time: string; weekday: number }
            | { dayOfMonth: number | "last"; kind: "monthly"; time: string };
          sourceTemplateId: null | string;
          text: string;
          timezone: string;
          title: string;
          updatedAt: number;
        }>,
        Name
      >;
      listPushTemplatesByCompany: FunctionReference<
        "query",
        "internal",
        { companyId: string; includeDisabled?: boolean },
        Array<{
          _id: string;
          companyId: string;
          createdAt: number;
          createdBy: string;
          enabled: boolean;
          periodicity: "manual" | "daily" | "weekly" | "monthly";
          suggestedTimes: Array<
            | { kind: "daily"; time: string }
            | { kind: "weekly"; time: string; weekday: number }
            | { dayOfMonth: number | "last"; kind: "monthly"; time: string }
          >;
          templateKey: string;
          text: string;
          title: string;
          updatedAt: number;
          updatedBy: string;
        }>,
        Name
      >;
      providerRuntimeConfig: FunctionReference<
        "query",
        "internal",
        {},
        null | {
          appName: string;
          image: string;
          kind: "fly" | "runpod" | "ecs";
          organizationSlug: string;
          region: string;
          volumeName: string;
          volumePath: string;
          volumeSizeGb: number;
        },
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
            idleTimeoutMs: number;
            maxWorkers: number;
            queuePerWorkerTarget: number;
            reconcileIntervalMs: number;
            spawnStep: number;
          };
          workspaceId?: string;
        },
        { activeWorkers: number; spawned: number; terminated: number },
        Name
      >;
      releaseStuckJobs: FunctionReference<
        "mutation",
        "internal",
        { limit?: number; nowMs?: number },
        { requeued: number; unlocked: number },
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
      sendBroadcastToAllActiveAgents: FunctionReference<
        "mutation",
        "internal",
        {
          companyId: string;
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
          requestedBy: string;
          text: string;
          title: string;
        },
        {
          broadcastId: string;
          enqueued: number;
          failed: number;
          totalTargets: number;
        },
        Name
      >;
      setProviderRuntimeConfig: FunctionReference<
        "mutation",
        "internal",
        {
          nowMs?: number;
          providerConfig: {
            appName: string;
            image: string;
            kind: "fly" | "runpod" | "ecs";
            organizationSlug: string;
            region: string;
            volumeName: string;
            volumePath: string;
            volumeSizeGb: number;
          };
        },
        null,
        Name
      >;
      setPushJobEnabled: FunctionReference<
        "mutation",
        "internal",
        { enabled: boolean; jobId: string; nowMs?: number },
        boolean,
        Name
      >;
      triggerPushJobNow: FunctionReference<
        "mutation",
        "internal",
        {
          jobId: string;
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
        },
        { enqueuedMessageId: string; runKey: string },
        Name
      >;
      updatePushJob: FunctionReference<
        "mutation",
        "internal",
        {
          enabled?: boolean;
          jobId: string;
          nowMs?: number;
          periodicity?: "manual" | "daily" | "weekly" | "monthly";
          schedule?:
            | { kind: "manual" }
            | { kind: "daily"; time: string }
            | { kind: "weekly"; time: string; weekday: number }
            | { dayOfMonth: number | "last"; kind: "monthly"; time: string };
          text?: string;
          timezone?: string;
          title?: string;
        },
        boolean,
        Name
      >;
      updatePushTemplate: FunctionReference<
        "mutation",
        "internal",
        {
          actorUserId: string;
          enabled?: boolean;
          nowMs?: number;
          periodicity?: "manual" | "daily" | "weekly" | "monthly";
          suggestedTimes?: Array<
            | { kind: "daily"; time: string }
            | { kind: "weekly"; time: string; weekday: number }
            | { dayOfMonth: number | "last"; kind: "monthly"; time: string }
          >;
          templateId: string;
          text?: string;
          title?: string;
        },
        boolean,
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
            status: "active" | "stopped";
            workerId: string;
          }>;
        },
        Name
      >;
    };
    providers: {
      fly: {
        deleteFlyVolumeManual: FunctionReference<
          "action",
          "internal",
          { appName: string; flyApiToken?: string; volumeId: string },
          { message: string; ok: boolean; status: number },
          Name
        >;
      };
    };
    pushing: {
      createPushJobCustom: FunctionReference<
        "mutation",
        "internal",
        {
          companyId: string;
          consumerUserId: string;
          enabled?: boolean;
          nowMs?: number;
          periodicity: "manual" | "daily" | "weekly" | "monthly";
          schedule:
            | { kind: "manual" }
            | { kind: "daily"; time: string }
            | { kind: "weekly"; time: string; weekday: number }
            | { dayOfMonth: number | "last"; kind: "monthly"; time: string };
          text: string;
          timezone: string;
          title: string;
        },
        string,
        Name
      >;
      createPushJobFromTemplate: FunctionReference<
        "mutation",
        "internal",
        {
          companyId: string;
          consumerUserId: string;
          enabled?: boolean;
          nowMs?: number;
          schedule?:
            | { kind: "manual" }
            | { kind: "daily"; time: string }
            | { kind: "weekly"; time: string; weekday: number }
            | { dayOfMonth: number | "last"; kind: "monthly"; time: string };
          templateId: string;
          timezone: string;
        },
        string,
        Name
      >;
      createPushTemplate: FunctionReference<
        "mutation",
        "internal",
        {
          actorUserId: string;
          companyId: string;
          enabled?: boolean;
          nowMs?: number;
          periodicity: "manual" | "daily" | "weekly" | "monthly";
          suggestedTimes: Array<
            | { kind: "daily"; time: string }
            | { kind: "weekly"; time: string; weekday: number }
            | { dayOfMonth: number | "last"; kind: "monthly"; time: string }
          >;
          templateKey: string;
          text: string;
          title: string;
        },
        string,
        Name
      >;
      deletePushJob: FunctionReference<
        "mutation",
        "internal",
        { jobId: string },
        boolean,
        Name
      >;
      deletePushTemplate: FunctionReference<
        "mutation",
        "internal",
        { templateId: string },
        boolean,
        Name
      >;
      dispatchDuePushJobs: FunctionReference<
        "mutation",
        "internal",
        {
          limit?: number;
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
        },
        { enqueued: number; failed: number; scanned: number; skipped: number },
        Name
      >;
      listPushDispatchesByJob: FunctionReference<
        "query",
        "internal",
        { jobId: string; limit?: number },
        Array<{
          _id: string;
          createdAt: number;
          error: null | string;
          runKey: string;
          scheduledFor: number;
          status: "enqueued" | "skipped" | "failed";
        }>,
        Name
      >;
      listPushJobsForUser: FunctionReference<
        "query",
        "internal",
        { consumerUserId: string; includeDisabled?: boolean },
        Array<{
          _id: string;
          agentKey: null | string;
          companyId: string;
          consumerUserId: string;
          createdAt: number;
          enabled: boolean;
          lastRunAt: null | number;
          lastRunKey: null | string;
          nextRunAt: null | number;
          periodicity: "manual" | "daily" | "weekly" | "monthly";
          schedule:
            | { kind: "manual" }
            | { kind: "daily"; time: string }
            | { kind: "weekly"; time: string; weekday: number }
            | { dayOfMonth: number | "last"; kind: "monthly"; time: string };
          sourceTemplateId: null | string;
          text: string;
          timezone: string;
          title: string;
          updatedAt: number;
        }>,
        Name
      >;
      listPushTemplatesByCompany: FunctionReference<
        "query",
        "internal",
        { companyId: string; includeDisabled?: boolean },
        Array<{
          _id: string;
          companyId: string;
          createdAt: number;
          createdBy: string;
          enabled: boolean;
          periodicity: "manual" | "daily" | "weekly" | "monthly";
          suggestedTimes: Array<
            | { kind: "daily"; time: string }
            | { kind: "weekly"; time: string; weekday: number }
            | { dayOfMonth: number | "last"; kind: "monthly"; time: string }
          >;
          templateKey: string;
          text: string;
          title: string;
          updatedAt: number;
          updatedBy: string;
        }>,
        Name
      >;
      sendBroadcastToAllActiveAgents: FunctionReference<
        "mutation",
        "internal",
        {
          companyId: string;
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
          requestedBy: string;
          text: string;
          title: string;
        },
        {
          broadcastId: string;
          enqueued: number;
          failed: number;
          totalTargets: number;
        },
        Name
      >;
      setPushJobEnabled: FunctionReference<
        "mutation",
        "internal",
        { enabled: boolean; jobId: string; nowMs?: number },
        boolean,
        Name
      >;
      triggerPushJobNow: FunctionReference<
        "mutation",
        "internal",
        {
          jobId: string;
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
        },
        { enqueuedMessageId: string; runKey: string },
        Name
      >;
      updatePushJob: FunctionReference<
        "mutation",
        "internal",
        {
          enabled?: boolean;
          jobId: string;
          nowMs?: number;
          periodicity?: "manual" | "daily" | "weekly" | "monthly";
          schedule?:
            | { kind: "manual" }
            | { kind: "daily"; time: string }
            | { kind: "weekly"; time: string; weekday: number }
            | { dayOfMonth: number | "last"; kind: "monthly"; time: string };
          text?: string;
          timezone?: string;
          title?: string;
        },
        boolean,
        Name
      >;
      updatePushTemplate: FunctionReference<
        "mutation",
        "internal",
        {
          actorUserId: string;
          enabled?: boolean;
          nowMs?: number;
          periodicity?: "manual" | "daily" | "weekly" | "monthly";
          suggestedTimes?: Array<
            | { kind: "daily"; time: string }
            | { kind: "weekly"; time: string; weekday: number }
            | { dayOfMonth: number | "last"; kind: "monthly"; time: string }
          >;
          templateId: string;
          text?: string;
          title?: string;
        },
        boolean,
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
          workspaceId?: string;
        },
        { messageCount: number; updated: boolean },
        Name
      >;
      attachMessageMetadata: FunctionReference<
        "mutation",
        "internal",
        { messageId: string; metadata: Record<string, string> },
        boolean,
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
          scheduledFor?: number;
        },
        string,
        Name
      >;
      failDataSnapshotUpload: FunctionReference<
        "mutation",
        "internal",
        { error: string; nowMs?: number; snapshotId: string; workerId: string },
        boolean,
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
          workerId: string;
        },
        {
          deadLettered: boolean;
          nextScheduledFor: null | number;
          requeued: boolean;
        },
        Name
      >;
      finalizeDataSnapshotUpload: FunctionReference<
        "mutation",
        "internal",
        {
          nowMs?: number;
          sha256: string;
          sizeBytes: number;
          snapshotId: string;
          storageId: string;
          workerId: string;
        },
        boolean,
        Name
      >;
      generateMediaUploadUrl: FunctionReference<
        "mutation",
        "internal",
        {},
        { uploadUrl: string },
        Name
      >;
      getHydrationBundleForClaimedJob: FunctionReference<
        "query",
        "internal",
        { messageId: string; workspaceId: string },
        null | {
          agentKey: string;
          bridgeRuntimeConfig: null | {
            appBaseUrlMapJson: null | string;
            appKey: null | string;
            baseUrl: null | string;
            serviceId: null | string;
            serviceKey: null | string;
            serviceKeySecretRef: null | string;
          };
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
          telegramBotToken: null | string;
        },
        Name
      >;
      getLatestDataSnapshotForRestore: FunctionReference<
        "query",
        "internal",
        {
          agentKey: string;
          conversationId?: string;
          nowMs?: number;
          workspaceId: string;
        },
        null | {
          createdAt: number;
          downloadUrl: string;
          sha256: null | string;
          sizeBytes: null | number;
          snapshotId: string;
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
      getStorageFileUrl: FunctionReference<
        "query",
        "internal",
        { storageId: string },
        null | string,
        Name
      >;
      getWorkerControlState: FunctionReference<
        "query",
        "internal",
        { workerId: string },
        { shouldStop: boolean },
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
            status: "active" | "stopped";
            workerId: string;
          }>;
        },
        Name
      >;
      hasQueuedJobsForConversation: FunctionReference<
        "query",
        "internal",
        { conversationId: string },
        boolean,
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
      prepareDataSnapshotUpload: FunctionReference<
        "mutation",
        "internal",
        {
          agentKey: string;
          conversationId?: string;
          nowMs?: number;
          reason: "drain" | "signal" | "manual";
          workerId: string;
          workspaceId: string;
        },
        { expiresAt: number; snapshotId: string; uploadUrl: string },
        Name
      >;
      providerRuntimeConfig: FunctionReference<
        "query",
        "internal",
        {},
        null | {
          appName: string;
          image: string;
          kind: "fly" | "runpod" | "ecs";
          organizationSlug: string;
          region: string;
          volumeName: string;
          volumePath: string;
          volumeSizeGb: number;
        },
        Name
      >;
      releaseStuckJobs: FunctionReference<
        "mutation",
        "internal",
        { limit?: number; nowMs?: number },
        { requeued: number; unlocked: number },
        Name
      >;
      setProviderRuntimeConfig: FunctionReference<
        "mutation",
        "internal",
        {
          nowMs?: number;
          providerConfig: {
            appName: string;
            image: string;
            kind: "fly" | "runpod" | "ecs";
            organizationSlug: string;
            region: string;
            volumeName: string;
            volumePath: string;
            volumeSizeGb: number;
          };
        },
        null,
        Name
      >;
      upsertAgentProfile: FunctionReference<
        "mutation",
        "internal",
        {
          agentKey: string;
          bridgeConfig?: {
            appBaseUrlMapJsonSecretRef?: string;
            appKey?: string;
            baseUrl?: string;
            enabled: boolean;
            serviceId?: string;
            serviceKeySecretRef?: string;
          };
          clientMd?: string;
          enabled: boolean;
          providerUserId?: string;
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
      checkIdleShutdowns: FunctionReference<
        "action",
        "internal",
        {
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
        },
        {
          checked: number;
          nextCheckScheduled: boolean;
          pending: number;
          stopped: number;
        },
        Name
      >;
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
            idleTimeoutMs: number;
            maxWorkers: number;
            queuePerWorkerTarget: number;
            reconcileIntervalMs: number;
            spawnStep: number;
          };
          workspaceId?: string;
        },
        { activeWorkers: number; spawned: number; terminated: number },
        Name
      >;
    };
  };

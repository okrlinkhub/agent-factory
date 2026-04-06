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
          conversationId: string;
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
      createUserAgentPairing: FunctionReference<
        "mutation",
        "internal",
        {
          agentKey: string;
          consumerUserId: string;
          nowMs?: number;
          ttlMs?: number;
        },
        {
          deepLink: null | string;
          pairing: {
            agentKey: string;
            code: string;
            consumerUserId: string;
            createdAt: number;
            expiresAt: number;
            status: "pending" | "used" | "expired";
            telegramChatId: null | string;
            telegramUserId: null | string;
            usedAt: null | number;
          };
        },
        Name
      >;
      getActiveUserAgent: FunctionReference<
        "query",
        "internal",
        { consumerUserId: string; nowMs?: number },
        null | {
          agentKey: string;
          bindingStatus: null | "active" | "revoked";
          canChat: boolean;
          canCreateNewAgent: boolean;
          canDisable: boolean;
          canManagePushJobs: boolean;
          consumerUserId: string;
          conversationId: null | string;
          displayName: null | string;
          pairingStatus: null | "pending" | "used" | "expired";
          status: "draft" | "pairing" | "active" | "disabled" | "failed";
          telegramUsername: null | string;
          version: null | string;
        },
        Name
      >;
      getAgentOperationalReadiness: FunctionReference<
        "query",
        "internal",
        { agentKey: string; consumerUserId: string; nowMs?: number },
        {
          hasTelegramToken: boolean;
          issues: Array<string>;
          missingSecrets: Array<string>;
          providerRuntimeConfigPresent: boolean;
          webhookReady: boolean;
          workerRuntimeConfigPresent: boolean;
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
      getProviderOperationalReadiness: FunctionReference<
        "query",
        "internal",
        {},
        {
          issues: Array<string>;
          providerRuntimeConfigPresent: boolean;
          workerRuntimeConfigPresent: boolean;
        },
        Name
      >;
      getRequiredSecretRefs: FunctionReference<
        "query",
        "internal",
        { agentKey?: string },
        { agentKey: null | string; secretRefs: Array<string> },
        Name
      >;
      getTelegramAgentReadiness: FunctionReference<
        "query",
        "internal",
        { agentKey: string; consumerUserId: string; nowMs?: number },
        {
          hasTelegramToken: boolean;
          issues: Array<string>;
          missingSecrets: Array<string>;
          providerRuntimeConfigPresent: boolean;
          webhookReady: boolean;
          workerRuntimeConfigPresent: boolean;
        },
        Name
      >;
      getUserAgent: FunctionReference<
        "query",
        "internal",
        { agentKey: string; consumerUserId: string; nowMs?: number },
        null | {
          agentKey: string;
          bindingStatus: null | "active" | "revoked";
          canChat: boolean;
          canCreateNewAgent: boolean;
          canDisable: boolean;
          canManagePushJobs: boolean;
          consumerUserId: string;
          conversationId: null | string;
          displayName: null | string;
          pairingStatus: null | "pending" | "used" | "expired";
          status: "draft" | "pairing" | "active" | "disabled" | "failed";
          telegramUsername: null | string;
          version: null | string;
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
          conversationId: string;
          metadata: null | Record<string, string>;
          revokedAt: null | number;
          source: "manual" | "telegram_pairing" | "api";
          status: "active" | "revoked";
          telegramChatId: null | string;
          telegramUserId: null | string;
        },
        Name
      >;
      getUserAgentOnboardingState: FunctionReference<
        "query",
        "internal",
        { agentKey: string; consumerUserId: string; nowMs?: number },
        {
          agentKey: string;
          nextAction:
            | "import_token"
            | "configure_webhook"
            | "create_pairing"
            | "complete_pairing"
            | "ready";
          pairingCode: null | string;
          pairingDeepLink: null | string;
          pairingStatus: null | "pending" | "used" | "expired";
          telegramUsername: null | string;
          tokenImported: boolean;
          tokenSecretRef: null | string;
          webhookReady: boolean;
        },
        Name
      >;
      getUserAgentPairingStatus: FunctionReference<
        "query",
        "internal",
        { agentKey: string; consumerUserId: string; nowMs?: number },
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
      getUserAgentsOverview: FunctionReference<
        "query",
        "internal",
        { consumerUserId: string; nowMs?: number },
        {
          activeAgentKey: null | string;
          agents: Array<{
            agentKey: string;
            bindingStatus: null | "active" | "revoked";
            canChat: boolean;
            canCreateNewAgent: boolean;
            canDisable: boolean;
            canManagePushJobs: boolean;
            consumerUserId: string;
            conversationId: null | string;
            displayName: null | string;
            pairingStatus: null | "pending" | "used" | "expired";
            status: "draft" | "pairing" | "active" | "disabled" | "failed";
            telegramUsername: null | string;
            version: null | string;
          }>;
          canCreateNewAgent: boolean;
        },
        Name
      >;
      getWebhookReadiness: FunctionReference<
        "action",
        "internal",
        { agentKey: string },
        {
          agentKey: string;
          currentUrl: null | string;
          lastErrorDate: null | number;
          lastErrorMessage: null | string;
          pendingUpdateCount: number;
          secretRef: null | string;
          webhookReady: boolean;
        },
        Name
      >;
      importTelegramTokenForAgent: FunctionReference<
        "mutation",
        "internal",
        {
          agentKey: string;
          consumerUserId: string;
          metadata?: Record<string, string>;
          plaintextValue: string;
        },
        { secretId: string; secretRef: string; version: number },
        Name
      >;
      listUserAgents: FunctionReference<
        "query",
        "internal",
        { consumerUserId: string; includeDisabled?: boolean; nowMs?: number },
        Array<{
          agentKey: string;
          bindingStatus: null | "active" | "revoked";
          canChat: boolean;
          canCreateNewAgent: boolean;
          canDisable: boolean;
          canManagePushJobs: boolean;
          consumerUserId: string;
          conversationId: null | string;
          displayName: null | string;
          pairingStatus: null | "pending" | "used" | "expired";
          status: "draft" | "pairing" | "active" | "disabled" | "failed";
          telegramUsername: null | string;
          version: null | string;
        }>,
        Name
      >;
      resolveAgentForTelegram: FunctionReference<
        "query",
        "internal",
        { telegramChatId?: string; telegramUserId?: string },
        {
          agentKey: null | string;
          consumerUserId: null | string;
          conversationId: null | string;
        },
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
          conversationId: string;
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
        { conversationId?: string; nowMs?: number; workerId: string },
        null | {
          agentKey: string;
          conversationId: string;
          leaseExpiresAt: number;
          leaseId: string;
          messageId: string;
          payload: {
            attachments?: Array<{
              downloadUrl?: string;
              expiresAt: number;
              fileName?: string;
              kind: "photo" | "video" | "audio" | "voice" | "document";
              mimeType?: string;
              sizeBytes?: number;
              status: "ready" | "expired";
              storageId: string;
              telegramFileId: string;
            }>;
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
          enabled: boolean;
          secretsRef: Array<string>;
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
      createMessageTemplate: FunctionReference<
        "mutation",
        "internal",
        {
          actorUserId: string;
          enabled?: boolean;
          nowMs?: number;
          tags: Array<string>;
          text: string;
          title: string;
        },
        string,
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
      createPushJobCustomForAgent: FunctionReference<
        "mutation",
        "internal",
        {
          agentKey: string;
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
      createPushJobFromTemplateForAgent: FunctionReference<
        "mutation",
        "internal",
        {
          agentKey: string;
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
      createUserAgentPairing: FunctionReference<
        "mutation",
        "internal",
        {
          agentKey: string;
          consumerUserId: string;
          nowMs?: number;
          ttlMs?: number;
        },
        {
          deepLink: null | string;
          pairing: {
            agentKey: string;
            code: string;
            consumerUserId: string;
            createdAt: number;
            expiresAt: number;
            status: "pending" | "used" | "expired";
            telegramChatId: null | string;
            telegramUserId: null | string;
            usedAt: null | number;
          };
        },
        Name
      >;
      deleteFlyVolume: FunctionReference<
        "action",
        "internal",
        { appName: string; flyApiToken?: string; volumeId: string },
        { message: string; ok: boolean; status: number },
        Name
      >;
      deleteMessageTemplate: FunctionReference<
        "mutation",
        "internal",
        { templateId: string },
        boolean,
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
            attachments?: Array<{
              downloadUrl?: string;
              expiresAt: number;
              fileName?: string;
              kind: "photo" | "video" | "audio" | "voice" | "document";
              mimeType?: string;
              sizeBytes?: number;
              status: "ready" | "expired";
              storageId: string;
              telegramFileId: string;
            }>;
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
      getActiveUserAgent: FunctionReference<
        "query",
        "internal",
        { consumerUserId: string; nowMs?: number },
        null | {
          agentKey: string;
          bindingStatus: null | "active" | "revoked";
          canChat: boolean;
          canCreateNewAgent: boolean;
          canDisable: boolean;
          canManagePushJobs: boolean;
          consumerUserId: string;
          conversationId: null | string;
          displayName: null | string;
          pairingStatus: null | "pending" | "used" | "expired";
          status: "draft" | "pairing" | "active" | "disabled" | "failed";
          telegramUsername: null | string;
          version: null | string;
        },
        Name
      >;
      getAgentOperationalReadiness: FunctionReference<
        "query",
        "internal",
        { agentKey: string; consumerUserId: string; nowMs?: number },
        {
          hasTelegramToken: boolean;
          issues: Array<string>;
          missingSecrets: Array<string>;
          providerRuntimeConfigPresent: boolean;
          webhookReady: boolean;
          workerRuntimeConfigPresent: boolean;
        },
        Name
      >;
      getConversationViewForUserAgent: FunctionReference<
        "query",
        "internal",
        { agentKey: string; consumerUserId: string; limit?: number },
        {
          contextHistory: Array<{
            at: number;
            content: string;
            role: "system" | "user" | "assistant" | "tool";
          }>;
          conversationId: string;
          hasQueuedJobs: boolean;
          lastAssistantMessageAt: null | number;
          lastUserMessageAt: null | number;
          latestMessageId: null | string;
          pendingToolCalls: Array<{
            callId: string;
            status: "pending" | "running" | "done" | "failed";
            toolName: string;
          }>;
          queueItems: Array<{
            _creationTime: number;
            _id: string;
            agentKey: string;
            attempts: number;
            conversationId: string;
            lastError: null | string;
            maxAttempts: number;
            payload: {
              attachments?: Array<{
                downloadUrl?: string;
                expiresAt: number;
                fileName?: string;
                kind: "photo" | "video" | "audio" | "voice" | "document";
                mimeType?: string;
                sizeBytes?: number;
                status: "ready" | "expired";
                storageId: string;
                telegramFileId: string;
              }>;
              externalMessageId?: string;
              messageText: string;
              metadata?: Record<string, string>;
              provider: string;
              providerUserId: string;
              rawUpdateJson?: string;
            };
            priority: number;
            scheduledFor: number;
            status: "queued" | "processing" | "done" | "failed" | "dead_letter";
          }>;
        },
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
            attachments?: Array<{
              downloadUrl?: string;
              expiresAt: number;
              fileName?: string;
              kind: "photo" | "video" | "audio" | "voice" | "document";
              mimeType?: string;
              sizeBytes?: number;
              status: "ready" | "expired";
              storageId: string;
              telegramFileId: string;
            }>;
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
      getLatestSnapshotForUserAgent: FunctionReference<
        "query",
        "internal",
        { agentKey: string; consumerUserId: string; nowMs?: number },
        null | {
          conversationId: string;
          createdAt: number;
          downloadUrl: null | string;
          sha256: null | string;
          sizeBytes: null | number;
          snapshotId: string;
          status: "uploading" | "ready" | "failed" | "expired";
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
      getProviderOperationalReadiness: FunctionReference<
        "query",
        "internal",
        {},
        {
          issues: Array<string>;
          providerRuntimeConfigPresent: boolean;
          workerRuntimeConfigPresent: boolean;
        },
        Name
      >;
      getRequiredSecretRefs: FunctionReference<
        "query",
        "internal",
        { agentKey?: string },
        { agentKey: null | string; secretRefs: Array<string> },
        Name
      >;
      getStorageFileUrl: FunctionReference<
        "query",
        "internal",
        { storageId: string },
        null | string,
        Name
      >;
      getTelegramAgentReadiness: FunctionReference<
        "query",
        "internal",
        { agentKey: string; consumerUserId: string; nowMs?: number },
        {
          hasTelegramToken: boolean;
          issues: Array<string>;
          missingSecrets: Array<string>;
          providerRuntimeConfigPresent: boolean;
          webhookReady: boolean;
          workerRuntimeConfigPresent: boolean;
        },
        Name
      >;
      getUserAgent: FunctionReference<
        "query",
        "internal",
        { agentKey: string; consumerUserId: string; nowMs?: number },
        null | {
          agentKey: string;
          bindingStatus: null | "active" | "revoked";
          canChat: boolean;
          canCreateNewAgent: boolean;
          canDisable: boolean;
          canManagePushJobs: boolean;
          consumerUserId: string;
          conversationId: null | string;
          displayName: null | string;
          pairingStatus: null | "pending" | "used" | "expired";
          status: "draft" | "pairing" | "active" | "disabled" | "failed";
          telegramUsername: null | string;
          version: null | string;
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
          conversationId: string;
          metadata: null | Record<string, string>;
          revokedAt: null | number;
          source: "manual" | "telegram_pairing" | "api";
          status: "active" | "revoked";
          telegramChatId: null | string;
          telegramUserId: null | string;
        },
        Name
      >;
      getUserAgentConversationStats: FunctionReference<
        "query",
        "internal",
        { agentKey: string; consumerUserId: string },
        {
          contextMessages: number;
          failedMessages: number;
          queuedMessages: number;
        },
        Name
      >;
      getUserAgentOnboardingState: FunctionReference<
        "query",
        "internal",
        { agentKey: string; consumerUserId: string; nowMs?: number },
        {
          agentKey: string;
          nextAction:
            | "import_token"
            | "configure_webhook"
            | "create_pairing"
            | "complete_pairing"
            | "ready";
          pairingCode: null | string;
          pairingDeepLink: null | string;
          pairingStatus: null | "pending" | "used" | "expired";
          telegramUsername: null | string;
          tokenImported: boolean;
          tokenSecretRef: null | string;
          webhookReady: boolean;
        },
        Name
      >;
      getUserAgentPairingStatus: FunctionReference<
        "query",
        "internal",
        { agentKey: string; consumerUserId: string; nowMs?: number },
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
      getUserAgentPushStats: FunctionReference<
        "query",
        "internal",
        { agentKey: string; consumerUserId: string },
        {
          activePushJobs: number;
          latestDispatchAt: null | number;
          totalDispatches: number;
          totalPushJobs: number;
        },
        Name
      >;
      getUserAgentsOverview: FunctionReference<
        "query",
        "internal",
        { consumerUserId: string; nowMs?: number },
        {
          activeAgentKey: null | string;
          agents: Array<{
            agentKey: string;
            bindingStatus: null | "active" | "revoked";
            canChat: boolean;
            canCreateNewAgent: boolean;
            canDisable: boolean;
            canManagePushJobs: boolean;
            consumerUserId: string;
            conversationId: null | string;
            displayName: null | string;
            pairingStatus: null | "pending" | "used" | "expired";
            status: "draft" | "pairing" | "active" | "disabled" | "failed";
            telegramUsername: null | string;
            version: null | string;
          }>;
          canCreateNewAgent: boolean;
        },
        Name
      >;
      getUserAgentUsageStats: FunctionReference<
        "query",
        "internal",
        { agentKey: string; consumerUserId: string },
        {
          activePushJobs: number;
          contextMessages: number;
          failedMessages: number;
          latestDispatchAt: null | number;
          queuedMessages: number;
          totalDispatches: number;
          totalPushJobs: number;
        },
        Name
      >;
      getWebhookReadiness: FunctionReference<
        "action",
        "internal",
        { agentKey: string },
        {
          agentKey: string;
          currentUrl: null | string;
          lastErrorDate: null | number;
          lastErrorMessage: null | string;
          pendingUpdateCount: number;
          secretRef: null | string;
          webhookReady: boolean;
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
      importTelegramTokenForAgent: FunctionReference<
        "mutation",
        "internal",
        {
          agentKey: string;
          consumerUserId: string;
          metadata?: Record<string, string>;
          plaintextValue: string;
        },
        { secretId: string; secretRef: string; version: number },
        Name
      >;
      listMessageTemplatesByCompany: FunctionReference<
        "query",
        "internal",
        { includeDisabled?: boolean; limit?: number },
        Array<{
          _id: string;
          createdAt: number;
          createdBy: string;
          enabled: boolean;
          tags: Array<string>;
          templateKey: string;
          text: string;
          title: string;
          updatedAt: number;
          updatedBy: string;
          usageCount: number;
        }>,
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
      listPushDispatchesForAgent: FunctionReference<
        "query",
        "internal",
        { agentKey: string; consumerUserId: string; limit?: number },
        Array<{
          _id: string;
          createdAt: number;
          error: null | string;
          jobId: string;
          runKey: string;
          scheduledFor: number;
          status: "enqueued" | "skipped" | "failed";
        }>,
        Name
      >;
      listPushJobsForAgent: FunctionReference<
        "query",
        "internal",
        { agentKey: string; consumerUserId: string; includeDisabled?: boolean },
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
      listQueueItemsForConversation: FunctionReference<
        "query",
        "internal",
        { conversationId: string; limit?: number },
        Array<{
          _creationTime: number;
          _id: string;
          agentKey: string;
          attempts: number;
          conversationId: string;
          lastError: null | string;
          maxAttempts: number;
          payload: {
            attachments?: Array<{
              downloadUrl?: string;
              expiresAt: number;
              fileName?: string;
              kind: "photo" | "video" | "audio" | "voice" | "document";
              mimeType?: string;
              sizeBytes?: number;
              status: "ready" | "expired";
              storageId: string;
              telegramFileId: string;
            }>;
            externalMessageId?: string;
            messageText: string;
            metadata?: Record<string, string>;
            provider: string;
            providerUserId: string;
            rawUpdateJson?: string;
          };
          priority: number;
          scheduledFor: number;
          status: "queued" | "processing" | "done" | "failed" | "dead_letter";
        }>,
        Name
      >;
      listQueueItemsForUserAgent: FunctionReference<
        "query",
        "internal",
        {
          agentKey: string;
          consumerUserId: string;
          limit?: number;
          statuses?: Array<
            "queued" | "processing" | "done" | "failed" | "dead_letter"
          >;
        },
        Array<{
          _creationTime: number;
          _id: string;
          agentKey: string;
          attempts: number;
          conversationId: string;
          lastError: null | string;
          maxAttempts: number;
          payload: {
            attachments?: Array<{
              downloadUrl?: string;
              expiresAt: number;
              fileName?: string;
              kind: "photo" | "video" | "audio" | "voice" | "document";
              mimeType?: string;
              sizeBytes?: number;
              status: "ready" | "expired";
              storageId: string;
              telegramFileId: string;
            }>;
            externalMessageId?: string;
            messageText: string;
            metadata?: Record<string, string>;
            provider: string;
            providerUserId: string;
            rawUpdateJson?: string;
          };
          priority: number;
          scheduledFor: number;
          status: "queued" | "processing" | "done" | "failed" | "dead_letter";
        }>,
        Name
      >;
      listSnapshotsForConversation: FunctionReference<
        "query",
        "internal",
        { conversationId: string; limit?: number; nowMs?: number },
        Array<{
          conversationId: string;
          createdAt: number;
          downloadUrl: null | string;
          sha256: null | string;
          sizeBytes: null | number;
          snapshotId: string;
          status: "uploading" | "ready" | "failed" | "expired";
        }>,
        Name
      >;
      listSnapshotsForUserAgent: FunctionReference<
        "query",
        "internal",
        {
          agentKey: string;
          consumerUserId: string;
          limit?: number;
          nowMs?: number;
        },
        Array<{
          conversationId: string;
          createdAt: number;
          downloadUrl: null | string;
          sha256: null | string;
          sizeBytes: null | number;
          snapshotId: string;
          status: "uploading" | "ready" | "failed" | "expired";
        }>,
        Name
      >;
      listUserAgents: FunctionReference<
        "query",
        "internal",
        { consumerUserId: string; includeDisabled?: boolean; nowMs?: number },
        Array<{
          agentKey: string;
          bindingStatus: null | "active" | "revoked";
          canChat: boolean;
          canCreateNewAgent: boolean;
          canDisable: boolean;
          canManagePushJobs: boolean;
          consumerUserId: string;
          conversationId: null | string;
          displayName: null | string;
          pairingStatus: null | "pending" | "used" | "expired";
          status: "draft" | "pairing" | "active" | "disabled" | "failed";
          telegramUsername: null | string;
          version: null | string;
        }>,
        Name
      >;
      messageRuntimeConfig: FunctionReference<
        "query",
        "internal",
        {},
        null | {
          systemPrompt?: string;
          telegramAttachmentRetentionMs?: number;
        },
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
        {
          agentKey: null | string;
          consumerUserId: null | string;
          conversationId: null | string;
        },
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
      sendMessageTemplateToUserAgent: FunctionReference<
        "mutation",
        "internal",
        {
          agentKey: string;
          consumerUserId: string;
          metadata?: Record<string, string>;
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
          templateId: string;
        },
        { messageId: string; usageCount: number },
        Name
      >;
      sendMessageToUserAgent: FunctionReference<
        "mutation",
        "internal",
        {
          agentKey: string;
          consumerUserId: string;
          content: string;
          metadata?: Record<string, string>;
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
        string,
        Name
      >;
      setMessageRuntimeConfig: FunctionReference<
        "mutation",
        "internal",
        {
          messageConfig: {
            systemPrompt?: string;
            telegramAttachmentRetentionMs?: number;
          };
          nowMs?: number;
        },
        null,
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
      triggerPushJobNowForAgent: FunctionReference<
        "mutation",
        "internal",
        {
          agentKey: string;
          consumerUserId: string;
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
      updateMessageTemplate: FunctionReference<
        "mutation",
        "internal",
        {
          actorUserId: string;
          enabled?: boolean;
          nowMs?: number;
          tags?: Array<string>;
          templateId: string;
          text?: string;
          title?: string;
        },
        boolean,
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
      updatePushJobForAgent: FunctionReference<
        "mutation",
        "internal",
        {
          agentKey: string;
          consumerUserId: string;
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
            status: "active" | "draining" | "stopping" | "stopped";
            workerId: string;
          }>;
        },
        Name
      >;
    };
    messageTemplates: {
      createMessageTemplate: FunctionReference<
        "mutation",
        "internal",
        {
          actorUserId: string;
          enabled?: boolean;
          nowMs?: number;
          tags: Array<string>;
          text: string;
          title: string;
        },
        string,
        Name
      >;
      deleteMessageTemplate: FunctionReference<
        "mutation",
        "internal",
        { templateId: string },
        boolean,
        Name
      >;
      listMessageTemplatesByCompany: FunctionReference<
        "query",
        "internal",
        { includeDisabled?: boolean; limit?: number },
        Array<{
          _id: string;
          createdAt: number;
          createdBy: string;
          enabled: boolean;
          tags: Array<string>;
          templateKey: string;
          text: string;
          title: string;
          updatedAt: number;
          updatedBy: string;
          usageCount: number;
        }>,
        Name
      >;
      updateMessageTemplate: FunctionReference<
        "mutation",
        "internal",
        {
          actorUserId: string;
          enabled?: boolean;
          nowMs?: number;
          tags?: Array<string>;
          templateId: string;
          text?: string;
          title?: string;
        },
        boolean,
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
      createPushJobCustomForAgent: FunctionReference<
        "mutation",
        "internal",
        {
          agentKey: string;
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
      createPushJobFromTemplateForAgent: FunctionReference<
        "mutation",
        "internal",
        {
          agentKey: string;
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
      getUserAgentConversationStats: FunctionReference<
        "query",
        "internal",
        { agentKey: string; consumerUserId: string },
        {
          contextMessages: number;
          failedMessages: number;
          queuedMessages: number;
        },
        Name
      >;
      getUserAgentPushStats: FunctionReference<
        "query",
        "internal",
        { agentKey: string; consumerUserId: string },
        {
          activePushJobs: number;
          latestDispatchAt: null | number;
          totalDispatches: number;
          totalPushJobs: number;
        },
        Name
      >;
      getUserAgentUsageStats: FunctionReference<
        "query",
        "internal",
        { agentKey: string; consumerUserId: string },
        {
          activePushJobs: number;
          contextMessages: number;
          failedMessages: number;
          latestDispatchAt: null | number;
          queuedMessages: number;
          totalDispatches: number;
          totalPushJobs: number;
        },
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
      listPushDispatchesForAgent: FunctionReference<
        "query",
        "internal",
        { agentKey: string; consumerUserId: string; limit?: number },
        Array<{
          _id: string;
          createdAt: number;
          error: null | string;
          jobId: string;
          runKey: string;
          scheduledFor: number;
          status: "enqueued" | "skipped" | "failed";
        }>,
        Name
      >;
      listPushJobsForAgent: FunctionReference<
        "query",
        "internal",
        { agentKey: string; consumerUserId: string; includeDisabled?: boolean },
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
      triggerPushJobNowForAgent: FunctionReference<
        "mutation",
        "internal",
        {
          agentKey: string;
          consumerUserId: string;
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
      updatePushJobForAgent: FunctionReference<
        "mutation",
        "internal",
        {
          agentKey: string;
          consumerUserId: string;
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
        { conversationId?: string; nowMs?: number; workerId: string },
        null | {
          agentKey: string;
          conversationId: string;
          leaseExpiresAt: number;
          leaseId: string;
          messageId: string;
          payload: {
            attachments?: Array<{
              downloadUrl?: string;
              expiresAt: number;
              fileName?: string;
              kind: "photo" | "video" | "audio" | "voice" | "document";
              mimeType?: string;
              sizeBytes?: number;
              status: "ready" | "expired";
              storageId: string;
              telegramFileId: string;
            }>;
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
      deleteGlobalSkill: FunctionReference<
        "mutation",
        "internal",
        { slug: string },
        {
          deleted: boolean;
          deletedReleases: number;
          deletedVersions: number;
          slug: string;
        },
        Name
      >;
      deployGlobalSkill: FunctionReference<
        "mutation",
        "internal",
        {
          actor?: string;
          description?: string;
          displayName?: string;
          entryPoint?: string;
          files: Array<{ content: string; path: string; sha256: string }>;
          moduleFormat?: "esm" | "cjs";
          nowMs?: number;
          releaseChannel?: "stable" | "canary";
          slug: string;
          version: string;
        },
        {
          releaseChannel: "stable" | "canary";
          releaseId: string;
          sha256: string;
          skillId: string;
          slug: string;
          version: string;
          versionId: string;
        },
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
            attachments?: Array<{
              downloadUrl?: string;
              expiresAt: number;
              fileName?: string;
              kind: "photo" | "video" | "audio" | "voice" | "document";
              mimeType?: string;
              sizeBytes?: number;
              status: "ready" | "expired";
              storageId: string;
              telegramFileId: string;
            }>;
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
      getConversationViewForUserAgent: FunctionReference<
        "query",
        "internal",
        { agentKey: string; consumerUserId: string; limit?: number },
        {
          contextHistory: Array<{
            at: number;
            content: string;
            role: "system" | "user" | "assistant" | "tool";
          }>;
          conversationId: string;
          hasQueuedJobs: boolean;
          lastAssistantMessageAt: null | number;
          lastUserMessageAt: null | number;
          latestMessageId: null | string;
          pendingToolCalls: Array<{
            callId: string;
            status: "pending" | "running" | "done" | "failed";
            toolName: string;
          }>;
          queueItems: Array<{
            _creationTime: number;
            _id: string;
            agentKey: string;
            attempts: number;
            conversationId: string;
            lastError: null | string;
            maxAttempts: number;
            payload: {
              attachments?: Array<{
                downloadUrl?: string;
                expiresAt: number;
                fileName?: string;
                kind: "photo" | "video" | "audio" | "voice" | "document";
                mimeType?: string;
                sizeBytes?: number;
                status: "ready" | "expired";
                storageId: string;
                telegramFileId: string;
              }>;
              externalMessageId?: string;
              messageText: string;
              metadata?: Record<string, string>;
              provider: string;
              providerUserId: string;
              rawUpdateJson?: string;
            };
            priority: number;
            scheduledFor: number;
            status: "queued" | "processing" | "done" | "failed" | "dead_letter";
          }>;
        },
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
            attachments?: Array<{
              downloadUrl?: string;
              expiresAt: number;
              fileName?: string;
              kind: "photo" | "video" | "audio" | "voice" | "document";
              mimeType?: string;
              sizeBytes?: number;
              status: "ready" | "expired";
              storageId: string;
              telegramFileId: string;
            }>;
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
          conversationId: string;
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
      getLatestSnapshotForUserAgent: FunctionReference<
        "query",
        "internal",
        { agentKey: string; consumerUserId: string; nowMs?: number },
        null | {
          conversationId: string;
          createdAt: number;
          downloadUrl: null | string;
          sha256: null | string;
          sizeBytes: null | number;
          snapshotId: string;
          status: "uploading" | "ready" | "failed" | "expired";
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
      getWorkerGlobalSkillsManifest: FunctionReference<
        "query",
        "internal",
        {
          releaseChannel?: "stable" | "canary";
          workerId?: string;
          workspaceId?: string;
        },
        {
          generatedAt: number;
          layoutVersion: "openclaw-workspace-skill-v1";
          manifestVersion: string;
          releaseChannel: "stable" | "canary";
          skills: Array<{
            entryPoint: string;
            files: Array<{ content: string; path: string; sha256: string }>;
            moduleFormat: "esm" | "cjs";
            sha256: string;
            skillDirName: string;
            slug: string;
            version: string;
          }>;
          workspaceId: string;
        },
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
            status: "active" | "draining" | "stopping" | "stopped";
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
      listGlobalSkills: FunctionReference<
        "query",
        "internal",
        {
          limit?: number;
          releaseChannel?: "stable" | "canary";
          status?: "active" | "disabled";
        },
        Array<{
          activeRelease: null | {
            activatedAt: number;
            entryPoint: string;
            moduleFormat: "esm" | "cjs";
            releaseChannel: "stable" | "canary";
            releaseId: string;
            sha256: string;
            version: string;
            versionId: string;
          };
          description?: string;
          displayName: string;
          skillId: string;
          slug: string;
          status: "active" | "disabled";
          updatedAt: number;
        }>,
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
      listQueueItemsForConversation: FunctionReference<
        "query",
        "internal",
        { conversationId: string; limit?: number },
        Array<{
          _creationTime: number;
          _id: string;
          agentKey: string;
          attempts: number;
          conversationId: string;
          lastError: null | string;
          maxAttempts: number;
          payload: {
            attachments?: Array<{
              downloadUrl?: string;
              expiresAt: number;
              fileName?: string;
              kind: "photo" | "video" | "audio" | "voice" | "document";
              mimeType?: string;
              sizeBytes?: number;
              status: "ready" | "expired";
              storageId: string;
              telegramFileId: string;
            }>;
            externalMessageId?: string;
            messageText: string;
            metadata?: Record<string, string>;
            provider: string;
            providerUserId: string;
            rawUpdateJson?: string;
          };
          priority: number;
          scheduledFor: number;
          status: "queued" | "processing" | "done" | "failed" | "dead_letter";
        }>,
        Name
      >;
      listQueueItemsForUserAgent: FunctionReference<
        "query",
        "internal",
        {
          agentKey: string;
          consumerUserId: string;
          limit?: number;
          statuses?: Array<
            "queued" | "processing" | "done" | "failed" | "dead_letter"
          >;
        },
        Array<{
          _creationTime: number;
          _id: string;
          agentKey: string;
          attempts: number;
          conversationId: string;
          lastError: null | string;
          maxAttempts: number;
          payload: {
            attachments?: Array<{
              downloadUrl?: string;
              expiresAt: number;
              fileName?: string;
              kind: "photo" | "video" | "audio" | "voice" | "document";
              mimeType?: string;
              sizeBytes?: number;
              status: "ready" | "expired";
              storageId: string;
              telegramFileId: string;
            }>;
            externalMessageId?: string;
            messageText: string;
            metadata?: Record<string, string>;
            provider: string;
            providerUserId: string;
            rawUpdateJson?: string;
          };
          priority: number;
          scheduledFor: number;
          status: "queued" | "processing" | "done" | "failed" | "dead_letter";
        }>,
        Name
      >;
      listSnapshotsForConversation: FunctionReference<
        "query",
        "internal",
        { conversationId: string; limit?: number; nowMs?: number },
        Array<{
          conversationId: string;
          createdAt: number;
          downloadUrl: null | string;
          sha256: null | string;
          sizeBytes: null | number;
          snapshotId: string;
          status: "uploading" | "ready" | "failed" | "expired";
        }>,
        Name
      >;
      listSnapshotsForUserAgent: FunctionReference<
        "query",
        "internal",
        {
          agentKey: string;
          consumerUserId: string;
          limit?: number;
          nowMs?: number;
        },
        Array<{
          conversationId: string;
          createdAt: number;
          downloadUrl: null | string;
          sha256: null | string;
          sizeBytes: null | number;
          snapshotId: string;
          status: "uploading" | "ready" | "failed" | "expired";
        }>,
        Name
      >;
      messageRuntimeConfig: FunctionReference<
        "query",
        "internal",
        {},
        null | {
          systemPrompt?: string;
          telegramAttachmentRetentionMs?: number;
        },
        Name
      >;
      prepareDataSnapshotUpload: FunctionReference<
        "mutation",
        "internal",
        {
          agentKey: string;
          conversationId: string;
          nowMs?: number;
          reason: "drain" | "signal" | "manual";
          workerId: string;
          workspaceId: string;
        },
        { expiresAt: number; snapshotId: string; uploadUrl: string },
        Name
      >;
      prepareTelegramAttachmentsForEnqueue: FunctionReference<
        "action",
        "internal",
        {
          agentKey: string;
          attachments: Array<{
            fileName?: string;
            kind: "photo" | "video" | "audio" | "voice" | "document";
            mimeType?: string;
            sizeBytes?: number;
            telegramFileId: string;
          }>;
        },
        Array<{
          downloadUrl?: string;
          expiresAt: number;
          fileName?: string;
          kind: "photo" | "video" | "audio" | "voice" | "document";
          mimeType?: string;
          sizeBytes?: number;
          status: "ready" | "expired";
          storageId: string;
          telegramFileId: string;
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
      releaseStuckJobs: FunctionReference<
        "mutation",
        "internal",
        { limit?: number; nowMs?: number },
        { requeued: number; unlocked: number },
        Name
      >;
      sendMessageTemplateToUserAgent: FunctionReference<
        "mutation",
        "internal",
        {
          agentKey: string;
          consumerUserId: string;
          metadata?: Record<string, string>;
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
          templateId: string;
        },
        { messageId: string; usageCount: number },
        Name
      >;
      sendMessageToUserAgent: FunctionReference<
        "mutation",
        "internal",
        {
          agentKey: string;
          consumerUserId: string;
          content: string;
          metadata?: Record<string, string>;
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
        string,
        Name
      >;
      setGlobalSkillStatus: FunctionReference<
        "mutation",
        "internal",
        {
          actor?: string;
          nowMs?: number;
          slug: string;
          status: "active" | "disabled";
        },
        { slug: string; status: "active" | "disabled"; updated: boolean },
        Name
      >;
      setMessageRuntimeConfig: FunctionReference<
        "mutation",
        "internal",
        {
          messageConfig: {
            systemPrompt?: string;
            telegramAttachmentRetentionMs?: number;
          };
          nowMs?: number;
        },
        null,
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
          enabled: boolean;
          secretsRef: Array<string>;
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

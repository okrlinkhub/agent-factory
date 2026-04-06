import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { workerStatusValidator } from "./workerLifecycle.js";

export default defineSchema({
  agentProfiles: defineTable({
    agentKey: v.string(),
    version: v.string(),
    secretsRef: v.array(v.string()),
    bridgeConfig: v.optional(
      v.object({
        enabled: v.boolean(),
        baseUrl: v.optional(v.string()),
        serviceId: v.optional(v.string()),
        appKey: v.optional(v.string()),
        serviceKeySecretRef: v.optional(v.string()),
        appBaseUrlMapJsonSecretRef: v.optional(v.string()),
      }),
    ),
    enabled: v.boolean(),
  })
    .index("by_agentKey", ["agentKey"])
    .index("by_enabled", ["enabled"]),

  conversations: defineTable({
    conversationId: v.string(),
    agentKey: v.string(),
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
    processingLock: v.optional(
      v.object({
        leaseId: v.string(),
        workerId: v.string(),
        leaseExpiresAt: v.number(),
        heartbeatAt: v.number(),
        claimedMessageId: v.id("messageQueue"),
      }),
    ),
  })
    .index("by_conversationId", ["conversationId"])
    .index("by_agentKey", ["agentKey"]),

  messageQueue: defineTable({
    conversationId: v.string(),
    agentKey: v.string(),
    payload: v.object({
      provider: v.string(),
      providerUserId: v.string(),
      messageText: v.string(),
      externalMessageId: v.optional(v.string()),
      rawUpdateJson: v.optional(v.string()),
      metadata: v.optional(v.record(v.string(), v.string())),
      attachments: v.optional(
        v.array(
          v.object({
            kind: v.union(
              v.literal("photo"),
              v.literal("video"),
              v.literal("audio"),
              v.literal("voice"),
              v.literal("document"),
            ),
            status: v.union(v.literal("ready"), v.literal("expired")),
            storageId: v.id("_storage"),
            telegramFileId: v.string(),
            fileName: v.optional(v.string()),
            mimeType: v.optional(v.string()),
            sizeBytes: v.optional(v.number()),
            expiresAt: v.number(),
            downloadUrl: v.optional(v.string()),
          }),
        ),
      ),
    }),
    status: v.union(
      v.literal("queued"),
      v.literal("processing"),
      v.literal("done"),
      v.literal("failed"),
      v.literal("dead_letter"),
    ),
    priority: v.number(),
    scheduledFor: v.number(),
    claimedBy: v.optional(v.string()),
    leaseId: v.optional(v.string()),
    leaseExpiresAt: v.optional(v.number()),
    attempts: v.number(),
    maxAttempts: v.number(),
    lastError: v.optional(v.string()),
    nextRetryAt: v.optional(v.number()),
    deadLetteredAt: v.optional(v.number()),
  })
    .index("by_status_and_scheduledFor", ["status", "scheduledFor"])
    .index("by_status_and_priority_and_scheduledFor", [
      "status",
      "priority",
      "scheduledFor",
    ])
    .index("by_status_and_leaseExpiresAt", ["status", "leaseExpiresAt"])
    .index("by_conversationId_and_status", ["conversationId", "status"])
    .index("by_conversationId_and_scheduledFor", ["conversationId", "scheduledFor"])
    .index("by_claimedBy_and_status", ["claimedBy", "status"])
    .index("by_agentKey_and_status", ["agentKey", "status"]),

  workers: defineTable({
    workerId: v.string(),
    provider: v.string(),
    machineRef: v.optional(
      v.object({
        appName: v.string(),
        machineId: v.string(),
        region: v.optional(v.string()),
      }),
    ),
    status: workerStatusValidator,
    load: v.number(),
    heartbeatAt: v.number(),
    lastClaimAt: v.optional(v.number()),
    scheduledShutdownAt: v.optional(v.number()),
    stoppedAt: v.optional(v.number()),
    lastSnapshotId: v.optional(v.id("dataSnapshots")),
    assignment: v.optional(
      v.object({
        conversationId: v.string(),
        agentKey: v.string(),
        leaseId: v.string(),
        assignedAt: v.number(),
      }),
    ),
    capabilities: v.array(v.string()),
  })
    .index("by_workerId", ["workerId"])
    .index("by_status", ["status"])
    .index("by_heartbeatAt", ["heartbeatAt"])
    .index("by_scheduledShutdownAt", ["scheduledShutdownAt"]),

  runtimeConfig: defineTable({
    key: v.string(),
    providerConfig: v.optional(
      v.object({
        kind: v.union(v.literal("fly"), v.literal("runpod"), v.literal("ecs")),
        appName: v.string(),
        organizationSlug: v.string(),
        image: v.string(),
        region: v.string(),
        volumeName: v.string(),
        volumePath: v.string(),
        volumeSizeGb: v.number(),
      }),
    ),
    messageConfig: v.optional(
      v.object({
        systemPrompt: v.optional(v.string()),
        telegramAttachmentRetentionMs: v.optional(v.number()),
      }),
    ),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  messageAttachments: defineTable({
    messageId: v.id("messageQueue"),
    conversationId: v.string(),
    agentKey: v.string(),
    provider: v.string(),
    kind: v.union(
      v.literal("photo"),
      v.literal("video"),
      v.literal("audio"),
      v.literal("voice"),
      v.literal("document"),
    ),
    status: v.union(v.literal("ready"), v.literal("expired")),
    storageId: v.id("_storage"),
    telegramFileId: v.string(),
    fileName: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    sizeBytes: v.optional(v.number()),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_messageId", ["messageId"])
    .index("by_status_and_expiresAt", ["status", "expiresAt"])
    .index("by_conversationId_and_createdAt", ["conversationId", "createdAt"]),

  dataSnapshots: defineTable({
    workspaceId: v.string(),
    agentKey: v.string(),
    workerId: v.string(),
    conversationId: v.string(),
    reason: v.union(v.literal("drain"), v.literal("signal"), v.literal("manual")),
    formatVersion: v.number(),
    archiveFileId: v.optional(v.id("_storage")),
    sha256: v.optional(v.string()),
    sizeBytes: v.optional(v.number()),
    status: v.union(
      v.literal("uploading"),
      v.literal("ready"),
      v.literal("failed"),
      v.literal("expired"),
    ),
    error: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
    expiresAt: v.number(),
  })
    .index("by_workerId_and_createdAt", ["workerId", "createdAt"])
    .index("by_workspaceId_and_agentKey_and_createdAt", ["workspaceId", "agentKey", "createdAt"])
    .index("by_workspaceId_and_agentKey_and_conversationId_and_createdAt", [
      "workspaceId",
      "agentKey",
      "conversationId",
      "createdAt",
    ])
    .index("by_agentKey_and_createdAt", ["agentKey", "createdAt"])
    .index("by_conversationId_and_createdAt", ["conversationId", "createdAt"])
    .index("by_status_and_expiresAt", ["status", "expiresAt"]),

  secrets: defineTable({
    secretRef: v.string(),
    version: v.number(),
    encryptedValue: v.string(),
    keyId: v.string(),
    algorithm: v.string(),
    active: v.boolean(),
    rotatedFrom: v.optional(v.number()),
    metadata: v.optional(v.record(v.string(), v.string())),
  })
    .index("by_secretRef", ["secretRef"])
    .index("by_secretRef_and_active", ["secretRef", "active"])
    .index("by_active", ["active"]),

  identityBindings: defineTable({
    consumerUserId: v.string(),
    agentKey: v.string(),
    conversationId: v.string(),
    status: v.union(v.literal("active"), v.literal("revoked")),
    source: v.union(
      v.literal("manual"),
      v.literal("telegram_pairing"),
      v.literal("api"),
    ),
    telegramUserId: v.optional(v.string()),
    telegramChatId: v.optional(v.string()),
    metadata: v.optional(v.record(v.string(), v.string())),
    boundAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_consumerUserId_and_status", ["consumerUserId", "status"])
    .index("by_consumerUserId_and_agentKey_and_boundAt", [
      "consumerUserId",
      "agentKey",
      "boundAt",
    ])
    .index("by_telegramUserId_and_status", ["telegramUserId", "status"])
    .index("by_telegramChatId_and_status", ["telegramChatId", "status"])
    .index("by_agentKey_and_status", ["agentKey", "status"]),

  pairingCodes: defineTable({
    code: v.string(),
    consumerUserId: v.string(),
    agentKey: v.string(),
    status: v.union(v.literal("pending"), v.literal("used"), v.literal("expired")),
    createdAt: v.number(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
    telegramUserId: v.optional(v.string()),
    telegramChatId: v.optional(v.string()),
  })
    .index("by_code", ["code"])
    .index("by_consumerUserId_and_status", ["consumerUserId", "status"])
    .index("by_consumerUserId_and_agentKey_and_createdAt", [
      "consumerUserId",
      "agentKey",
      "createdAt",
    ])
    .index("by_expiresAt", ["expiresAt"]),

  globalSkills: defineTable({
    slug: v.string(),
    displayName: v.string(),
    description: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("disabled")),
    createdBy: v.string(),
    updatedBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"]),

  globalSkillVersions: defineTable({
    skillId: v.id("globalSkills"),
    version: v.string(),
    moduleFormat: v.union(v.literal("esm"), v.literal("cjs")),
    entryPoint: v.string(),
    files: v.array(
      v.object({
        path: v.string(),
        content: v.string(),
        sha256: v.string(),
      }),
    ),
    sha256: v.string(),
    createdBy: v.string(),
    createdAt: v.number(),
  })
    .index("by_skillId_and_version", ["skillId", "version"])
    .index("by_skillId_and_createdAt", ["skillId", "createdAt"]),

  globalSkillReleases: defineTable({
    skillId: v.id("globalSkills"),
    versionId: v.id("globalSkillVersions"),
    releaseChannel: v.union(v.literal("stable"), v.literal("canary")),
    isActive: v.boolean(),
    activatedBy: v.string(),
    activatedAt: v.number(),
  })
    .index("by_skillId_and_releaseChannel_and_isActive", [
      "skillId",
      "releaseChannel",
      "isActive",
    ])
    .index("by_releaseChannel_and_isActive_and_activatedAt", [
      "releaseChannel",
      "isActive",
      "activatedAt",
    ]),

  conversationHydrationCache: defineTable({
    conversationId: v.string(),
    agentKey: v.string(),
    snapshotKey: v.string(),
    lastHydratedAt: v.number(),
    lastMessageId: v.optional(v.id("messageQueue")),
    deltaContext: v.array(
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
    deltaFingerprint: v.string(),
  })
    .index("by_conversationId", ["conversationId"])
    .index("by_agentKey_and_lastHydratedAt", ["agentKey", "lastHydratedAt"]),

  messagePushTemplates: defineTable({
    companyId: v.string(),
    templateKey: v.string(),
    title: v.string(),
    text: v.string(),
    periodicity: v.union(
      v.literal("manual"),
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly"),
    ),
    suggestedTimes: v.array(
      v.union(
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
      ),
    ),
    enabled: v.boolean(),
    createdBy: v.string(),
    updatedBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_companyId", ["companyId"])
    .index("by_companyId_and_templateKey", ["companyId", "templateKey"])
    .index("by_companyId_and_enabled", ["companyId", "enabled"]),

  messageTemplates: defineTable({
    templateKey: v.string(),
    title: v.string(),
    text: v.string(),
    tags: v.array(v.string()),
    usageCount: v.number(),
    enabled: v.boolean(),
    createdBy: v.string(),
    updatedBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_templateKey", ["templateKey"])
    .index("by_enabled", ["enabled"]),

  messagePushJobs: defineTable({
    companyId: v.string(),
    consumerUserId: v.string(),
    agentKey: v.optional(v.string()),
    sourceTemplateId: v.optional(v.id("messagePushTemplates")),
    title: v.string(),
    text: v.string(),
    periodicity: v.union(
      v.literal("manual"),
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly"),
    ),
    timezone: v.string(),
    schedule: v.union(
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
    ),
    enabled: v.boolean(),
    nextRunAt: v.optional(v.number()),
    lastRunAt: v.optional(v.number()),
    lastRunKey: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_enabled_and_nextRunAt", ["enabled", "nextRunAt"])
    .index("by_consumerUserId", ["consumerUserId"])
    .index("by_consumerUserId_and_enabled", ["consumerUserId", "enabled"])
    .index("by_companyId", ["companyId"])
    .index("by_companyId_and_enabled", ["companyId", "enabled"])
    .index("by_sourceTemplateId", ["sourceTemplateId"]),

  messagePushDispatches: defineTable({
    jobId: v.id("messagePushJobs"),
    consumerUserId: v.string(),
    runKey: v.string(),
    scheduledFor: v.number(),
    enqueuedMessageId: v.optional(v.id("messageQueue")),
    status: v.union(
      v.literal("enqueued"),
      v.literal("skipped"),
      v.literal("failed"),
    ),
    error: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_jobId_and_runKey", ["jobId", "runKey"])
    .index("by_consumerUserId_and_createdAt", ["consumerUserId", "createdAt"]),

  messagePushBroadcasts: defineTable({
    companyId: v.string(),
    title: v.string(),
    text: v.string(),
    target: v.literal("all_active_agents"),
    requestedBy: v.string(),
    requestedAt: v.number(),
    status: v.union(v.literal("running"), v.literal("done"), v.literal("failed")),
    totalTargets: v.number(),
    enqueuedCount: v.number(),
    failedCount: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_companyId_and_requestedAt", ["companyId", "requestedAt"])
    .index("by_status", ["status"]),

  messagePushBroadcastDispatches: defineTable({
    broadcastId: v.id("messagePushBroadcasts"),
    consumerUserId: v.string(),
    agentKey: v.string(),
    runKey: v.string(),
    enqueuedMessageId: v.optional(v.id("messageQueue")),
    status: v.union(
      v.literal("enqueued"),
      v.literal("skipped"),
      v.literal("failed"),
    ),
    error: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_broadcastId_and_consumerUserId", ["broadcastId", "consumerUserId"])
    .index("by_broadcastId_and_createdAt", ["broadcastId", "createdAt"]),
});

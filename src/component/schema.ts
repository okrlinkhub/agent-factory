import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  agentProfiles: defineTable({
    agentKey: v.string(),
    providerUserId: v.optional(v.string()),
    version: v.string(),
    soulMd: v.string(),
    clientMd: v.optional(v.string()),
    skills: v.array(v.string()),
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
    status: v.union(
      v.literal("active"),
      v.literal("stopped"),
    ),
    load: v.number(),
    heartbeatAt: v.number(),
    lastClaimAt: v.optional(v.number()),
    scheduledShutdownAt: v.optional(v.number()),
    stoppedAt: v.optional(v.number()),
    lastSnapshotId: v.optional(v.id("dataSnapshots")),
    capabilities: v.array(v.string()),
  })
    .index("by_workerId", ["workerId"])
    .index("by_status", ["status"])
    .index("by_heartbeatAt", ["heartbeatAt"])
    .index("by_scheduledShutdownAt", ["scheduledShutdownAt"]),

  dataSnapshots: defineTable({
    workspaceId: v.string(),
    agentKey: v.string(),
    workerId: v.string(),
    conversationId: v.optional(v.string()),
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
    .index("by_expiresAt", ["expiresAt"]),

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
});

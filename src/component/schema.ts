import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  agentProfiles: defineTable({
    agentKey: v.string(),
    version: v.string(),
    soulMd: v.string(),
    clientMd: v.optional(v.string()),
    skills: v.array(v.string()),
    runtimeConfig: v.record(
      v.string(),
      v.union(v.string(), v.number(), v.boolean()),
    ),
    secretsRef: v.array(v.string()),
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
      v.literal("starting"),
      v.literal("active"),
      v.literal("idle"),
      v.literal("draining"),
      v.literal("stopped"),
      v.literal("failed"),
    ),
    load: v.number(),
    heartbeatAt: v.number(),
    lastClaimAt: v.optional(v.number()),
    scheduledShutdownAt: v.optional(v.number()),
    capabilities: v.array(v.string()),
  })
    .index("by_workerId", ["workerId"])
    .index("by_status", ["status"])
    .index("by_heartbeatAt", ["heartbeatAt"])
    .index("by_scheduledShutdownAt", ["scheduledShutdownAt"]),

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

  workspaceDocuments: defineTable({
    workspaceId: v.string(),
    docType: v.union(
      v.literal("agents"),
      v.literal("soul"),
      v.literal("user"),
      v.literal("identity"),
      v.literal("heartbeat"),
      v.literal("tools"),
      v.literal("bootstrap"),
      v.literal("memory_daily"),
      v.literal("memory_longterm"),
      v.literal("custom"),
    ),
    path: v.string(),
    content: v.string(),
    contentHash: v.string(),
    version: v.number(),
    updatedAt: v.number(),
    isActive: v.boolean(),
  })
    .index("by_workspaceId_and_docType", ["workspaceId", "docType"])
    .index("by_workspaceId_and_path", ["workspaceId", "path"])
    .index("by_workspaceId_and_updatedAt", ["workspaceId", "updatedAt"]),

  agentSkills: defineTable({
    workspaceId: v.string(),
    agentKey: v.string(),
    skillKey: v.string(),
    description: v.optional(v.string()),
    manifestMd: v.string(),
    entrypoints: v.array(
      v.object({
        kind: v.union(v.literal("script"), v.literal("command"), v.literal("api")),
        value: v.string(),
      }),
    ),
    requiredEnvRefs: v.array(v.string()),
    tags: v.array(v.string()),
    updatedAt: v.number(),
    enabled: v.boolean(),
  })
    .index("by_agentKey_and_enabled", ["agentKey", "enabled"])
    .index("by_workspaceId_and_skillKey", ["workspaceId", "skillKey"])
    .index("by_workspaceId_and_updatedAt", ["workspaceId", "updatedAt"]),

  skillAssets: defineTable({
    workspaceId: v.string(),
    skillKey: v.string(),
    assetPath: v.string(),
    assetType: v.union(
      v.literal("script"),
      v.literal("config"),
      v.literal("venv"),
      v.literal("other"),
    ),
    contentHash: v.string(),
    sizeBytes: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspaceId_and_skillKey", ["workspaceId", "skillKey"])
    .index("by_workspaceId_and_assetPath", ["workspaceId", "assetPath"]),

  hydrationSnapshots: defineTable({
    workspaceId: v.string(),
    agentKey: v.string(),
    snapshotKey: v.string(),
    snapshotVersion: v.number(),
    sourceFingerprint: v.string(),
    compiledPromptStack: v.array(
      v.object({
        section: v.string(),
        content: v.string(),
      }),
    ),
    skillsBundle: v.array(
      v.object({
        skillKey: v.string(),
        manifestMd: v.string(),
      }),
    ),
    memoryWindow: v.array(
      v.object({
        path: v.string(),
        excerpt: v.string(),
      }),
    ),
    tokenEstimate: v.number(),
    builtAt: v.number(),
    expiresAt: v.number(),
    status: v.union(
      v.literal("ready"),
      v.literal("stale"),
      v.literal("building"),
      v.literal("failed"),
    ),
  })
    .index("by_agentKey_and_builtAt", ["agentKey", "builtAt"])
    .index("by_snapshotKey", ["snapshotKey"])
    .index("by_status_and_expiresAt", ["status", "expiresAt"]),

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
      }),
    ),
    deltaFingerprint: v.string(),
  })
    .index("by_conversationId", ["conversationId"])
    .index("by_agentKey_and_lastHydratedAt", ["agentKey", "lastHydratedAt"]),
});

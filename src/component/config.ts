import { v } from "convex/values";

export type WorkerProviderKind = "fly" | "runpod" | "ecs";

export type QueuePolicy = {
  defaultPriority: number;
  maxPriority: number;
  claimBatchSize: number;
};

export type RetryPolicy = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
  jitterRatio: number;
};

export type LeasePolicy = {
  leaseMs: number;
  heartbeatIntervalMs: number;
  staleAfterMs: number;
};

export type ScalingPolicy = {
  minWorkers: number;
  maxWorkers: number;
  queuePerWorkerTarget: number;
  spawnStep: number;
  drainStep: number;
  idleTimeoutMs: number;
  reconcileIntervalMs: number;
};

export type HydrationPolicy = {
  memoryWindowDays: number;
  maxContextTokens: number;
  snapshotTtlMs: number;
  rebuildOnDocTypes: Array<string>;
  skillAssetScanMode: "manifest_only" | "manifest_and_assets";
};

export type ProviderConfig = {
  kind: WorkerProviderKind;
  appName: string;
  organizationSlug: string;
  image: string;
  region: string;
  volumeName: string;
  volumePath: string;
  volumeSizeGb: number;
};

export type AgentFactoryConfig = {
  queue: QueuePolicy;
  retry: RetryPolicy;
  lease: LeasePolicy;
  scaling: ScalingPolicy;
  hydration: HydrationPolicy;
  provider: ProviderConfig;
};

export const DEFAULT_WORKER_IMAGE =
  "registry.fly.io/agent-factory-workers:deployment-01KHZ7REDTXSPC3YF3X46D9QJE";
export const DEFAULT_WORKER_VOLUME_NAME = "openclaw_data";
export const DEFAULT_WORKER_VOLUME_PATH = "/data";
export const DEFAULT_WORKER_RUNTIME_ENV: Record<string, string> = {
  NODE_ENV: "production",
  OPENCLAW_GATEWAY_HOST: "127.0.0.1",
  OPENCLAW_GATEWAY_PORT: "18789",
  OPENCLAW_GATEWAY_URL: "http://127.0.0.1:18789",
  OPENCLAW_STATE_DIR: "/data/.clawdbot",
  OPENCLAW_WORKSPACE_DIR: "/data/workspace",
  OPENCLAW_CONFIG_PATH: "/data/.clawdbot/openclaw.json",
  OPENCLAW_REQUIRE_DATA_MOUNT: "true",
  OPENCLAW_RUN_SETUP: "false",
  OPENCLAW_SETUP_TIMEOUT_MS: "90000",
  OPENCLAW_GATEWAY_COMMAND: "node /app/openclaw.mjs gateway",
  OPENCLAW_GATEWAY_READY_TIMEOUT_MS: "60000",
  OPENCLAW_GATEWAY_READY_POLL_MS: "500",
  OPENCLAW_GATEWAY_READY_REQUIRED: "true",
};

export const queuePolicyValidator = v.object({
  defaultPriority: v.number(),
  maxPriority: v.number(),
  claimBatchSize: v.number(),
});

export const retryPolicyValidator = v.object({
  maxAttempts: v.number(),
  baseDelayMs: v.number(),
  maxDelayMs: v.number(),
  backoffFactor: v.number(),
  jitterRatio: v.number(),
});

export const leasePolicyValidator = v.object({
  leaseMs: v.number(),
  heartbeatIntervalMs: v.number(),
  staleAfterMs: v.number(),
});

export const scalingPolicyValidator = v.object({
  minWorkers: v.number(),
  maxWorkers: v.number(),
  queuePerWorkerTarget: v.number(),
  spawnStep: v.number(),
  drainStep: v.number(),
  idleTimeoutMs: v.number(),
  reconcileIntervalMs: v.number(),
});

export const hydrationPolicyValidator = v.object({
  memoryWindowDays: v.number(),
  maxContextTokens: v.number(),
  snapshotTtlMs: v.number(),
  rebuildOnDocTypes: v.array(v.string()),
  skillAssetScanMode: v.union(
    v.literal("manifest_only"),
    v.literal("manifest_and_assets"),
  ),
});

export const providerConfigValidator = v.object({
  kind: v.union(v.literal("fly"), v.literal("runpod"), v.literal("ecs")),
  appName: v.string(),
  organizationSlug: v.string(),
  image: v.string(),
  region: v.string(),
  volumeName: v.string(),
  volumePath: v.string(),
  volumeSizeGb: v.number(),
});

export const agentFactoryConfigValidator = v.object({
  queue: queuePolicyValidator,
  retry: retryPolicyValidator,
  lease: leasePolicyValidator,
  scaling: scalingPolicyValidator,
  hydration: hydrationPolicyValidator,
  provider: providerConfigValidator,
});

export const DEFAULT_CONFIG: AgentFactoryConfig = {
  queue: {
    defaultPriority: 50,
    maxPriority: 100,
    claimBatchSize: 25,
  },
  retry: {
    maxAttempts: 5,
    baseDelayMs: 1_000,
    maxDelayMs: 120_000,
    backoffFactor: 2,
    jitterRatio: 0.1,
  },
  lease: {
    leaseMs: 360_000,
    heartbeatIntervalMs: 15_000,
    staleAfterMs: 420_000,
  },
  scaling: {
    minWorkers: 0,
    maxWorkers: 1,
    queuePerWorkerTarget: 5,
    spawnStep: 1,
    drainStep: 1,
    idleTimeoutMs: 120_000,
    reconcileIntervalMs: 15_000,
  },
  hydration: {
    memoryWindowDays: 2,
    maxContextTokens: 16_000,
    snapshotTtlMs: 300_000,
    rebuildOnDocTypes: ["soul", "user", "identity", "memory_daily", "custom"],
    skillAssetScanMode: "manifest_and_assets",
  },
  provider: {
    kind: "fly",
    appName: "agent-factory-workers",
    organizationSlug: "personal",
    image: DEFAULT_WORKER_IMAGE,
    region: "iad",
    volumeName: DEFAULT_WORKER_VOLUME_NAME,
    volumePath: DEFAULT_WORKER_VOLUME_PATH,
    volumeSizeGb: 10,
  },
};

export function mergeWithDefaultConfig(
  partial: Partial<AgentFactoryConfig> | null | undefined,
): AgentFactoryConfig {
  return {
    queue: {
      ...DEFAULT_CONFIG.queue,
      ...(partial?.queue ?? {}),
    },
    retry: {
      ...DEFAULT_CONFIG.retry,
      ...(partial?.retry ?? {}),
    },
    lease: {
      ...DEFAULT_CONFIG.lease,
      ...(partial?.lease ?? {}),
    },
    scaling: {
      ...DEFAULT_CONFIG.scaling,
      ...(partial?.scaling ?? {}),
    },
    hydration: {
      ...DEFAULT_CONFIG.hydration,
      ...(partial?.hydration ?? {}),
    },
    provider: {
      ...DEFAULT_CONFIG.provider,
      ...(partial?.provider ?? {}),
    },
  };
}

export function computeRetryDelayMs(
  attempts: number,
  policy: RetryPolicy,
  nowMs: number,
): number {
  const exponent = Math.max(0, attempts - 1);
  const exponential = policy.baseDelayMs * policy.backoffFactor ** exponent;
  const bounded = Math.min(policy.maxDelayMs, Math.max(policy.baseDelayMs, exponential));
  const jitter = Math.floor(
    bounded * policy.jitterRatio * pseudoRandomFromNow(nowMs, attempts),
  );
  return bounded + jitter;
}

function pseudoRandomFromNow(nowMs: number, attempts: number): number {
  const seed = (nowMs ^ (attempts * 2654435761)) >>> 0;
  return (seed % 10_000) / 10_000;
}

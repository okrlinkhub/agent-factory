import { v } from "convex/values";
import { internal } from "./_generated/api.js";
import { action, internalAction } from "./_generated/server.js";
import {
  DEFAULT_CONFIG,
  DEFAULT_WORKER_RUNTIME_ENV,
  providerConfigValidator,
  scalingPolicyValidator,
} from "./config.js";
import { FlyMachinesProvider, type WorkerProvider } from "./providers/fly.js";

const reconcileWorkerPoolArgs = {
  flyApiToken: v.optional(v.string()),
  convexUrl: v.optional(v.string()),
  workspaceId: v.optional(v.string()),
  nowMs: v.optional(v.number()),
  scalingPolicy: v.optional(scalingPolicyValidator),
  providerConfig: v.optional(providerConfigValidator),
};
const enforceIdleShutdownsArgs = {
  flyApiToken: v.optional(v.string()),
  nowMs: v.optional(v.number()),
  providerConfig: v.optional(providerConfigValidator),
};

const reconcileWorkerPoolReturns = v.object({
  activeWorkers: v.number(),
  spawned: v.number(),
  terminated: v.number(),
});
const enforceIdleShutdownsReturns = v.object({
  checked: v.number(),
  stopped: v.number(),
  pending: v.number(),
  nextCheckScheduled: v.boolean(),
});

type ReconcileWorkerPoolArgs = {
  flyApiToken?: string;
  convexUrl?: string;
  workspaceId?: string;
  nowMs?: number;
  scalingPolicy?: typeof DEFAULT_CONFIG.scaling;
  providerConfig?: typeof DEFAULT_CONFIG.provider;
};

type SchedulerWorkerRow = {
  workerId: string;
  status: "active" | "stopped";
  load: number;
  heartbeatAt: number;
  lastClaimAt: number | null;
  scheduledShutdownAt: number | null;
  stoppedAt: number | null;
  lastSnapshotId: string | null;
  machineId: string | null;
  appName: string | null;
  region: string | null;
};

export const reconcileWorkerPool = action({
  args: reconcileWorkerPoolArgs,
  returns: reconcileWorkerPoolReturns,
  handler: async (ctx, args) => {
    return await runReconcileWorkerPool(ctx, args);
  },
});

export const reconcileWorkerPoolInternal = internalAction({
  args: reconcileWorkerPoolArgs,
  returns: reconcileWorkerPoolReturns,
  handler: async (ctx, args) => {
    return await runReconcileWorkerPool(ctx, args);
  },
});

export const reconcileWorkerPoolFromEnqueue = internalAction({
  args: reconcileWorkerPoolArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      await runReconcileWorkerPool(ctx, args);
    } catch (error) {
      console.warn(
        `[scheduler] enqueue-triggered reconcile skipped: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    return null;
  },
});

export const enforceIdleShutdowns = internalAction({
  args: enforceIdleShutdownsArgs,
  returns: enforceIdleShutdownsReturns,
  handler: async (ctx, args) => {
    return await runEnforceIdleShutdowns(ctx, args);
  },
});

export const checkIdleShutdowns = action({
  args: enforceIdleShutdownsArgs,
  returns: enforceIdleShutdownsReturns,
  handler: async (ctx, args) => {
    return await runEnforceIdleShutdowns(ctx, args);
  },
});

async function runReconcileWorkerPool(
  ctx: any,
  args: ReconcileWorkerPoolArgs,
) {
  const nowMs = args.nowMs ?? Date.now();
  const scaling = args.scalingPolicy ?? DEFAULT_CONFIG.scaling;
  // Always recover expired leases before scaling decisions.
  // This prevents stale "processing" jobs from blocking queue drain forever.
  try {
    await ctx.runMutation((internal.queue as any).releaseExpiredLeases, {
      nowMs,
      limit: 500,
    });
  } catch (error) {
    console.warn(
      `[scheduler] releaseExpiredLeases failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const activeConversationCount: number = await ctx.runQuery(
    (internal.queue as any).getActiveConversationCountForScheduler,
    { nowMs, limit: 1000 },
  );
  let workerRows: Array<{
    workerId: string;
    status: "active" | "stopped";
    load: number;
    heartbeatAt: number;
    lastClaimAt: number | null;
    scheduledShutdownAt: number | null;
    stoppedAt: number | null;
    lastSnapshotId: string | null;
    machineId: string | null;
    appName: string | null;
    region: string | null;
  }> = await ctx.runQuery((internal.queue as any).listWorkersForScheduler, {});
  const staleHeartbeatCutoff = nowMs - DEFAULT_CONFIG.lease.staleAfterMs;
  const healthyActiveWorkers = workerRows.filter(
    (worker) => worker.status === "active" && worker.heartbeatAt > staleHeartbeatCutoff,
  ).length;

  const providerConfig = await resolveProviderConfigWithFallback(
    ctx,
    args.providerConfig,
    nowMs,
  );
  if (!providerConfig) {
    // Best-effort mode: if runtime providerConfig has not been initialized yet,
    // do not fail enqueue-triggered reconcile loudly.
    return {
      activeWorkers: healthyActiveWorkers,
      spawned: 0,
      terminated: 0,
    };
  }

  const flyApiToken =
    args.flyApiToken ??
    (await ctx.runQuery(internal.queue.getActiveSecretPlaintext, {
      secretRef: "fly.apiToken",
    }));
  if (!flyApiToken) {
    throw new Error(
      "Missing Fly API token. Import an active 'fly.apiToken' secret or pass flyApiToken explicitly.",
    );
  }
  const convexUrl =
    args.convexUrl ??
    (await ctx.runQuery(internal.queue.getActiveSecretPlaintext, {
      secretRef: "convex.url",
    }));
  if (!convexUrl) {
    throw new Error(
      "Missing Convex URL. Import an active 'convex.url' secret or pass convexUrl explicitly.",
    );
  }
  const workspaceId = args.workspaceId ?? "default";
  const provider = resolveProvider(providerConfig.kind, flyApiToken);
  const isScopedWorker = (worker: SchedulerWorkerRow) =>
    worker.appName === null || worker.appName === providerConfig.appName;
  const scopedWorkerRows = () => workerRows.filter(isScopedWorker);
  const localWorkersWithMachine = workerRows.filter(
    (worker) => isScopedWorker(worker) && worker.machineId,
  );
  const liveMachineIds = new Set<string>();
  const liveMachineImages = new Set<string>();
  let staleWorkers: Array<(typeof workerRows)[number]> = [];
  if (localWorkersWithMachine.length > 0) {
    const providerWorkers = await provider.listWorkers(providerConfig.appName);
    for (const worker of providerWorkers) {
      liveMachineIds.add(worker.machineId);
      if (worker.image) {
        liveMachineImages.add(worker.image);
      }
    }
    if (liveMachineImages.size > 1) {
      console.warn(
        `[scheduler] mixed machine images detected for app=${providerConfig.appName}: ${[
          ...liveMachineImages,
        ].join(", ")}`,
      );
    }
    if (liveMachineImages.size > 0 && !liveMachineImages.has(providerConfig.image)) {
      console.warn(
        `[scheduler] target image ${providerConfig.image} is not active yet for app=${providerConfig.appName}`,
      );
    }
    staleWorkers = localWorkersWithMachine.filter(
      (worker) => worker.machineId && !liveMachineIds.has(worker.machineId),
    );
    for (const worker of staleWorkers) {
      if (worker.status !== "stopped") {
        await transitionWorkerToStopped(ctx, worker, providerConfig, nowMs, false);
      }
    }
    if (staleWorkers.length > 0) {
      workerRows = await ctx.runQuery((internal.queue as any).listWorkersForScheduler, {});
    }
  }

  let spawned = 0;
  let terminated = staleWorkers.filter((worker) => worker.status !== "stopped").length;

  const dedicatedVolumeMode =
    providerConfig.volumeName.trim().length > 0 && providerConfig.volumePath.trim().length > 0;
  const unconstrainedTargetWorkers = clamp(activeConversationCount, 0, scaling.maxWorkers);
  const targetActiveWorkers = dedicatedVolumeMode
    ? Math.min(1, unconstrainedTargetWorkers)
    : unconstrainedTargetWorkers;
  if (dedicatedVolumeMode && unconstrainedTargetWorkers > 1) {
    console.warn(
      `[scheduler] dedicated volume mode enabled for ${providerConfig.volumeName}; clamping desired workers to 1`,
    );
  }
  const activeWorkers = scopedWorkerRows().filter(
    (worker) => worker.status === "active" && worker.heartbeatAt > staleHeartbeatCutoff,
  ).length;

  if (targetActiveWorkers > activeWorkers) {
    const toSpawn = Math.min(scaling.spawnStep, targetActiveWorkers - activeWorkers);
    for (let i = 0; i < toSpawn; i += 1) {
      const workerId = `afw-${nowMs}-${i}`;
      const created = await provider.spawnWorker({
        workerId,
        appName: providerConfig.appName,
        image: providerConfig.image,
        region: providerConfig.region,
        volumeName: providerConfig.volumeName,
        volumePath: providerConfig.volumePath,
        volumeSizeGb: providerConfig.volumeSizeGb,
        env: {
          ...DEFAULT_WORKER_RUNTIME_ENV,
          CONVEX_URL: convexUrl,
          WORKSPACE_ID: workspaceId,
          WORKER_ID: workerId,
          WORKER_IDLE_TIMEOUT_MS: String(scaling.idleTimeoutMs),
        },
      });
      await ctx.runMutation(internal.queue.upsertWorkerState, {
        workerId: created.workerId,
        provider: providerConfig.kind,
        status: "active",
        load: 0,
        nowMs,
        scheduledShutdownAt: nowMs + scaling.idleTimeoutMs,
        stoppedAt: undefined,
        machineId: created.machineId,
        appName: providerConfig.appName,
        region: created.region,
      });
      await scheduleIdleShutdownWatch(ctx, providerConfig, nowMs + scaling.idleTimeoutMs, nowMs);
      spawned += 1;
    }
  }

  const dueIdleTimeout = getDueIdleWorkers(scopedWorkerRows(), nowMs);
  for (const worker of dueIdleTimeout) {
    const machineIsLive = worker.machineId ? liveMachineIds.has(worker.machineId) : false;
    await transitionWorkerToStopped(
      ctx,
      worker,
      providerConfig,
      nowMs,
      machineIsLive && requiresFinalSnapshot(worker),
    );
    terminated += 1;
  }
  if (dueIdleTimeout.length > 0) {
    workerRows = await ctx.runQuery((internal.queue as any).listWorkersForScheduler, {});
  }

  let pendingFinalization = 0;
  const stoppedWorkersAwaitingTeardown = getStoppedWorkersAwaitingTeardown(
    scopedWorkerRows(),
    nowMs,
  );
  for (const worker of stoppedWorkersAwaitingTeardown) {
    if (!hasFinalSnapshotReady(worker)) {
      pendingFinalization += 1;
      continue;
    }
    const finalized = await finalizeStoppedWorkerTeardown({
      provider,
      providerConfig,
      worker,
      liveMachineIds,
    });
    if (!finalized) {
      pendingFinalization += 1;
    }
  }
  if (pendingFinalization > 0) {
    await scheduleIdleShutdownRetry(ctx, providerConfig);
  }

  await ctx.runMutation((internal.queue as any).expireOldDataSnapshots, {
    nowMs,
    limit: 100,
  });

  const currentActiveWorkers = Math.max(0, activeWorkers + spawned - terminated);
  return {
    activeWorkers: currentActiveWorkers,
    spawned,
    terminated,
  };
}

async function runEnforceIdleShutdowns(
  ctx: any,
  args: {
    flyApiToken?: string;
    nowMs?: number;
    providerConfig?: typeof DEFAULT_CONFIG.provider;
  },
) {
  const nowMs = args.nowMs ?? Date.now();
  const providerConfig = await resolveProviderConfigWithFallback(
    ctx,
    args.providerConfig,
    nowMs,
  );
  if (!providerConfig) {
    return {
      checked: 0,
      stopped: 0,
      pending: 0,
      nextCheckScheduled: false,
    };
  }
  const flyApiToken =
    args.flyApiToken ??
    (await ctx.runQuery(internal.queue.getActiveSecretPlaintext, {
      secretRef: "fly.apiToken",
    }));
  if (!flyApiToken) {
    throw new Error(
      "Missing Fly API token. Import an active 'fly.apiToken' secret or pass flyApiToken explicitly.",
    );
  }
  const provider = resolveProvider(providerConfig.kind, flyApiToken);
  let workerRows: Array<SchedulerWorkerRow> = await ctx.runQuery(
    (internal.queue as any).listWorkersForScheduler,
    {},
  );
  const scopedWorkers = () =>
    workerRows.filter(
      (worker) => worker.appName === null || worker.appName === providerConfig.appName,
    );
  const dueIdleTimeout = getDueIdleWorkers(scopedWorkers(), nowMs);
  const stoppedWorkersAwaitingTeardown = getStoppedWorkersAwaitingTeardown(
    scopedWorkers(),
    nowMs,
  );

  if (dueIdleTimeout.length === 0 && stoppedWorkersAwaitingTeardown.length === 0) {
    return {
      checked: 0,
      stopped: 0,
      pending: 0,
      nextCheckScheduled: false,
    };
  }

  const providerWorkers = await provider.listWorkers(providerConfig.appName);
  const liveMachineIds = new Set(providerWorkers.map((worker) => worker.machineId));

  for (const worker of dueIdleTimeout) {
    const machineIsLive = worker.machineId ? liveMachineIds.has(worker.machineId) : false;
    await transitionWorkerToStopped(
      ctx,
      worker,
      providerConfig,
      nowMs,
      machineIsLive && requiresFinalSnapshot(worker),
    );
  }
  if (dueIdleTimeout.length > 0) {
    workerRows = await ctx.runQuery((internal.queue as any).listWorkersForScheduler, {});
  }

  const stopped = dueIdleTimeout.length;
  let pending = 0;
  for (const worker of getStoppedWorkersAwaitingTeardown(scopedWorkers(), nowMs)) {
    if (!hasFinalSnapshotReady(worker)) {
      pending += 1;
      continue;
    }
    const finalized = await finalizeStoppedWorkerTeardown({
      provider,
      providerConfig,
      worker,
      liveMachineIds,
    });
    if (!finalized) {
      pending += 1;
    }
  }

  if (pending > 0) {
    await scheduleIdleShutdownRetry(ctx, providerConfig);
  }

  return {
    checked: dueIdleTimeout.length + stoppedWorkersAwaitingTeardown.length,
    stopped,
    pending,
    nextCheckScheduled: pending > 0,
  };
}

function getDueIdleWorkers(workerRows: Array<SchedulerWorkerRow>, nowMs: number) {
  return workerRows
    .filter(
      (worker) =>
        worker.status === "active" &&
        worker.load === 0 &&
        worker.scheduledShutdownAt !== null &&
        worker.scheduledShutdownAt <= nowMs,
    )
    .sort((a, b) => (a.scheduledShutdownAt ?? 0) - (b.scheduledShutdownAt ?? 0));
}

function getStoppedWorkersAwaitingTeardown(workerRows: Array<SchedulerWorkerRow>, nowMs: number) {
  return workerRows
    .filter(
      (worker) =>
        worker.status === "stopped" &&
        worker.scheduledShutdownAt !== null &&
        worker.scheduledShutdownAt <= nowMs,
    )
    .sort((a, b) => (a.stoppedAt ?? a.scheduledShutdownAt ?? 0) - (b.stoppedAt ?? b.scheduledShutdownAt ?? 0));
}

function requiresFinalSnapshot(worker: SchedulerWorkerRow) {
  return worker.lastClaimAt !== null;
}

function hasFinalSnapshotReady(worker: SchedulerWorkerRow) {
  return !requiresFinalSnapshot(worker) || worker.lastSnapshotId !== null;
}

async function transitionWorkerToStopped(
  ctx: any,
  worker: SchedulerWorkerRow,
  providerConfig: typeof DEFAULT_CONFIG.provider,
  nowMs: number,
  clearLastSnapshotId: boolean,
) {
  await ctx.runMutation(internal.queue.upsertWorkerState, {
    workerId: worker.workerId,
    provider: providerConfig.kind,
    status: "stopped",
    load: 0,
    nowMs,
    scheduledShutdownAt: worker.scheduledShutdownAt ?? undefined,
    stoppedAt: worker.stoppedAt ?? nowMs,
    machineId: worker.machineId ?? undefined,
    appName: providerConfig.appName,
    region: worker.region ?? providerConfig.region,
    clearLastSnapshotId,
  });
}

async function finalizeStoppedWorkerTeardown(input: {
  provider: WorkerProvider;
  providerConfig: typeof DEFAULT_CONFIG.provider;
  worker: SchedulerWorkerRow;
  liveMachineIds: Set<string>;
}) {
  const machineId = input.worker.machineId;
  const machineIsLive = machineId ? input.liveMachineIds.has(machineId) : false;
  const terminatedNow = await drainAndTerminateWorker({
    provider: input.provider,
    appName: input.providerConfig.appName,
    machineId,
    machineIsLive,
    workerId: input.worker.workerId,
  });
  if (!terminatedNow) {
    return false;
  }
  await input.provider.cleanupWorkerStorage({
    appName: input.providerConfig.appName,
    workerId: input.worker.workerId,
    machineId,
    region: input.worker.region ?? input.providerConfig.region,
    volumeName: input.providerConfig.volumeName,
  });
  return true;
}

async function drainAndTerminateWorker(input: {
  provider: WorkerProvider;
  appName: string;
  machineId: string | null;
  machineIsLive: boolean;
  workerId: string;
}): Promise<boolean> {
  if (!input.machineId || !input.machineIsLive) {
    return true;
  }
  try {
    await input.provider.cordonWorker(input.appName, input.machineId);
    await input.provider.stopWorker(input.appName, input.machineId);
    await input.provider.terminateWorker(input.appName, input.machineId);
    return true;
  } catch (error) {
    if (isSafeMissingMachineError(error)) {
      return true;
    }
    if (isRetryableTerminatePreconditionError(error)) {
      console.warn(
        `[scheduler] worker ${input.workerId} termination deferred (precondition): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    }
    throw error;
  }
}

async function scheduleIdleShutdownWatch(
  ctx: {
    scheduler: {
      runAfter: (delayMs: number, fn: unknown, args: { providerConfig: typeof DEFAULT_CONFIG.provider }) => Promise<unknown>;
    };
  },
  providerConfig: typeof DEFAULT_CONFIG.provider,
  scheduledShutdownAt: number,
  nowMs: number,
) {
  const delayMs = Math.max(0, scheduledShutdownAt - nowMs) + 1_000;
  await ctx.scheduler.runAfter(delayMs, (internal.scheduler as any).enforceIdleShutdowns, {
    providerConfig,
  });
}

async function scheduleIdleShutdownRetry(
  ctx: {
    scheduler: {
      runAfter: (delayMs: number, fn: unknown, args: { providerConfig: typeof DEFAULT_CONFIG.provider }) => Promise<unknown>;
    };
  },
  providerConfig: typeof DEFAULT_CONFIG.provider,
  delayMs = 60_000,
) {
  await ctx.scheduler.runAfter(delayMs, (internal.scheduler as any).enforceIdleShutdowns, {
    providerConfig,
  });
}

function resolveProvider(kind: string, flyApiToken: string): WorkerProvider {
  switch (kind) {
    case "fly":
      return new FlyMachinesProvider(flyApiToken);
    default:
      throw new Error(`Unsupported provider '${kind}'`);
  }
}

function ensureProviderConfig(providerConfig: typeof DEFAULT_CONFIG.provider) {
  const requiredStringFields: Array<
    "appName" | "organizationSlug" | "image" | "region" | "volumeName" | "volumePath"
  > = [
    "appName",
    "organizationSlug",
    "image",
    "region",
    "volumeName",
    "volumePath",
  ];
  for (const field of requiredStringFields) {
    if (typeof providerConfig[field] !== "string" || providerConfig[field].trim().length === 0) {
      throw new Error(
        `Missing providerConfig.${field}. Pass providerConfig explicitly when starting/reconciling workers.`,
      );
    }
  }
  if (!Number.isFinite(providerConfig.volumeSizeGb) || providerConfig.volumeSizeGb <= 0) {
    throw new Error(
      "Missing providerConfig.volumeSizeGb. Pass providerConfig explicitly when starting/reconciling workers.",
    );
  }
  return providerConfig;
}

function isMissingProviderConfigError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Missing providerConfig.");
}

async function resolveProviderConfigWithFallback(
  ctx: any,
  explicitProviderConfig: typeof DEFAULT_CONFIG.provider | undefined,
  nowMs: number,
): Promise<typeof DEFAULT_CONFIG.provider | null> {
  if (explicitProviderConfig) {
    const validated = ensureProviderConfig(explicitProviderConfig);
    await ctx.runMutation((internal.queue as any).upsertProviderRuntimeConfig, {
      providerConfig: validated,
      nowMs,
    });
    return validated;
  }

  const storedProviderConfig = await ctx.runQuery(
    (internal.queue as any).getProviderRuntimeConfig,
    {},
  );
  if (!storedProviderConfig) {
    return null;
  }

  try {
    return ensureProviderConfig(storedProviderConfig);
  } catch (error) {
    if (isMissingProviderConfigError(error)) {
      return null;
    }
    throw error;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isSafeMissingMachineError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /not found|unknown machine|does not exist|internal server error/i.test(message);
}

function isRetryableTerminatePreconditionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /failed_precondition|unable to destroy machine|not currently stopped/i.test(message);
}

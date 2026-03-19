import { v } from "convex/values";
import { internal } from "./_generated/api.js";
import { action, internalAction } from "./_generated/server.js";
import {
  DEFAULT_CONFIG,
  DEFAULT_WORKER_RUNTIME_ENV,
  providerConfigValidator,
  scalingPolicyValidator,
} from "./config.js";
import {
  FlyMachinesProvider,
  type ProviderWorker,
  type WorkerProvider,
} from "./providers/fly.js";
import {
  isWorkerClaimable,
  isWorkerDrainPending,
  isWorkerTeardownPending,
  isWorkerTerminal,
  type WorkerStatus,
} from "./workerLifecycle.js";

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
  status: WorkerStatus;
  load: number;
  heartbeatAt: number;
  lastClaimAt: number | null;
  scheduledShutdownAt: number | null;
  stoppedAt: number | null;
  lastSnapshotId: string | null;
  assignment: {
    conversationId: string;
    agentKey: string;
    leaseId: string;
    assignedAt: number;
  } | null;
  machineId: string | null;
  appName: string | null;
  region: string | null;
};

const PROVIDER_RECONCILE_GRACE_MS = 90_000;

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

  const providerConfig = await resolveProviderConfigWithFallback(
    ctx,
    args.providerConfig,
    nowMs,
  );
  if (!providerConfig) {
    // Best-effort mode: if runtime providerConfig has not been initialized yet,
    // do not fail enqueue-triggered reconcile loudly.
    return {
      activeWorkers: 0,
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
  const activeConversationIds: Array<string> = await ctx.runQuery(
    (internal.queue as any).getActiveConversationIdsForScheduler,
    { nowMs, limit: 1000 },
  );
  const activeConversationCount = activeConversationIds.length;
  const cycle = await runWorkerLifecycleCycle(ctx, {
    nowMs,
    provider,
    providerConfig,
    scaling,
    allowSpawn: true,
    convexUrl,
    workspaceId,
    activeConversationIds,
    desiredActiveWorkers: clamp(activeConversationCount, 0, scaling.maxWorkers),
  });
  if (activeConversationCount > 0 || cycle.pending > 0) {
    await scheduleReconcileRetry(ctx, providerConfig, workspaceId, scaling.reconcileIntervalMs);
  }

  await ctx.runMutation((internal.queue as any).expireOldDataSnapshots, {
    nowMs,
    limit: 100,
  });
  await ctx.runMutation((internal.queue as any).expireOldTelegramAttachments, {
    nowMs,
    limit: 100,
  });

  return {
    activeWorkers: cycle.activeWorkers,
    spawned: cycle.spawned,
    terminated: cycle.deactivated,
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
  const cycle = await runWorkerLifecycleCycle(ctx, {
    nowMs,
    provider,
    providerConfig,
    scaling: DEFAULT_CONFIG.scaling,
    allowSpawn: false,
    desiredActiveWorkers: 0,
    activeConversationIds: [],
  });

  if (cycle.pending > 0) {
    await scheduleIdleShutdownRetry(ctx, providerConfig);
  }

  return {
    checked: cycle.checked,
    stopped: cycle.deactivated,
    pending: cycle.pending,
    nextCheckScheduled: cycle.pending > 0,
  };
}

async function runWorkerLifecycleCycle(
  ctx: any,
  input: {
    nowMs: number;
    provider: WorkerProvider;
    providerConfig: typeof DEFAULT_CONFIG.provider;
    scaling: typeof DEFAULT_CONFIG.scaling;
    allowSpawn: boolean;
    desiredActiveWorkers: number;
    activeConversationIds: Array<string>;
    convexUrl?: string;
    workspaceId?: string;
  },
) {
  let workerRows: Array<SchedulerWorkerRow> = await ctx.runQuery(
    (internal.queue as any).listWorkersForScheduler,
    {},
  );
  const staleHeartbeatCutoff = input.nowMs - DEFAULT_CONFIG.lease.staleAfterMs;
  let providerWorkers: Array<ProviderWorker> = await input.provider.listWorkers(input.providerConfig.appName);
  warnOnMixedProviderImages(providerWorkers, input.providerConfig);

  let deactivated = 0;
  const providerReconcile = await reconcileWorkersAgainstProvider(ctx, {
    workerRows,
    providerWorkers,
    providerConfig: input.providerConfig,
    nowMs: input.nowMs,
    staleHeartbeatCutoff,
  });
  deactivated += providerReconcile.deactivated;
  if (providerReconcile.changed > 0) {
    workerRows = await ctx.runQuery((internal.queue as any).listWorkersForScheduler, {});
    providerWorkers = await input.provider.listWorkers(input.providerConfig.appName);
  }

  const scopedWorkerRows = filterScopedWorkers(workerRows, input.providerConfig.appName);
  let liveMachineIds = new Set(providerWorkers.map((worker) => worker.machineId));

  const idleWithoutShutdown = getIdleWorkersMissingShutdown(scopedWorkerRows);
  for (const worker of idleWithoutShutdown) {
    const scheduledShutdownAt = deriveScheduledShutdownAt(worker, input.nowMs, input.scaling.idleTimeoutMs);
    await ctx.runMutation(internal.queue.upsertWorkerState, {
      workerId: worker.workerId,
      provider: input.providerConfig.kind,
      status: "active",
      load: 0,
      nowMs: input.nowMs,
      scheduledShutdownAt,
      machineId: worker.machineId ?? undefined,
      appName: worker.appName ?? input.providerConfig.appName,
      region: worker.region ?? input.providerConfig.region,
    });
    if (scheduledShutdownAt > input.nowMs) {
      await scheduleIdleShutdownWatch(ctx, input.providerConfig, scheduledShutdownAt, input.nowMs);
    }
  }
  if (idleWithoutShutdown.length > 0) {
    workerRows = await ctx.runQuery((internal.queue as any).listWorkersForScheduler, {});
  }

  let spawned = 0;
  if (input.allowSpawn && input.desiredActiveWorkers > 0) {
    const claimableWorkers = countWorkersAvailableForActiveConversations(
      filterScopedWorkers(workerRows, input.providerConfig.appName),
      input.activeConversationIds,
      staleHeartbeatCutoff,
    );
    if (input.desiredActiveWorkers > claimableWorkers) {
      const forwardedOpenClawEnv = await ctx.runQuery(
        (internal.queue as any).getWorkerSpawnOpenClawEnv,
        {},
      );
      const toSpawn = Math.min(
        input.scaling.spawnStep,
        input.desiredActiveWorkers - claimableWorkers,
      );
      for (let index = 0; index < toSpawn; index += 1) {
        const workerId = `afw-${input.nowMs}-${index}`;
        await ctx.runMutation(internal.queue.upsertWorkerState, {
          workerId,
          provider: input.providerConfig.kind,
          status: "active",
          load: 0,
          nowMs: input.nowMs,
          scheduledShutdownAt: input.nowMs + input.scaling.idleTimeoutMs,
        });
        let created;
        try {
          created = await input.provider.spawnWorker({
            workerId,
            appName: input.providerConfig.appName,
            image: input.providerConfig.image,
            region: input.providerConfig.region,
            volumeName: input.providerConfig.volumeName,
            volumePath: input.providerConfig.volumePath,
            volumeSizeGb: input.providerConfig.volumeSizeGb,
            env: compactEnv({
              ...DEFAULT_WORKER_RUNTIME_ENV,
              ...forwardedOpenClawEnv,
              CONVEX_URL: input.convexUrl ?? "",
              WORKSPACE_ID: input.workspaceId ?? "default",
              WORKER_ID: workerId,
              WORKER_IDLE_TIMEOUT_MS: String(input.scaling.idleTimeoutMs),
            }),
          });
        } catch (error) {
          console.error(
            `[scheduler] worker spawn failed after preregistration workerId=${workerId} appName=${input.providerConfig.appName} nowMs=${input.nowMs}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          await transitionWorkerToDraining(
            ctx,
            {
              workerId,
              status: "active",
              load: 0,
              heartbeatAt: input.nowMs,
              lastClaimAt: null,
              scheduledShutdownAt: input.nowMs,
              stoppedAt: null,
              lastSnapshotId: null,
              assignment: null,
              machineId: null,
              appName: input.providerConfig.appName,
              region: input.providerConfig.region,
            },
            input.providerConfig,
            input.nowMs,
            false,
          );
          await transitionWorkerToStopping(
            ctx,
            {
              workerId,
              status: "draining",
              load: 0,
              heartbeatAt: input.nowMs,
              lastClaimAt: null,
              scheduledShutdownAt: input.nowMs,
              stoppedAt: null,
              lastSnapshotId: null,
              assignment: null,
              machineId: null,
              appName: input.providerConfig.appName,
              region: input.providerConfig.region,
            },
            input.providerConfig,
            input.nowMs,
            false,
          );
          await transitionWorkerToStopped(
            ctx,
            {
              workerId,
              status: "stopping",
              load: 0,
              heartbeatAt: input.nowMs,
              lastClaimAt: null,
              scheduledShutdownAt: input.nowMs,
              stoppedAt: input.nowMs,
              lastSnapshotId: null,
              assignment: null,
              machineId: null,
              appName: input.providerConfig.appName,
              region: input.providerConfig.region,
            },
            input.providerConfig,
            input.nowMs,
          );
          throw error;
        }
        await ctx.runMutation(internal.queue.upsertWorkerState, {
          workerId: created.workerId,
          provider: input.providerConfig.kind,
          status: "active",
          load: 0,
          nowMs: input.nowMs,
          scheduledShutdownAt: input.nowMs + input.scaling.idleTimeoutMs,
          machineId: created.machineId,
          appName: input.providerConfig.appName,
          region: created.region,
        });
        await scheduleIdleShutdownWatch(
          ctx,
          input.providerConfig,
          input.nowMs + input.scaling.idleTimeoutMs,
          input.nowMs,
        );
        spawned += 1;
      }
    }
  }
  if (spawned > 0) {
    workerRows = await ctx.runQuery((internal.queue as any).listWorkersForScheduler, {});
    providerWorkers = await input.provider.listWorkers(input.providerConfig.appName);
    liveMachineIds = new Set(providerWorkers.map((worker) => worker.machineId));
  }

  const dueIdleTimeout = getDueIdleWorkers(
    filterScopedWorkers(workerRows, input.providerConfig.appName),
    input.nowMs,
  );
  for (const worker of dueIdleTimeout) {
    await transitionWorkerToDraining(
      ctx,
      worker,
      input.providerConfig,
      input.nowMs,
      requiresFinalSnapshot(worker),
    );
    deactivated += 1;
  }
  if (dueIdleTimeout.length > 0) {
    workerRows = await ctx.runQuery((internal.queue as any).listWorkersForScheduler, {});
  }

  const drainingReady = getDrainingWorkersReadyForTeardown(
    filterScopedWorkers(workerRows, input.providerConfig.appName),
  );
  for (const worker of drainingReady) {
    await transitionWorkerToStopping(ctx, worker, input.providerConfig, input.nowMs, false);
  }
  if (drainingReady.length > 0) {
    workerRows = await ctx.runQuery((internal.queue as any).listWorkersForScheduler, {});
  }

  let pending = 0;
  const drainingWorkers = getDrainingWorkersAwaitingSnapshot(
    filterScopedWorkers(workerRows, input.providerConfig.appName),
  );
  pending += drainingWorkers.length;

  for (const worker of getWorkersAwaitingTeardown(
    filterScopedWorkers(workerRows, input.providerConfig.appName),
  )) {
    const finalized = await finalizeWorkerTeardown({
      provider: input.provider,
      providerConfig: input.providerConfig,
      worker,
      liveMachineIds,
    });
    if (!finalized) {
      pending += 1;
      continue;
    }
    await transitionWorkerToStopped(ctx, worker, input.providerConfig, input.nowMs);
  }

  const currentWorkerRows: Array<SchedulerWorkerRow> = await ctx.runQuery(
    (internal.queue as any).listWorkersForScheduler,
    {},
  );
  const activeWorkers = filterScopedWorkers(currentWorkerRows, input.providerConfig.appName).filter(
    (worker) => isWorkerClaimable(worker.status) && worker.heartbeatAt > staleHeartbeatCutoff,
  ).length;

  return {
    activeWorkers,
    spawned,
    deactivated,
    pending,
    checked:
      dueIdleTimeout.length +
      drainingWorkers.length +
      getWorkersAwaitingTeardown(filterScopedWorkers(currentWorkerRows, input.providerConfig.appName))
        .length,
  };
}

function getDueIdleWorkers(workerRows: Array<SchedulerWorkerRow>, nowMs: number) {
  return workerRows
    .filter(
      (worker) =>
        isWorkerClaimable(worker.status) &&
        worker.load === 0 &&
        worker.scheduledShutdownAt !== null &&
        worker.scheduledShutdownAt <= nowMs,
    )
    .sort((a, b) => (a.scheduledShutdownAt ?? 0) - (b.scheduledShutdownAt ?? 0));
}

function getIdleWorkersMissingShutdown(workerRows: Array<SchedulerWorkerRow>) {
  return workerRows
    .filter(
      (worker) =>
        isWorkerClaimable(worker.status) &&
        worker.load === 0 &&
        worker.scheduledShutdownAt === null,
    )
    .sort((a, b) => (a.lastClaimAt ?? a.heartbeatAt) - (b.lastClaimAt ?? b.heartbeatAt));
}

function getDrainingWorkersReadyForTeardown(workerRows: Array<SchedulerWorkerRow>) {
  return workerRows
    .filter((worker) => isWorkerDrainPending(worker.status) && hasFinalSnapshotReady(worker))
    .sort((a, b) => (a.scheduledShutdownAt ?? 0) - (b.scheduledShutdownAt ?? 0));
}

function getDrainingWorkersAwaitingSnapshot(workerRows: Array<SchedulerWorkerRow>) {
  return workerRows
    .filter((worker) => isWorkerDrainPending(worker.status) && !hasFinalSnapshotReady(worker))
    .sort((a, b) => (a.scheduledShutdownAt ?? 0) - (b.scheduledShutdownAt ?? 0));
}

function getWorkersAwaitingTeardown(workerRows: Array<SchedulerWorkerRow>) {
  return workerRows
    .filter(
      (worker) =>
        isWorkerTeardownPending(worker.status) &&
        worker.scheduledShutdownAt !== null,
    )
    .sort((a, b) => (a.stoppedAt ?? a.scheduledShutdownAt ?? 0) - (b.stoppedAt ?? b.scheduledShutdownAt ?? 0));
}

function requiresFinalSnapshot(worker: SchedulerWorkerRow) {
  return worker.lastClaimAt !== null;
}

function hasFinalSnapshotReady(worker: SchedulerWorkerRow) {
  return !requiresFinalSnapshot(worker) || worker.lastSnapshotId !== null;
}

async function transitionWorkerToDraining(
  ctx: any,
  worker: SchedulerWorkerRow,
  providerConfig: typeof DEFAULT_CONFIG.provider,
  nowMs: number,
  clearLastSnapshotId: boolean,
) {
  await ctx.runMutation(internal.queue.upsertWorkerState, {
    workerId: worker.workerId,
    provider: providerConfig.kind,
    status: "draining",
    load: 0,
    nowMs,
    scheduledShutdownAt: worker.scheduledShutdownAt ?? nowMs,
    machineId: worker.machineId ?? undefined,
    appName: worker.appName ?? providerConfig.appName,
    region: worker.region ?? providerConfig.region,
    clearLastSnapshotId,
  });
}

async function transitionWorkerToStopping(
  ctx: any,
  worker: SchedulerWorkerRow,
  providerConfig: typeof DEFAULT_CONFIG.provider,
  nowMs: number,
  clearLastSnapshotId: boolean,
) {
  await ctx.runMutation(internal.queue.upsertWorkerState, {
    workerId: worker.workerId,
    provider: providerConfig.kind,
    status: "stopping",
    load: 0,
    nowMs,
    scheduledShutdownAt: worker.scheduledShutdownAt ?? nowMs,
    stoppedAt: worker.stoppedAt ?? nowMs,
    machineId: worker.machineId ?? undefined,
    appName: worker.appName ?? providerConfig.appName,
    region: worker.region ?? providerConfig.region,
    clearLastSnapshotId,
  });
}

async function transitionWorkerToStopped(
  ctx: any,
  worker: SchedulerWorkerRow,
  providerConfig: typeof DEFAULT_CONFIG.provider,
  nowMs: number,
) {
  await ctx.runMutation(internal.queue.upsertWorkerState, {
    workerId: worker.workerId,
    provider: providerConfig.kind,
    status: "stopped",
    load: 0,
    nowMs,
    scheduledShutdownAt: worker.scheduledShutdownAt ?? nowMs,
    stoppedAt: worker.stoppedAt ?? nowMs,
    clearMachineRef: true,
  });
}

async function finalizeWorkerTeardown(input: {
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

async function scheduleReconcileRetry(
  ctx: {
    scheduler: {
      runAfter: (
        delayMs: number,
        fn: unknown,
        args: { providerConfig: typeof DEFAULT_CONFIG.provider; workspaceId: string },
      ) => Promise<unknown>;
    };
  },
  providerConfig: typeof DEFAULT_CONFIG.provider,
  workspaceId: string,
  delayMs: number,
) {
  await ctx.scheduler.runAfter(delayMs, (internal.scheduler as any).reconcileWorkerPoolInternal, {
    providerConfig,
    workspaceId,
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

function compactEnv(
  env: Record<string, string | null | undefined>,
): Record<string, string> {
  const compacted: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (!value || value.trim().length === 0) {
      continue;
    }
    compacted[key] = value;
  }
  return compacted;
}

function filterScopedWorkers(workerRows: Array<SchedulerWorkerRow>, appName: string) {
  return workerRows.filter((worker) => worker.appName === null || worker.appName === appName);
}

function countWorkersAvailableForActiveConversations(
  workerRows: Array<SchedulerWorkerRow>,
  activeConversationIds: Array<string>,
  staleHeartbeatCutoff: number,
) {
  const activeConversationSet = new Set(activeConversationIds);
  const assignedConversationKeys = new Set<string>();
  let unassignedWorkers = 0;
  for (const worker of workerRows) {
    if (!isWorkerClaimable(worker.status) || worker.heartbeatAt <= staleHeartbeatCutoff) {
      continue;
    }
    if (!worker.assignment) {
      unassignedWorkers += 1;
      continue;
    }
    if (activeConversationSet.has(worker.assignment.conversationId)) {
      assignedConversationKeys.add(
        `${worker.assignment.agentKey}::${worker.assignment.conversationId}`,
      );
    }
  }
  return unassignedWorkers + assignedConversationKeys.size;
}

function deriveScheduledShutdownAt(
  worker: SchedulerWorkerRow,
  nowMs: number,
  idleTimeoutMs: number,
) {
  const baseMs = worker.lastClaimAt ?? worker.heartbeatAt ?? nowMs;
  return baseMs + idleTimeoutMs;
}

async function reconcileWorkersAgainstProvider(
  ctx: any,
  input: {
    workerRows: Array<SchedulerWorkerRow>;
    providerWorkers: Array<ProviderWorker>;
    providerConfig: typeof DEFAULT_CONFIG.provider;
    nowMs: number;
    staleHeartbeatCutoff: number;
  },
) {
  const providerWorkersByMachineId = new Map(
    input.providerWorkers.map((worker) => [worker.machineId, worker] as const),
  );
  let changed = 0;
  let deactivated = 0;
  for (const worker of filterScopedWorkers(input.workerRows, input.providerConfig.appName)) {
    const machineId = worker.machineId;
    if (machineId) {
      const providerWorker = providerWorkersByMachineId.get(machineId);
      if (!providerWorker || providerWorker.status !== "active") {
        const withinGraceWindow = isWithinProviderReconcileGraceWindow(worker, input.nowMs);
        if (withinGraceWindow && (!providerWorker || isFlyTransientState(providerWorker.rawState))) {
          console.warn(
            `[scheduler] provider reconcile grace workerId=${worker.workerId} machineId=${machineId} dbStatus=${worker.status} providerStatus=${providerWorker?.status ?? "missing"} rawFlyState=${providerWorker?.rawState ?? "missing"} appName=${input.providerConfig.appName} heartbeatAt=${worker.heartbeatAt} nowMs=${input.nowMs} graceMs=${PROVIDER_RECONCILE_GRACE_MS}`,
          );
          continue;
        }
        if (!isWorkerTerminal(worker.status)) {
          console.warn(
            `[scheduler] provider reconcile deactivating workerId=${worker.workerId} machineId=${machineId} dbStatus=${worker.status} providerStatus=${providerWorker?.status ?? "missing"} rawFlyState=${providerWorker?.rawState ?? "missing"} appName=${input.providerConfig.appName} scheduledShutdownAt=${worker.scheduledShutdownAt ?? "missing"} heartbeatAt=${worker.heartbeatAt} nowMs=${input.nowMs}`,
          );
          if (isWorkerClaimable(worker.status)) {
            deactivated += 1;
            await transitionWorkerToDraining(
              ctx,
              {
                ...worker,
                scheduledShutdownAt: worker.scheduledShutdownAt ?? input.nowMs,
              },
              input.providerConfig,
              input.nowMs,
              false,
            );
          } else {
            await transitionWorkerToStopping(
              ctx,
              {
                ...worker,
                scheduledShutdownAt: worker.scheduledShutdownAt ?? input.nowMs,
              },
              input.providerConfig,
              input.nowMs,
              false,
            );
          }
          changed += 1;
        }
        continue;
      }
    }

    if (
      isWorkerClaimable(worker.status) &&
      worker.heartbeatAt <= input.staleHeartbeatCutoff
    ) {
      console.warn(
        `[scheduler] stale heartbeat deactivating workerId=${worker.workerId} machineId=${worker.machineId ?? "missing"} dbStatus=${worker.status} heartbeatAt=${worker.heartbeatAt} staleHeartbeatCutoff=${input.staleHeartbeatCutoff} appName=${input.providerConfig.appName} nowMs=${input.nowMs}`,
      );
      deactivated += 1;
      await transitionWorkerToDraining(
        ctx,
        {
          ...worker,
          scheduledShutdownAt: worker.scheduledShutdownAt ?? input.nowMs,
        },
        input.providerConfig,
        input.nowMs,
        false,
      );
      changed += 1;
    }
  }
  return { changed, deactivated };
}

function warnOnMixedProviderImages(
  providerWorkers: Array<ProviderWorker>,
  providerConfig: typeof DEFAULT_CONFIG.provider,
) {
  const liveMachineImages = new Set(
    providerWorkers.map((worker) => worker.image).filter((image): image is string => !!image),
  );
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
}

function isWithinProviderReconcileGraceWindow(worker: SchedulerWorkerRow, nowMs: number) {
  return nowMs - worker.heartbeatAt <= PROVIDER_RECONCILE_GRACE_MS;
}

function isFlyTransientState(rawState: string | undefined) {
  return new Set([
    "creating",
    "created",
    "starting",
    "started",
    "restarting",
    "updating",
    "replacing",
  ]).has(rawState ?? "");
}

function isSafeMissingMachineError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /not found|unknown machine|does not exist|internal server error/i.test(message);
}

function isRetryableTerminatePreconditionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /failed_precondition|unable to destroy machine|not currently stopped/i.test(message);
}

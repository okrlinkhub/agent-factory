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

const reconcileWorkerPoolReturns = v.object({
  activeWorkers: v.number(),
  spawned: v.number(),
  terminated: v.number(),
});

type ReconcileWorkerPoolArgs = {
  flyApiToken?: string;
  convexUrl?: string;
  workspaceId?: string;
  nowMs?: number;
  scalingPolicy?: typeof DEFAULT_CONFIG.scaling;
  providerConfig?: typeof DEFAULT_CONFIG.provider;
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

async function runReconcileWorkerPool(
  ctx: any,
  args: ReconcileWorkerPoolArgs,
) {
  const nowMs = args.nowMs ?? Date.now();
  const scaling = args.scalingPolicy ?? DEFAULT_CONFIG.scaling;
  const providerConfig = args.providerConfig ?? DEFAULT_CONFIG.provider;
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

  const readyConversationCount: number = await ctx.runQuery(
    (internal.queue as any).getReadyConversationCountForScheduler,
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
    machineId: string | null;
    appName: string | null;
    region: string | null;
  }> = await ctx.runQuery((internal.queue as any).listWorkersForScheduler, {});

  const localWorkersWithMachine = workerRows.filter(
    (worker) =>
      worker.machineId &&
      (worker.appName === null || worker.appName === providerConfig.appName),
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
      await ctx.runMutation(internal.queue.upsertWorkerState, {
        workerId: worker.workerId,
        provider: providerConfig.kind,
        status: "stopped",
        load: 0,
        nowMs,
        scheduledShutdownAt: worker.scheduledShutdownAt ?? undefined,
        stoppedAt: nowMs,
        machineId: worker.machineId ?? undefined,
        appName: providerConfig.appName,
        region: providerConfig.region,
      });
    }
    if (staleWorkers.length > 0) {
      workerRows = await ctx.runQuery((internal.queue as any).listWorkersForScheduler, {});
    }
  }

  let spawned = 0;
  let terminated = staleWorkers.length;

  const dedicatedVolumeMode =
    providerConfig.volumeName.trim().length > 0 && providerConfig.volumePath.trim().length > 0;
  const unconstrainedTargetWorkers = clamp(readyConversationCount, 0, scaling.maxWorkers);
  const targetActiveWorkers = dedicatedVolumeMode
    ? Math.min(1, unconstrainedTargetWorkers)
    : unconstrainedTargetWorkers;
  if (dedicatedVolumeMode && unconstrainedTargetWorkers > 1) {
    console.warn(
      `[scheduler] dedicated volume mode enabled for ${providerConfig.volumeName}; clamping desired workers to 1`,
    );
  }
  const activeWorkers = workerRows.filter(
    (worker) => worker.status === "active",
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
      spawned += 1;
    }
  }

  const dueIdleTimeout = workerRows
    .filter(
      (worker) =>
        worker.status === "active" &&
        worker.load === 0 &&
        worker.scheduledShutdownAt !== null &&
        worker.scheduledShutdownAt <= nowMs,
    )
    .sort((a, b) => (a.scheduledShutdownAt ?? 0) - (b.scheduledShutdownAt ?? 0));
  for (const worker of dueIdleTimeout) {
    const machineId = worker.machineId;
    const machineIsLive = machineId ? liveMachineIds.has(machineId) : false;
    const terminatedNow = await drainAndTerminateWorker({
      provider,
      appName: providerConfig.appName,
      machineId,
      machineIsLive,
      workerId: worker.workerId,
    });
    if (!terminatedNow) {
      // Keep worker active so the next reconcile can retry termination.
      continue;
    }
    await ctx.runMutation(internal.queue.upsertWorkerState, {
      workerId: worker.workerId,
      provider: providerConfig.kind,
      status: "stopped",
      load: 0,
      nowMs,
      scheduledShutdownAt: worker.scheduledShutdownAt ?? undefined,
      stoppedAt: nowMs,
      machineId: machineId ?? undefined,
      appName: providerConfig.appName,
      region: providerConfig.region,
    });
    terminated += 1;
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

function resolveProvider(kind: string, flyApiToken: string): WorkerProvider {
  switch (kind) {
    case "fly":
      return new FlyMachinesProvider(flyApiToken);
    default:
      throw new Error(`Unsupported provider '${kind}'`);
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

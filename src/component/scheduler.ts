import { v } from "convex/values";
import { api, internal } from "./_generated/api.js";
import { action, internalAction } from "./_generated/server.js";
import {
  DEFAULT_CONFIG,
  DEFAULT_WORKER_RUNTIME_ENV,
  providerConfigValidator,
  scalingPolicyValidator,
} from "./config.js";
import { FlyMachinesProvider, type WorkerProvider } from "./providers/fly.js";

export const reconcileWorkerPool = action({
  args: {
    flyApiToken: v.optional(v.string()),
    convexUrl: v.optional(v.string()),
    workspaceId: v.optional(v.string()),
    nowMs: v.optional(v.number()),
    scalingPolicy: v.optional(scalingPolicyValidator),
    providerConfig: v.optional(providerConfigValidator),
  },
  returns: v.object({
    desiredWorkers: v.number(),
    activeWorkers: v.number(),
    spawned: v.number(),
    terminated: v.number(),
  }),
  handler: async (ctx, args) => {
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

    const queueStats: {
      queuedReady: number;
      processing: number;
      deadLetter: number;
    } = await ctx.runQuery(api.queue.getQueueStats, { nowMs });
    let workerRows: Array<{
      workerId: string;
      status: "starting" | "active" | "idle" | "draining" | "stopped" | "failed";
      load: number;
      heartbeatAt: number;
      lastClaimAt: number | null;
      scheduledShutdownAt: number | null;
      drainRequestedAt: number | null;
      drainDeadlineAt: number | null;
      drainSnapshotAckAt: number | null;
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
          scheduledShutdownAt: nowMs,
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

    for (const worker of workerRows.filter((row) => row.status === "draining")) {
      const machineId = worker.machineId;
      const machineIsLive = machineId ? liveMachineIds.has(machineId) : false;
      const snapshotAcked =
        worker.drainRequestedAt !== null &&
        (worker.drainSnapshotAckAt ?? 0) >= worker.drainRequestedAt;
      if (!snapshotAcked) continue;
      if (machineId && machineIsLive) {
        try {
          await provider.cordonWorker(providerConfig.appName, machineId);
          await provider.terminateWorker(providerConfig.appName, machineId);
        } catch (error) {
          if (!isSafeMissingMachineError(error)) {
            throw error;
          }
        }
      }
      await ctx.runMutation(internal.queue.upsertWorkerState, {
        workerId: worker.workerId,
        provider: providerConfig.kind,
        status: "stopped",
        load: 0,
        nowMs,
        scheduledShutdownAt: nowMs,
        machineId: machineId ?? undefined,
        appName: providerConfig.appName,
        region: providerConfig.region,
      });
      terminated += 1;
    }
    workerRows = await ctx.runQuery((internal.queue as any).listWorkersForScheduler, {});

    const computedDesired = Math.ceil(
      queueStats.queuedReady / Math.max(1, scaling.queuePerWorkerTarget),
    );
    const dedicatedVolumeMode =
      providerConfig.volumeName.trim().length > 0 && providerConfig.volumePath.trim().length > 0;
    const unconstrainedDesiredWorkers = clamp(
      computedDesired,
      scaling.minWorkers,
      scaling.maxWorkers,
    );
    const desiredWorkers = dedicatedVolumeMode
      ? Math.min(1, unconstrainedDesiredWorkers)
      : unconstrainedDesiredWorkers;
    if (dedicatedVolumeMode && unconstrainedDesiredWorkers > 1) {
      console.warn(
        `[scheduler] dedicated volume mode enabled for ${providerConfig.volumeName}; clamping desired workers to 1`,
      );
    }
    const activeWorkers = workerRows.filter(
      (worker) =>
        worker.status === "starting" ||
        worker.status === "active" ||
        worker.status === "idle" ||
        worker.status === "draining",
    ).length;

    if (desiredWorkers > activeWorkers) {
      const toSpawn = Math.min(scaling.spawnStep, desiredWorkers - activeWorkers);
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
          status: "starting",
          load: 0,
          nowMs,
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
          (worker.status === "active" || worker.status === "idle") &&
          worker.load === 0 &&
          worker.scheduledShutdownAt !== null &&
          worker.scheduledShutdownAt <= nowMs,
      )
      .sort((a, b) => (a.scheduledShutdownAt ?? 0) - (b.scheduledShutdownAt ?? 0));
    for (const worker of dueIdleTimeout) {
      await ctx.runMutation((internal.queue as any).requestWorkerDrain, {
        workerId: worker.workerId,
        nowMs,
        timeoutMs: 60_000,
      });
    }

    if (desiredWorkers < activeWorkers) {
      const toDrain = Math.min(scaling.drainStep, activeWorkers - desiredWorkers);
      const idleFirst = workerRows
        .filter((worker) => worker.status === "idle" || worker.load === 0)
        .sort((a, b) => a.heartbeatAt - b.heartbeatAt)
        .slice(0, toDrain);

      for (const worker of idleFirst) {
        await ctx.runMutation((internal.queue as any).requestWorkerDrain, {
          workerId: worker.workerId,
          nowMs,
          timeoutMs: 60_000,
        });
      }
    }

    await ctx.runMutation((internal.queue as any).expireOldDataSnapshots, {
      nowMs,
      limit: 100,
    });

    return {
      desiredWorkers,
      activeWorkers,
      spawned,
      terminated,
    };
  },
});

export const rebuildStaleHydrationSnapshots = internalAction({
  args: {
    nowMs: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    rebuilt: v.number(),
  }),
  handler: async (ctx, args) => {
    const targets: Array<{ workspaceId: string; agentKey: string }> =
      await ctx.runQuery(internal.queue.listHydrationRebuildTargets, {
      nowMs: args.nowMs,
      limit: args.limit,
    });
    let rebuilt = 0;
    for (const target of targets) {
      await ctx.runMutation(internal.queue.prepareHydrationSnapshot, {
        workspaceId: target.workspaceId,
        agentKey: target.agentKey,
        nowMs: args.nowMs,
      });
      rebuilt += 1;
    }
    return { rebuilt };
  },
});

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

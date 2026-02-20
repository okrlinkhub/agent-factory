import { v } from "convex/values";
import { api, internal } from "./_generated/api.js";
import { action, internalAction } from "./_generated/server.js";
import {
  DEFAULT_CONFIG,
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
    let workerStats: {
      activeCount: number;
      idleCount: number;
      workers: Array<{
        workerId: string;
        status: "starting" | "active" | "idle" | "draining" | "stopped" | "failed";
        load: number;
        heartbeatAt: number;
        machineId: string | null;
        appName: string | null;
      }>;
    } = await ctx.runQuery(api.queue.getWorkerStats, {});

    const localWorkersWithMachine = workerStats.workers.filter(
      (worker) =>
        worker.machineId &&
        (worker.appName === null || worker.appName === providerConfig.appName),
    );
    const liveMachineIds = new Set<string>();
    let staleWorkers: Array<(typeof workerStats.workers)[number]> = [];
    if (localWorkersWithMachine.length > 0) {
      const providerWorkers = await provider.listWorkers(providerConfig.appName);
      for (const worker of providerWorkers) {
        liveMachineIds.add(worker.machineId);
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
        workerStats = await ctx.runQuery(api.queue.getWorkerStats, {});
      }
    }

    const computedDesired = Math.ceil(
      queueStats.queuedReady / Math.max(1, scaling.queuePerWorkerTarget),
    );
    const desiredWorkers = clamp(
      computedDesired,
      scaling.minWorkers,
      scaling.maxWorkers,
    );
    const activeWorkers = workerStats.activeCount;

    let spawned = 0;
    let terminated = staleWorkers.length;

    if (desiredWorkers > activeWorkers) {
      const toSpawn = Math.min(scaling.spawnStep, desiredWorkers - activeWorkers);
      for (let i = 0; i < toSpawn; i += 1) {
        const workerId = `afw-${nowMs}-${i}`;
        const created = await provider.spawnWorker({
          workerId,
          appName: providerConfig.appName,
          image: providerConfig.image,
          region: providerConfig.region,
          env: {
            CONVEX_URL: convexUrl,
            WORKSPACE_ID: workspaceId,
            WORKER_ID: workerId,
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
    } else if (desiredWorkers < activeWorkers) {
      const toDrain = Math.min(scaling.drainStep, activeWorkers - desiredWorkers);
      const idleFirst = workerStats.workers
        .filter((worker) => worker.status === "idle" || worker.load === 0)
        .sort((a, b) => a.heartbeatAt - b.heartbeatAt)
        .slice(0, toDrain);

      for (const worker of idleFirst) {
        const machineId = worker.machineId;
        const machineIsLive = machineId ? liveMachineIds.has(machineId) : false;
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
    }

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

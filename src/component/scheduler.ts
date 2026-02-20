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
    flyApiToken: v.string(),
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
    const provider = resolveProvider(providerConfig.kind, args.flyApiToken);

    const queueStats: {
      queuedReady: number;
      processing: number;
      deadLetter: number;
    } = await ctx.runQuery(api.queue.getQueueStats, { nowMs });
    const workerStats: {
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
    let terminated = 0;

    if (desiredWorkers > activeWorkers) {
      const toSpawn = Math.min(scaling.spawnStep, desiredWorkers - activeWorkers);
      for (let i = 0; i < toSpawn; i += 1) {
        const workerId = `afw-${nowMs}-${i}`;
        const created = await provider.spawnWorker({
          workerId,
          appName: providerConfig.appName,
          image: providerConfig.image,
          region: providerConfig.region,
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
        if (worker.machineId) {
          await provider.cordonWorker(providerConfig.appName, worker.machineId);
          await provider.terminateWorker(providerConfig.appName, worker.machineId);
        }
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

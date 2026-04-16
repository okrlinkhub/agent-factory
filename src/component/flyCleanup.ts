import { v } from "convex/values";
import { api, internal } from "./_generated/api.js";
import { action } from "./_generated/server.js";
import type { ActionCtx } from "./_generated/server.js";
import { DEFAULT_CONFIG, providerConfigValidator } from "./config.js";

const DEFAULT_MACHINE_CONCURRENCY = 6;
const DEFAULT_VOLUME_CONCURRENCY = 16;

const cleanupReportValidator = v.object({
  appName: v.string(),
  machinesFound: v.number(),
  machinesDeleted: v.number(),
  machinesRemaining: v.number(),
  machineIdsDeleted: v.array(v.string()),
  machineIdsRemaining: v.array(v.string()),
  volumesFound: v.number(),
  volumesDeleted: v.number(),
  volumesRemaining: v.number(),
  volumeIdsDeleted: v.array(v.string()),
  volumeIdsRemaining: v.array(v.string()),
  warnings: v.array(v.string()),
  errors: v.array(v.string()),
});

type CleanupReport = {
  appName: string;
  machinesFound: number;
  machinesDeleted: number;
  machinesRemaining: number;
  machineIdsDeleted: Array<string>;
  machineIdsRemaining: Array<string>;
  volumesFound: number;
  volumesDeleted: number;
  volumesRemaining: number;
  volumeIdsDeleted: Array<string>;
  volumeIdsRemaining: Array<string>;
  warnings: Array<string>;
  errors: Array<string>;
};

type ProviderConfig = typeof DEFAULT_CONFIG.provider;

type FlyMachine = {
  id: string;
  name?: string;
};

type FlyVolume = {
  id: string;
  name?: string;
};

type MachineCleanupResult = {
  machineId: string;
  deleted: boolean;
  warnings: Array<string>;
  error: string | null;
};

type VolumeCleanupResult = {
  volumeId: string;
  deleted: boolean;
  warnings: Array<string>;
  error: string | null;
};

export const runFlyCleanup = action({
  args: {
    flyApiToken: v.optional(v.string()),
    machineConcurrency: v.optional(v.number()),
    providerConfig: v.optional(providerConfigValidator),
    volumeConcurrency: v.optional(v.number()),
  },
  returns: cleanupReportValidator,
  handler: async (ctx, args): Promise<CleanupReport> => {
    const providerConfig = await resolveProviderConfig(ctx, args.providerConfig);
    if (providerConfig.kind !== "fly") {
      throw new Error("Fly cleanup requires a Fly provider configuration.");
    }

    const appName = providerConfig.appName.trim();
    if (appName.length === 0) {
      throw new Error("Fly cleanup requires a non-empty Fly app name.");
    }

    const flyApiToken = await resolveFlyApiToken(ctx, args.flyApiToken);
    const client = new FlyApiClient(flyApiToken);
    const machineConcurrency = normalizeConcurrency(
      args.machineConcurrency,
      DEFAULT_MACHINE_CONCURRENCY,
    );
    const volumeConcurrency = normalizeConcurrency(
      args.volumeConcurrency,
      DEFAULT_VOLUME_CONCURRENCY,
    );

    await client.verifyAppAccess(appName);

    const warnings: Array<string> = [];
    const errors: Array<string> = [];

    const initialMachines = await client.listMachines(appName);
    const machineResults = await runWithConcurrency(
      initialMachines,
      machineConcurrency,
      async (machine) => cleanupMachine(client, appName, machine),
    );
    for (const result of machineResults) {
      warnings.push(...result.warnings);
      if (result.error) {
        errors.push(result.error);
      }
    }

    const remainingMachines = await client.listMachines(appName);
    if (remainingMachines.length > 0) {
      warnings.push(
        `Fly cleanup left ${remainingMachines.length} machine(s) after verification: ${remainingMachines
          .map((machine) => machine.id)
          .join(", ")}`,
      );
    }

    const initialVolumes = await client.listVolumes(appName);
    const volumeResults = await runWithConcurrency(
      initialVolumes,
      volumeConcurrency,
      async (volume) => cleanupVolume(client, appName, volume),
    );
    for (const result of volumeResults) {
      warnings.push(...result.warnings);
      if (result.error) {
        errors.push(result.error);
      }
    }

    const remainingVolumes = await client.listVolumes(appName);
    if (remainingVolumes.length > 0) {
      warnings.push(
        `Fly cleanup left ${remainingVolumes.length} volume(s) after verification: ${remainingVolumes
          .map((volume) => volume.id)
          .join(", ")}`,
      );
    }

    return {
      appName,
      machinesFound: initialMachines.length,
      machinesDeleted: machineResults.filter((result) => result.deleted).length,
      machinesRemaining: remainingMachines.length,
      machineIdsDeleted: machineResults
        .filter((result) => result.deleted)
        .map((result) => result.machineId),
      machineIdsRemaining: remainingMachines.map((machine) => machine.id),
      volumesFound: initialVolumes.length,
      volumesDeleted: volumeResults.filter((result) => result.deleted).length,
      volumesRemaining: remainingVolumes.length,
      volumeIdsDeleted: volumeResults
        .filter((result) => result.deleted)
        .map((result) => result.volumeId),
      volumeIdsRemaining: remainingVolumes.map((volume) => volume.id),
      warnings,
      errors,
    };
  },
});

async function resolveProviderConfig(
  ctx: Pick<ActionCtx, "runQuery">,
  providerConfigOverride: ProviderConfig | undefined,
): Promise<ProviderConfig> {
  if (providerConfigOverride) {
    return providerConfigOverride;
  }
  const runtimeConfig = await ctx.runQuery(api.queue.providerRuntimeConfig, {});
  return runtimeConfig ?? DEFAULT_CONFIG.provider;
}

async function resolveFlyApiToken(
  ctx: Pick<ActionCtx, "runQuery">,
  flyApiTokenOverride: string | undefined,
): Promise<string> {
  const inlineToken = flyApiTokenOverride?.trim();
  if (inlineToken) {
    return inlineToken;
  }
  const storedToken = await ctx.runQuery(internal.queue.getActiveSecretPlaintext, {
    secretRef: "fly.apiToken",
  });
  const normalized = storedToken?.trim();
  if (!normalized) {
    throw new Error("Missing active 'fly.apiToken' secret. Import it before running Fly cleanup.");
  }
  return normalized;
}

async function cleanupMachine(
  client: FlyApiClient,
  appName: string,
  machine: FlyMachine,
): Promise<MachineCleanupResult> {
  const warnings: Array<string> = [];

  try {
    await client.cordonMachine(appName, machine.id);
  } catch (error) {
    if (isFlyNotFoundError(error)) {
      return { machineId: machine.id, deleted: true, warnings, error: null };
    }
    warnings.push(`Machine ${machine.id}: cordon warning (${describeError(error)})`);
  }

  try {
    await client.stopMachine(appName, machine.id);
  } catch (error) {
    if (isFlyNotFoundError(error)) {
      return { machineId: machine.id, deleted: true, warnings, error: null };
    }
    warnings.push(`Machine ${machine.id}: stop warning (${describeError(error)})`);
  }

  try {
    await client.deleteMachine(appName, machine.id);
    return { machineId: machine.id, deleted: true, warnings, error: null };
  } catch (error) {
    if (isFlyNotFoundError(error)) {
      return { machineId: machine.id, deleted: true, warnings, error: null };
    }
    return {
      machineId: machine.id,
      deleted: false,
      warnings,
      error: `Machine ${machine.id}: destroy failed (${describeError(error)})`,
    };
  }
}

async function cleanupVolume(
  client: FlyApiClient,
  appName: string,
  volume: FlyVolume,
): Promise<VolumeCleanupResult> {
  try {
    await client.deleteVolume(appName, volume.id);
    return { volumeId: volume.id, deleted: true, warnings: [], error: null };
  } catch (error) {
    if (isFlyNotFoundError(error)) {
      return { volumeId: volume.id, deleted: true, warnings: [], error: null };
    }
    return {
      volumeId: volume.id,
      deleted: false,
      warnings: [],
      error: `Volume ${volume.id}: destroy failed (${describeError(error)})`,
    };
  }
}

async function runWithConcurrency<TInput, TOutput>(
  items: Array<TInput>,
  concurrency: number,
  worker: (item: TInput, index: number) => Promise<TOutput>,
): Promise<Array<TOutput>> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<TOutput>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await worker(items[currentIndex], currentIndex);
      }
    }),
  );

  return results;
}

function normalizeConcurrency(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.floor(value));
}

class FlyApiClient {
  constructor(private readonly apiToken: string) {}

  async verifyAppAccess(appName: string): Promise<void> {
    await this.request<void>({
      method: "GET",
      path: `/apps/${encodeURIComponent(appName)}`,
    });
  }

  async listMachines(appName: string): Promise<Array<FlyMachine>> {
    return await this.request<Array<FlyMachine>>({
      method: "GET",
      path: `/apps/${encodeURIComponent(appName)}/machines`,
    });
  }

  async listVolumes(appName: string): Promise<Array<FlyVolume>> {
    return await this.request<Array<FlyVolume>>({
      method: "GET",
      path: `/apps/${encodeURIComponent(appName)}/volumes`,
    });
  }

  async cordonMachine(appName: string, machineId: string): Promise<void> {
    await this.request<void>({
      method: "POST",
      path: `/apps/${encodeURIComponent(appName)}/machines/${encodeURIComponent(machineId)}/cordon`,
    });
  }

  async stopMachine(appName: string, machineId: string): Promise<void> {
    await this.request<void>({
      method: "POST",
      path: `/apps/${encodeURIComponent(appName)}/machines/${encodeURIComponent(machineId)}/stop`,
    });
  }

  async deleteMachine(appName: string, machineId: string): Promise<void> {
    await this.request<void>({
      method: "DELETE",
      path: `/apps/${encodeURIComponent(appName)}/machines/${encodeURIComponent(machineId)}`,
    });
  }

  async deleteVolume(appName: string, volumeId: string): Promise<void> {
    await this.request<void>({
      method: "DELETE",
      path: `/apps/${encodeURIComponent(appName)}/volumes/${encodeURIComponent(volumeId)}`,
    });
  }

  private async request<T>(input: {
    method: "GET" | "POST" | "DELETE";
    path: string;
  }): Promise<T> {
    const response = await fetch(`https://api.machines.dev/v1${input.path}`, {
      method: input.method,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Fly API ${input.method} ${input.path} failed: ${body || response.statusText}`);
    }

    if (response.status === 204 || input.method === "DELETE") {
      return undefined as T;
    }

    const text = await response.text();
    if (!text) {
      return undefined as T;
    }
    return JSON.parse(text) as T;
  }
}

function isFlyNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return /not found|unknown machine|does not exist/i.test(error.message);
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

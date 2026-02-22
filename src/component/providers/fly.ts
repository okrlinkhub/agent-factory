import { v } from "convex/values";
import { action } from "../_generated/server.js";

export type WorkerProviderStatus =
  | "active"
  | "stopped";

export type SpawnWorkerInput = {
  workerId: string;
  appName: string;
  image: string;
  region: string;
  volumeName: string;
  volumePath: string;
  volumeSizeGb: number;
  cpuKind?: string;
  cpus?: number;
  memoryMb?: number;
  env?: Record<string, string>;
};

export type ProviderWorker = {
  workerId: string;
  machineId: string;
  region?: string;
  image?: string;
  status: WorkerProviderStatus;
};

export interface WorkerProvider {
  spawnWorker(input: SpawnWorkerInput): Promise<ProviderWorker>;
  listWorkers(appName: string): Promise<Array<ProviderWorker>>;
  terminateWorker(appName: string, machineId: string): Promise<void>;
  cordonWorker(appName: string, machineId: string): Promise<void>;
  stopWorker(appName: string, machineId: string): Promise<void>;
}

type FlyMachine = {
  id: string;
  name?: string;
  region?: string;
  state?: string;
  config?: {
    image?: string;
    image_ref?: string;
    mounts?: Array<FlyMachineMount>;
  };
};

type FlyMachineMount = {
  volume: string;
  path: string;
};

type FlyVolume = {
  id: string;
  name: string;
  region?: string;
};

export class FlyMachinesProvider implements WorkerProvider {
  constructor(
    private readonly apiToken: string,
    private readonly baseUrl: string = "https://api.machines.dev/v1",
  ) {}

  async spawnWorker(input: SpawnWorkerInput): Promise<ProviderWorker> {
    const volumeId = await this.resolveOrCreateVolumeId(
      input.appName,
      input.volumeName,
      input.workerId,
      input.region,
      input.volumeSizeGb,
    );
    const payload = {
      name: input.workerId,
      region: input.region,
      config: {
        image: input.image,
        guest: {
          cpu_kind: input.cpuKind ?? "shared",
          cpus: input.cpus ?? 1,
          memory_mb: input.memoryMb ?? 2048,
        },
        mounts: [
          {
            volume: volumeId,
            path: input.volumePath,
          } satisfies FlyMachineMount,
        ],
        env: {
          AGENT_FACTORY_WORKER_ID: input.workerId,
          ...input.env,
        },
      },
    };
    const machine = await this.request<FlyMachine>({
      path: `/apps/${encodeURIComponent(input.appName)}/machines`,
      method: "POST",
      body: payload,
    });
    return {
      workerId: input.workerId,
      machineId: machine.id,
      region: machine.region ?? input.region,
      image: machine.config?.image_ref ?? machine.config?.image ?? input.image,
      status: mapFlyStateToProviderStatus(machine.state),
    };
  }

  private async resolveOrCreateVolumeId(
    appName: string,
    volumeNamePrefix: string,
    workerId: string,
    region: string,
    volumeSizeGb: number,
  ): Promise<string> {
    const volumeName = buildDedicatedVolumeName(volumeNamePrefix, workerId);
    const volumes = await this.request<Array<FlyVolume>>({
      path: `/apps/${encodeURIComponent(appName)}/volumes`,
      method: "GET",
    });
    const regionalMatch = volumes.find(
      (volume) => volume.name === volumeName && volume.region === region,
    );
    if (regionalMatch) {
      return regionalMatch.id;
    }
    const created = await this.request<FlyVolume>({
      path: `/apps/${encodeURIComponent(appName)}/volumes`,
      method: "POST",
      body: {
        name: volumeName,
        region,
        size_gb: volumeSizeGb,
      },
    });
    return created.id;
  }

  async listWorkers(appName: string): Promise<Array<ProviderWorker>> {
    const machines = await this.request<Array<FlyMachine>>({
      path: `/apps/${encodeURIComponent(appName)}/machines`,
      method: "GET",
    });
    return machines.map((machine) => ({
      workerId: machine.name ?? machine.id,
      machineId: machine.id,
      region: machine.region,
      image: machine.config?.image_ref ?? machine.config?.image,
      status: mapFlyStateToProviderStatus(machine.state),
    }));
  }

  async terminateWorker(appName: string, machineId: string): Promise<void> {
    const volumeIds = await this.getMachineVolumeIds(appName, machineId);
    await this.request<void>({
      path: `/apps/${encodeURIComponent(appName)}/machines/${encodeURIComponent(machineId)}`,
      method: "DELETE",
    });
    for (const volumeId of volumeIds) {
      try {
        await this.request<void>({
          path: `/apps/${encodeURIComponent(appName)}/volumes/${encodeURIComponent(volumeId)}`,
          method: "DELETE",
        });
      } catch (error) {
        if (isFlyNotFoundError(error)) {
          continue;
        }
        throw error;
      }
    }
  }

  private async getMachineVolumeIds(appName: string, machineId: string): Promise<Array<string>> {
    try {
      const machine = await this.request<FlyMachine>({
        path: `/apps/${encodeURIComponent(appName)}/machines/${encodeURIComponent(machineId)}`,
        method: "GET",
      });
      const mounts = machine.config?.mounts ?? [];
      const uniqueVolumeIds = new Set(
        mounts.map((mount) => mount.volume).filter((volumeId) => volumeId.length > 0),
      );
      return Array.from(uniqueVolumeIds);
    } catch (error) {
      if (isFlyNotFoundError(error)) {
        return [];
      }
      throw error;
    }
  }

  async cordonWorker(appName: string, machineId: string): Promise<void> {
    await this.request<void>({
      path: `/apps/${encodeURIComponent(appName)}/machines/${encodeURIComponent(machineId)}/cordon`,
      method: "POST",
    });
  }

  async stopWorker(appName: string, machineId: string): Promise<void> {
    await this.request<void>({
      path: `/apps/${encodeURIComponent(appName)}/machines/${encodeURIComponent(machineId)}/stop`,
      method: "POST",
    });
  }

  private async request<T>(input: {
    path: string;
    method: "GET" | "POST" | "DELETE";
    body?: unknown;
  }): Promise<T> {
    const response = await fetch(`${this.baseUrl}${input.path}`, {
      method: input.method,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
      body: input.body ? JSON.stringify(input.body) : undefined,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Fly API ${input.method} ${input.path} failed: ${text}`);
    }

    if (input.method === "DELETE" || response.status === 204) {
      return undefined as T;
    }
    const responseBody = await response.text();
    if (!responseBody) {
      return undefined as T;
    }
    return JSON.parse(responseBody) as T;
  }
}

export const deleteFlyVolumeManual = action({
  args: {
    appName: v.string(),
    volumeId: v.string(),
    flyApiToken: v.optional(v.string()),
  },
  returns: v.object({
    ok: v.boolean(),
    status: v.number(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    void ctx;
    const appName = args.appName.trim();
    const volumeId = args.volumeId.trim();
    if (appName.length === 0 || volumeId.length === 0) {
      throw new Error("appName e volumeId sono obbligatori.");
    }
    const apiToken = args.flyApiToken?.trim();
    if (!apiToken) {
      throw new Error("flyApiToken mancante: passalo come argomento.");
    }

    const response = await fetch(
      `https://api.machines.dev/v1/apps/${encodeURIComponent(appName)}/volumes/${encodeURIComponent(volumeId)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      },
    );
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`Delete volume fallita (${response.status}): ${body || "errore sconosciuto"}`);
    }

    return {
      ok: true,
      status: response.status,
      message: body || "Volume eliminato.",
    };
  },
});

function mapFlyStateToProviderStatus(state: string | undefined): WorkerProviderStatus {
  switch (state) {
    case "created":
    case "started":
      return "active";
    case "stopped":
    case "destroyed":
    case "suspended":
      return "stopped";
    default:
      return "stopped";
  }
}

function buildDedicatedVolumeName(prefix: string, workerId: string): string {
  const sanitize = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
  const normalizedPrefix = sanitize(prefix) || "openclaw";
  const normalizedWorker = sanitize(workerId) || "worker";
  const workerHash = stableHashBase36(normalizedWorker).slice(0, 8);
  const maxPrefixLen = 30 - 1 - workerHash.length;
  const trimmedPrefix = normalizedPrefix.slice(0, Math.max(1, maxPrefixLen));
  return `${trimmedPrefix}_${workerHash}`;
}

function stableHashBase36(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const unsigned = hash >>> 0;
  return unsigned.toString(36);
}

function isFlyNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return /not found|unknown machine|does not exist/i.test(error.message);
}

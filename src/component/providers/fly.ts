export type WorkerProviderStatus =
  | "starting"
  | "active"
  | "idle"
  | "draining"
  | "stopped"
  | "failed";

export type SpawnWorkerInput = {
  workerId: string;
  appName: string;
  image: string;
  region: string;
};

export type ProviderWorker = {
  workerId: string;
  machineId: string;
  region?: string;
  status: WorkerProviderStatus;
};

export interface WorkerProvider {
  spawnWorker(input: SpawnWorkerInput): Promise<ProviderWorker>;
  listWorkers(appName: string): Promise<Array<ProviderWorker>>;
  terminateWorker(appName: string, machineId: string): Promise<void>;
  cordonWorker(appName: string, machineId: string): Promise<void>;
}

type FlyMachine = {
  id: string;
  name?: string;
  region?: string;
  state?: string;
};

export class FlyMachinesProvider implements WorkerProvider {
  constructor(
    private readonly apiToken: string,
    private readonly baseUrl: string = "https://api.machines.dev/v1",
  ) {}

  async spawnWorker(input: SpawnWorkerInput): Promise<ProviderWorker> {
    const payload = {
      name: input.workerId,
      region: input.region,
      config: {
        image: input.image,
        env: {
          AGENT_FACTORY_WORKER_ID: input.workerId,
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
      status: mapFlyStateToProviderStatus(machine.state),
    };
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
      status: mapFlyStateToProviderStatus(machine.state),
    }));
  }

  async terminateWorker(appName: string, machineId: string): Promise<void> {
    await this.request<void>({
      path: `/apps/${encodeURIComponent(appName)}/machines/${encodeURIComponent(machineId)}`,
      method: "DELETE",
    });
  }

  async cordonWorker(appName: string, machineId: string): Promise<void> {
    await this.request<void>({
      path: `/apps/${encodeURIComponent(appName)}/machines/${encodeURIComponent(machineId)}/cordon`,
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

    if (input.method === "DELETE") {
      return undefined as T;
    }
    return (await response.json()) as T;
  }
}

function mapFlyStateToProviderStatus(state: string | undefined): WorkerProviderStatus {
  switch (state) {
    case "created":
      return "starting";
    case "started":
      return "active";
    case "stopped":
      return "stopped";
    case "destroyed":
      return "stopped";
    case "suspended":
      return "idle";
    default:
      return "failed";
  }
}

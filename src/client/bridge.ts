export type HydratedBridgeRuntimeConfig = {
  baseUrl: string | null;
  serviceId: string | null;
  appKey: string | null;
  serviceKey: string | null;
  serviceKeySecretRef: string | null;
};

export type ResolvedBridgeRuntimeConfig = {
  baseUrl: string;
  serviceId: string;
  appKey: string;
  serviceKey: string;
};

export type BridgeExecutionResult = {
  success: boolean;
  status: number;
  functionKey: string;
  result?: unknown;
  error?: string;
};

type ExecuteBridgeFunctionArgs = {
  config: ResolvedBridgeRuntimeConfig;
  functionKey: string;
  args: Record<string, unknown>;
  userToken?: string | null;
  auditHeaders?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  retry?: {
    maxAttempts?: number;
    baseDelayMs?: number;
  };
};

type MaybeExecuteBridgeToolCallArgs = {
  toolName: string;
  toolArgs: Record<string, unknown>;
  hydratedConfig: HydratedBridgeRuntimeConfig | null;
  userToken?: string | null;
  fetchImpl?: typeof fetch;
  retry?: {
    maxAttempts?: number;
    baseDelayMs?: number;
  };
  env?: Record<string, string | undefined>;
};

type MaybeExecuteBridgeToolCallResult =
  | {
      handled: false;
    }
  | {
      handled: true;
      functionKey: string;
      response: BridgeExecutionResult;
    };

const BRIDGE_ENV_KEYS = {
  baseUrl: ["OPENCLAW_AGENT_BRIDGE_BASE_URL", "AGENT_BRIDGE_BASE_URL"],
  serviceId: ["OPENCLAW_SERVICE_ID", "AGENT_BRIDGE_SERVICE_ID"],
  serviceKey: ["OPENCLAW_SERVICE_KEY", "AGENT_BRIDGE_SERVICE_KEY"],
  appKey: ["OPENCLAW_AGENT_APP", "OPENCLAW_APP_KEY", "AGENT_BRIDGE_APP_KEY"],
} as const;

export function resolveBridgeRuntimeConfig(
  hydratedConfig: HydratedBridgeRuntimeConfig | null | undefined,
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
):
  | {
      ok: true;
      config: ResolvedBridgeRuntimeConfig;
    }
  | {
      ok: false;
      error: string;
    } {
  const baseUrl = pickValue(hydratedConfig?.baseUrl, readEnv(env, BRIDGE_ENV_KEYS.baseUrl));
  const serviceId = pickValue(hydratedConfig?.serviceId, readEnv(env, BRIDGE_ENV_KEYS.serviceId));
  const serviceKey = pickValue(
    hydratedConfig?.serviceKey,
    readEnv(env, BRIDGE_ENV_KEYS.serviceKey),
  );
  const appKey = pickValue(hydratedConfig?.appKey, readEnv(env, BRIDGE_ENV_KEYS.appKey));

  const missing: Array<string> = [];
  if (!baseUrl) missing.push("baseUrl");
  if (!serviceId) missing.push("serviceId");
  if (!serviceKey) missing.push("serviceKey");
  if (!appKey) missing.push("appKey");
  if (missing.length > 0) {
    return {
      ok: false,
      error: `Agent Bridge config incompleta: ${missing.join(", ")}`,
    };
  }
  const resolvedBaseUrl = baseUrl as string;
  const resolvedServiceId = serviceId as string;
  const resolvedServiceKey = serviceKey as string;
  const resolvedAppKey = appKey as string;

  return {
    ok: true,
    config: {
      baseUrl: normalizeBaseUrl(resolvedBaseUrl),
      serviceId: resolvedServiceId,
      serviceKey: resolvedServiceKey,
      appKey: resolvedAppKey,
    },
  };
}

export function isBridgeToolName(toolName: string): boolean {
  return /^bridge\.[A-Za-z0-9._-]+$/.test(toolName);
}

export function bridgeFunctionKeyFromToolName(toolName: string): string | null {
  if (!isBridgeToolName(toolName)) {
    return null;
  }
  return toolName.slice("bridge.".length);
}

export async function executeBridgeFunction(
  input: ExecuteBridgeFunctionArgs,
): Promise<BridgeExecutionResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const maxAttempts = Math.max(1, input.retry?.maxAttempts ?? 3);
  const baseDelayMs = Math.max(50, input.retry?.baseDelayMs ?? 250);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetchImpl(`${input.config.baseUrl}/agent/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Agent-Service-Id": input.config.serviceId,
        "X-Agent-Service-Key": input.config.serviceKey,
        "X-Agent-App": input.config.appKey,
        ...(input.userToken ? { Authorization: `Bearer ${input.userToken}` } : {}),
        ...sanitizeHeaderValues(input.auditHeaders),
      },
      body: JSON.stringify({
        functionKey: input.functionKey,
        args: input.args,
      }),
    });

    const body = await safeParseJson(response);
    const executionResult: BridgeExecutionResult = {
      success: response.ok && body?.success === true,
      status: response.status,
      functionKey: input.functionKey,
      result: body?.result,
      error: body?.error ?? (response.ok ? undefined : `HTTP ${response.status}`),
    };
    if (!shouldRetry(response.status) || attempt >= maxAttempts) {
      return executionResult;
    }
    const backoff = baseDelayMs * 2 ** (attempt - 1);
    await sleep(backoff);
  }

  return {
    success: false,
    status: 500,
    functionKey: input.functionKey,
    error: "Bridge execution failed without response",
  };
}

export async function maybeExecuteBridgeToolCall(
  input: MaybeExecuteBridgeToolCallArgs,
): Promise<MaybeExecuteBridgeToolCallResult> {
  const functionKey = bridgeFunctionKeyFromToolName(input.toolName);
  if (!functionKey) {
    return { handled: false };
  }

  const resolved = resolveBridgeRuntimeConfig(input.hydratedConfig, input.env);
  if (!resolved.ok) {
    return {
      handled: true,
      functionKey,
      response: {
        success: false,
        status: 400,
        functionKey,
        error: resolved.error,
      },
    };
  }

  const response = await executeBridgeFunction({
    config: resolved.config,
    functionKey,
    args: input.toolArgs,
    userToken: input.userToken,
    fetchImpl: input.fetchImpl,
    retry: input.retry,
  });
  return {
    handled: true,
    functionKey,
    response,
  };
}

function readEnv(
  env: Record<string, string | undefined>,
  keys: ReadonlyArray<string>,
): string | null {
  for (const key of keys) {
    const value = env[key];
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function pickValue(primary: string | null | undefined, fallback: string | null): string | null {
  if (primary && primary.trim().length > 0) {
    return primary.trim();
  }
  return fallback;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function shouldRetry(status: number): boolean {
  return status === 429 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function safeParseJson(response: Response): Promise<Record<string, any> | null> {
  const contentType = response.headers.get("content-type");
  if (!contentType?.toLowerCase().includes("application/json")) {
    return null;
  }
  try {
    return (await response.json()) as Record<string, any>;
  } catch {
    return null;
  }
}

function sanitizeHeaderValues(
  headers: Record<string, string | undefined> | undefined,
): Record<string, string> {
  if (!headers) {
    return {};
  }
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!value || value.trim().length === 0) {
      continue;
    }
    output[key] = value;
  }
  return output;
}

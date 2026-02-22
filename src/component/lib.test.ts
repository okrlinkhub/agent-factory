/// <reference types="vite/client" />

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api.js";
import { initConvexTest } from "./setup.test.js";

describe("component lib", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  test("enqueue and claim should respect queue flow", async () => {
    const t = initConvexTest();
    await t.mutation(api.queue.upsertAgentProfile, {
      agentKey: "support-agent",
      version: "1.0.0",
      soulMd: "# Soul",
      clientMd: "# Client",
      skills: ["agent-bridge"],
      secretsRef: ["telegram.botToken"],
      enabled: true,
    });

    const messageId = await t.mutation(api.lib.enqueue, {
      conversationId: "telegram:chat:1",
      agentKey: "support-agent",
      payload: {
        provider: "telegram",
        providerUserId: "u1",
        messageText: "Ciao",
      },
    });
    expect(messageId).toBeDefined();

    const claimed = await t.mutation(api.lib.claim, {
      workerId: "worker-1",
    });
    expect(claimed).not.toBeNull();
    expect(claimed?.conversationId).toBe("telegram:chat:1");
  });

  test("identity binding should resolve, rebind and revoke", async () => {
    const t = initConvexTest();
    await t.mutation(api.queue.upsertAgentProfile, {
      agentKey: "agent-a",
      version: "1.0.0",
      soulMd: "# Soul",
      clientMd: "# Client",
      skills: ["agent-bridge"],
      secretsRef: [],
      enabled: true,
    });
    await t.mutation(api.queue.upsertAgentProfile, {
      agentKey: "agent-b",
      version: "1.0.0",
      soulMd: "# Soul",
      clientMd: "# Client",
      skills: ["agent-bridge"],
      secretsRef: [],
      enabled: true,
    });

    const first = await t.mutation(api.lib.bindUserAgent, {
      consumerUserId: "u-1",
      agentKey: "agent-a",
      source: "telegram_pairing",
      telegramUserId: "tg-user-1",
      telegramChatId: "tg-chat-1",
    });
    expect(first.agentKey).toBe("agent-a");

    const byUser = await t.query(api.lib.resolveAgentForUser, {
      consumerUserId: "u-1",
    });
    expect(byUser.agentKey).toBe("agent-a");

    const byTelegram = await t.query(api.lib.resolveAgentForTelegram, {
      telegramUserId: "tg-user-1",
    });
    expect(byTelegram.agentKey).toBe("agent-a");

    await t.mutation(api.lib.bindUserAgent, {
      consumerUserId: "u-1",
      agentKey: "agent-b",
      source: "manual",
      telegramUserId: "tg-user-1",
      telegramChatId: "tg-chat-1",
    });

    const rebound = await t.query(api.lib.resolveAgentForUser, {
      consumerUserId: "u-1",
    });
    expect(rebound.agentKey).toBe("agent-b");

    const revokeResult = await t.mutation(api.lib.revokeUserAgentBinding, {
      consumerUserId: "u-1",
    });
    expect(revokeResult.revoked).toBe(1);

    const afterRevoke = await t.query(api.lib.resolveAgentForTelegram, {
      telegramChatId: "tg-chat-1",
    });
    expect(afterRevoke.agentKey).toBeNull();
  });

  test("worker scheduling should set idle shutdown from last claim time", async () => {
    const t = initConvexTest();
    const now = Date.now();
    vi.setSystemTime(now);
    await t.mutation(api.queue.upsertAgentProfile, {
      agentKey: "support-agent",
      version: "1.0.0",
      soulMd: "# Soul",
      clientMd: "# Client",
      skills: ["agent-bridge"],
      secretsRef: [],
      enabled: true,
    });
    const messageId = await t.mutation(api.lib.enqueue, {
      conversationId: "telegram:chat:2",
      agentKey: "support-agent",
      payload: {
        provider: "telegram",
        providerUserId: "u2",
        messageText: "ciao",
      },
    });
    const claim = await t.mutation(api.lib.claim, { workerId: "worker-2" });
    expect(claim).not.toBeNull();
    expect(claim?.messageId).toBe(messageId);

    const completionTime = now + 60_000;
    vi.setSystemTime(completionTime);
    const completed = await t.mutation(api.lib.complete, {
      workerId: "worker-2",
      messageId,
      leaseId: claim?.leaseId ?? "",
    });
    expect(completed).toBe(true);
    const workers = await t.query((internal.queue as any).listWorkersForScheduler, {});
    const worker = workers.find((row: { workerId: string }) => row.workerId === "worker-2");
    expect(worker?.status).toBe("active");
    expect(worker?.load).toBe(0);
    expect(worker?.scheduledShutdownAt).toBe(now + 300_000);
  });

  test("worker control state should signal stop for stopped worker", async () => {
    const t = initConvexTest();
    await t.mutation(internal.queue.upsertWorkerState, {
      workerId: "worker-stop-1",
      provider: "fly",
      status: "stopped",
      load: 0,
    });
    const control = await t.query(api.queue.getWorkerControlState as any, {
      workerId: "worker-stop-1",
    });
    expect(control.shouldStop).toBe(true);

    const controlUnknown = await t.query(api.queue.getWorkerControlState as any, {
      workerId: "worker-nonexistent",
    });
    expect(controlUnknown.shouldStop).toBe(true);
  });

  test("upsertWorkerState should preserve heartbeat for stopped workers", async () => {
    const t = initConvexTest();
    const firstHeartbeat = 1_700_000_000_000;
    const stoppedAt = firstHeartbeat + 120_000;

    await t.mutation(internal.queue.upsertWorkerState, {
      workerId: "worker-heartbeat-1",
      provider: "fly",
      status: "active",
      load: 0,
      nowMs: firstHeartbeat,
    });

    await t.mutation(internal.queue.upsertWorkerState, {
      workerId: "worker-heartbeat-1",
      provider: "fly",
      status: "stopped",
      load: 0,
      nowMs: stoppedAt,
      scheduledShutdownAt: stoppedAt,
    });

    const workers = await t.query((internal.queue as any).listWorkersForScheduler, {});
    const worker = workers.find(
      (row: { workerId: string }) => row.workerId === "worker-heartbeat-1",
    );

    expect(worker?.status).toBe("stopped");
    expect(worker?.heartbeatAt).toBe(firstHeartbeat);
    expect(worker?.scheduledShutdownAt).toBe(stoppedAt);
    expect(worker?.stoppedAt).toBe(stoppedAt);
  });

  test("scheduler caps desired workers by distinct ready conversations", async () => {
    const t = initConvexTest();
    await t.mutation(api.queue.upsertAgentProfile, {
      agentKey: "support-agent",
      version: "1.0.0",
      soulMd: "# Soul",
      clientMd: "# Client",
      skills: ["agent-bridge"],
      secretsRef: [],
      enabled: true,
    });
    await t.mutation(api.queue.importPlaintextSecret, {
      secretRef: "fly.apiToken",
      plaintextValue: "fly-token",
    });
    await t.mutation(api.queue.importPlaintextSecret, {
      secretRef: "convex.url",
      plaintextValue: "https://example.convex.cloud",
    });

    await t.mutation(api.queue.enqueueMessage, {
      conversationId: "telegram:chat:cap-1",
      agentKey: "support-agent",
      payload: {
        provider: "telegram",
        providerUserId: "u-cap",
        messageText: "first",
      },
    });
    await t.mutation(api.queue.enqueueMessage, {
      conversationId: "telegram:chat:cap-1",
      agentKey: "support-agent",
      payload: {
        provider: "telegram",
        providerUserId: "u-cap",
        messageText: "second",
      },
    });

    await t.mutation(internal.queue.upsertWorkerState, {
      workerId: "worker-cap-1",
      provider: "fly",
      status: "active",
      load: 0,
    });
    await t.mutation(internal.queue.upsertWorkerState, {
      workerId: "worker-cap-2",
      provider: "fly",
      status: "active",
      load: 0,
    });
    await t.mutation(internal.queue.upsertWorkerState, {
      workerId: "worker-cap-3",
      provider: "fly",
      status: "active",
      load: 0,
    });

    const reconcile = await t.action(api.scheduler.reconcileWorkerPool, {
      scalingPolicy: {
        minWorkers: 0,
        maxWorkers: 5,
        queuePerWorkerTarget: 1,
        spawnStep: 1,
        idleTimeoutMs: 300_000,
        reconcileIntervalMs: 15_000,
      },
    });
    expect(reconcile.activeWorkers).toBe(3);
    expect(reconcile.spawned).toBe(0);
    expect(reconcile.terminated).toBe(0);
  });

  test("scheduler desired workers increases with distinct ready conversations", async () => {
    const t = initConvexTest();
    await t.mutation(api.queue.upsertAgentProfile, {
      agentKey: "support-agent",
      version: "1.0.0",
      soulMd: "# Soul",
      clientMd: "# Client",
      skills: ["agent-bridge"],
      secretsRef: [],
      enabled: true,
    });
    await t.mutation(api.queue.importPlaintextSecret, {
      secretRef: "fly.apiToken",
      plaintextValue: "fly-token",
    });
    await t.mutation(api.queue.importPlaintextSecret, {
      secretRef: "convex.url",
      plaintextValue: "https://example.convex.cloud",
    });

    await t.mutation(api.queue.enqueueMessage, {
      conversationId: "telegram:chat:cap-a",
      agentKey: "support-agent",
      payload: {
        provider: "telegram",
        providerUserId: "u-cap-a",
        messageText: "hello",
      },
    });
    await t.mutation(api.queue.enqueueMessage, {
      conversationId: "telegram:chat:cap-b",
      agentKey: "support-agent",
      payload: {
        provider: "telegram",
        providerUserId: "u-cap-b",
        messageText: "hello",
      },
    });

    await t.mutation(internal.queue.upsertWorkerState, {
      workerId: "worker-cap-4",
      provider: "fly",
      status: "active",
      load: 0,
    });
    await t.mutation(internal.queue.upsertWorkerState, {
      workerId: "worker-cap-5",
      provider: "fly",
      status: "active",
      load: 0,
    });
    await t.mutation(internal.queue.upsertWorkerState, {
      workerId: "worker-cap-6",
      provider: "fly",
      status: "active",
      load: 0,
    });

    const reconcile = await t.action(api.scheduler.reconcileWorkerPool, {
      scalingPolicy: {
        minWorkers: 0,
        maxWorkers: 5,
        queuePerWorkerTarget: 1,
        spawnStep: 1,
        idleTimeoutMs: 300_000,
        reconcileIntervalMs: 15_000,
      },
      providerConfig: {
        kind: "fly",
        appName: "agent-factory-workers",
        organizationSlug: "personal",
        image: "registry.fly.io/agent-factory-workers:test-image",
        region: "iad",
        volumeName: "",
        volumePath: "",
        volumeSizeGb: 10,
      },
    });
    expect(reconcile.activeWorkers).toBe(3);
    expect(reconcile.spawned).toBe(0);
    expect(reconcile.terminated).toBe(0);
  });
});

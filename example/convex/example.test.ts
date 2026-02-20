import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { initConvexTest } from "./setup.test";
import { api } from "./_generated/api";

describe("example", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
  });

  test("queueStats", async () => {
    const t = initConvexTest();
    const stats = await t.query(api.example.queueStats, {});
    expect(stats).toBeDefined();
    expect(typeof stats.queuedReady).toBe("number");
    expect(stats.processing).toBe(0);
    expect(stats.deadLetter).toBe(0);
  });

  test("seed, secrets e reconcile workers", async () => {
    const t = initConvexTest();

    const profileId = await t.mutation(api.example.seedDefaultAgent, {});
    expect(profileId).toBeDefined();

    const telegramSecret = await t.mutation(api.example.importSecret, {
      secretRef: "telegram.botToken",
      plaintextValue: "telegram-token",
    });
    expect(telegramSecret.secretRef).toBe("telegram.botToken");
    expect(telegramSecret.version).toBe(1);

    const flySecret = await t.mutation(api.example.importSecret, {
      secretRef: "fly.apiToken",
      plaintextValue: "fly-token",
    });
    expect(flySecret.secretRef).toBe("fly.apiToken");

    const secretStatus = await t.query(api.example.secretStatus, {
      secretRefs: ["telegram.botToken", "fly.apiToken"],
    });
    expect(secretStatus.every((item) => item.hasActive)).toBe(true);

    const reconcile = await t.action(api.example.startWorkers, {});
    expect(reconcile.desiredWorkers).toBe(0);
    expect(reconcile.activeWorkers).toBe(0);
    expect(reconcile.spawned).toBe(0);
    expect(reconcile.terminated).toBe(0);
  });

  test("identity wrappers: bind and myAgentKey", async () => {
    const t = initConvexTest();
    await t.mutation(api.example.seedDefaultAgent, {});

    const bound = await t.mutation(api.example.bindUserAgent, {
      consumerUserId: "anonymous",
      agentKey: "default",
      source: "telegram_pairing",
      telegramUserId: "tg-user-1",
      telegramChatId: "tg-chat-1",
    });
    expect(bound.consumerUserId).toBe("anonymous");

    const myAgent = await t.query(api.example.myAgentKey, {});
    expect(myAgent.consumerUserId).toBe("anonymous");
    expect(myAgent.agentKey).toBe("default");

    const tgLookup = await t.query(api.example.resolveAgentForTelegram, {
      telegramChatId: "tg-chat-1",
    });
    expect(tgLookup.agentKey).toBe("default");
  });

  test("seed example users", async () => {
    const t = initConvexTest();
    const first = await t.mutation(api.example.seedExampleUsers, {});
    expect(first.inserted).toBe(3);

    const users = await t.query(api.example.listExampleUsers, {});
    expect(users.length).toBe(3);
    expect(users.some((user) => user.handle === "alice")).toBe(true);

    const second = await t.mutation(api.example.seedExampleUsers, {});
    expect(second.inserted).toBe(0);
  });

  test("list users with bindings", async () => {
    const t = initConvexTest();
    await t.mutation(api.example.seedDefaultAgent, {});
    await t.mutation(api.example.seedExampleUsers, {});

    const users = await t.query(api.example.listExampleUsers, {});
    expect(users.length).toBe(3);
    const alice = users.find((user) => user.handle === "alice");
    expect(alice?._id).toBeDefined();

    await t.mutation(api.example.bindUserAgent, {
      consumerUserId: alice!._id,
      agentKey: "default",
      source: "manual",
    });

    const rows = await t.query(api.example.listUsersWithBindings, {});
    const aliceRow = rows.find((row) => row._id === alice!._id);
    expect(aliceRow?.agentKey).toBe("default");
  });
});

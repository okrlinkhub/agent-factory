import { describe, expect, test } from "vitest";
import { exposeApi } from "./index.js";
import { anyApi, type ApiFromModules } from "convex/server";
import { components, initConvexTest } from "./setup.test.js";

export const { enqueue, queueStats, createPushTemplate, listPushTemplatesByCompany } = exposeApi(
  components.agentFactory,
  {
  auth: async (ctx, _operation) => {
    return (await ctx.auth.getUserIdentity())?.subject ?? "anonymous";
  },
},
);

const testApi = (
  anyApi as unknown as ApiFromModules<{
    "index.test": {
      enqueue: typeof enqueue;
      queueStats: typeof queueStats;
      createPushTemplate: typeof createPushTemplate;
      listPushTemplatesByCompany: typeof listPushTemplatesByCompany;
    };
  }>
)["index.test"];

describe("client tests", () => {
  test("should read queue stats through client wrapper", async () => {
    const t = initConvexTest().withIdentity({
      subject: "user1",
    });

    const stats = await t.query(testApi.queueStats, {});
    expect(stats.queuedReady).toBe(0);
  });

  test("should create and list push templates through client wrapper", async () => {
    const t = initConvexTest().withIdentity({
      subject: "admin-user",
    });

    const templateId = await t.mutation(testApi.createPushTemplate, {
      companyId: "company-1",
      templateKey: "daily-sync",
      title: "Daily Sync",
      text: "Aggiorna lo stato quotidiano",
      periodicity: "daily",
      suggestedTimes: [{ kind: "daily", time: "09:00" }],
      actorUserId: "admin-user",
    });
    expect(templateId).toBeDefined();

    const templates = await t.query(testApi.listPushTemplatesByCompany, {
      companyId: "company-1",
    });
    expect(templates.length).toBe(1);
    expect(templates[0].templateKey).toBe("daily-sync");
  });
});

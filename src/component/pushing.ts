import { v } from "convex/values";
import { internal } from "./_generated/api.js";
import { mutation, query } from "./_generated/server.js";
import type { MutationCtx } from "./_generated/server.js";
import type { Id } from "./_generated/dataModel.js";
import { providerConfigValidator } from "./config.js";
import type { ProviderConfig } from "./config.js";

const periodicityValidator = v.union(
  v.literal("manual"),
  v.literal("daily"),
  v.literal("weekly"),
  v.literal("monthly"),
);

const suggestedTimeValidator = v.union(
  v.object({
    kind: v.literal("daily"),
    time: v.string(),
  }),
  v.object({
    kind: v.literal("weekly"),
    weekday: v.number(),
    time: v.string(),
  }),
  v.object({
    kind: v.literal("monthly"),
    dayOfMonth: v.union(v.number(), v.literal("last")),
    time: v.string(),
  }),
);

const scheduleValidator = v.union(
  v.object({
    kind: v.literal("manual"),
  }),
  v.object({
    kind: v.literal("daily"),
    time: v.string(),
  }),
  v.object({
    kind: v.literal("weekly"),
    weekday: v.number(),
    time: v.string(),
  }),
  v.object({
    kind: v.literal("monthly"),
    dayOfMonth: v.union(v.number(), v.literal("last")),
    time: v.string(),
  }),
);

const templateViewValidator = v.object({
  _id: v.id("messagePushTemplates"),
  companyId: v.string(),
  templateKey: v.string(),
  title: v.string(),
  text: v.string(),
  periodicity: periodicityValidator,
  suggestedTimes: v.array(suggestedTimeValidator),
  enabled: v.boolean(),
  createdBy: v.string(),
  updatedBy: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const jobViewValidator = v.object({
  _id: v.id("messagePushJobs"),
  companyId: v.string(),
  consumerUserId: v.string(),
  agentKey: v.union(v.null(), v.string()),
  sourceTemplateId: v.union(v.null(), v.id("messagePushTemplates")),
  title: v.string(),
  text: v.string(),
  periodicity: periodicityValidator,
  timezone: v.string(),
  schedule: scheduleValidator,
  enabled: v.boolean(),
  nextRunAt: v.union(v.null(), v.number()),
  lastRunAt: v.union(v.null(), v.number()),
  lastRunKey: v.union(v.null(), v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const dispatchStatusValidator = v.union(
  v.literal("enqueued"),
  v.literal("skipped"),
  v.literal("failed"),
);

type Periodicity = "manual" | "daily" | "weekly" | "monthly";
type ManualSchedule = { kind: "manual" };
type DailySchedule = { kind: "daily"; time: string };
type WeeklySchedule = { kind: "weekly"; weekday: number; time: string };
type MonthlySchedule = { kind: "monthly"; dayOfMonth: number | "last"; time: string };
type Schedule = ManualSchedule | DailySchedule | WeeklySchedule | MonthlySchedule;
type SuggestedTime = DailySchedule | WeeklySchedule | MonthlySchedule;
type RecurringPeriodicity = Exclude<Periodicity, "manual">;
type RecurringSchedule = Exclude<Schedule, ManualSchedule>;

export const createPushTemplate = mutation({
  args: {
    companyId: v.string(),
    templateKey: v.string(),
    title: v.string(),
    text: v.string(),
    periodicity: periodicityValidator,
    suggestedTimes: v.array(suggestedTimeValidator),
    enabled: v.optional(v.boolean()),
    actorUserId: v.string(),
    nowMs: v.optional(v.number()),
  },
  returns: v.id("messagePushTemplates"),
  handler: async (ctx, args) => {
    validateTemplateTimes(args.periodicity, args.suggestedTimes);
    const existing = await ctx.db
      .query("messagePushTemplates")
      .withIndex("by_companyId_and_templateKey", (q) =>
        q.eq("companyId", args.companyId).eq("templateKey", args.templateKey),
      )
      .unique();
    if (existing) {
      throw new Error(`Template key '${args.templateKey}' already exists for company`);
    }
    const nowMs = args.nowMs ?? Date.now();
    return await ctx.db.insert("messagePushTemplates", {
      companyId: args.companyId,
      templateKey: args.templateKey,
      title: args.title,
      text: args.text,
      periodicity: args.periodicity,
      suggestedTimes: args.suggestedTimes,
      enabled: args.enabled ?? true,
      createdBy: args.actorUserId,
      updatedBy: args.actorUserId,
      createdAt: nowMs,
      updatedAt: nowMs,
    });
  },
});

export const updatePushTemplate = mutation({
  args: {
    templateId: v.id("messagePushTemplates"),
    title: v.optional(v.string()),
    text: v.optional(v.string()),
    periodicity: v.optional(periodicityValidator),
    suggestedTimes: v.optional(v.array(suggestedTimeValidator)),
    enabled: v.optional(v.boolean()),
    actorUserId: v.string(),
    nowMs: v.optional(v.number()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    if (!template) return false;
    const nextPeriodicity = args.periodicity ?? template.periodicity;
    const nextSuggestedTimes = args.suggestedTimes ?? template.suggestedTimes;
    validateTemplateTimes(nextPeriodicity, nextSuggestedTimes);
    const nowMs = args.nowMs ?? Date.now();
    await ctx.db.patch(template._id, {
      title: args.title ?? template.title,
      text: args.text ?? template.text,
      periodicity: nextPeriodicity,
      suggestedTimes: nextSuggestedTimes,
      enabled: args.enabled ?? template.enabled,
      updatedBy: args.actorUserId,
      updatedAt: nowMs,
    });
    return true;
  },
});

export const deletePushTemplate = mutation({
  args: {
    templateId: v.id("messagePushTemplates"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    if (!template) return false;
    await ctx.db.delete(template._id);
    return true;
  },
});

export const listPushTemplatesByCompany = query({
  args: {
    companyId: v.string(),
    includeDisabled: v.optional(v.boolean()),
  },
  returns: v.array(templateViewValidator),
  handler: async (ctx, args) => {
    const includeDisabled = args.includeDisabled ?? false;
    const rows = includeDisabled
      ? await ctx.db
          .query("messagePushTemplates")
          .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
          .collect()
      : await ctx.db
          .query("messagePushTemplates")
          .withIndex("by_companyId_and_enabled", (q) =>
            q.eq("companyId", args.companyId).eq("enabled", true),
          )
          .collect();
    rows.sort((a, b) => b.updatedAt - a.updatedAt);
    return rows.map((row) => ({
      _id: row._id,
      companyId: row.companyId,
      templateKey: row.templateKey,
      title: row.title,
      text: row.text,
      periodicity: row.periodicity,
      suggestedTimes: row.suggestedTimes,
      enabled: row.enabled,
      createdBy: row.createdBy,
      updatedBy: row.updatedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  },
});

export const createPushJobFromTemplate = mutation({
  args: {
    companyId: v.string(),
    consumerUserId: v.string(),
    templateId: v.id("messagePushTemplates"),
    timezone: v.string(),
    schedule: v.optional(scheduleValidator),
    enabled: v.optional(v.boolean()),
    nowMs: v.optional(v.number()),
  },
  returns: v.id("messagePushJobs"),
  handler: async (ctx, args) => {
    assertValidTimezone(args.timezone);
    const template = await ctx.db.get(args.templateId);
    if (!template) {
      throw new Error("Template not found");
    }
    if (template.companyId !== args.companyId) {
      throw new Error("Template company mismatch");
    }
    const schedule = resolveScheduleForTemplate(
      template.periodicity,
      template.suggestedTimes,
      args.schedule,
    );
    validateSchedule(template.periodicity, schedule);
    const nowMs = args.nowMs ?? Date.now();
    const enabled = args.enabled ?? true;
    const recurringSchedule = toRecurringSchedule(template.periodicity, schedule);
    const nextRunAt =
      enabled && recurringSchedule
        ? computeNextRunAt({
            periodicity: recurringSchedule.periodicity,
            schedule: recurringSchedule.schedule,
            timezone: args.timezone,
            fromMs: nowMs,
          })
        : undefined;
    const agentKey = await resolveActiveAgentKeyForUser(ctx, args.consumerUserId);
    return await ctx.db.insert("messagePushJobs", {
      companyId: args.companyId,
      consumerUserId: args.consumerUserId,
      agentKey: agentKey ?? undefined,
      sourceTemplateId: template._id,
      title: template.title,
      text: template.text,
      periodicity: template.periodicity,
      timezone: args.timezone,
      schedule,
      enabled,
      nextRunAt,
      createdAt: nowMs,
      updatedAt: nowMs,
    });
  },
});

export const createPushJobCustom = mutation({
  args: {
    companyId: v.string(),
    consumerUserId: v.string(),
    title: v.string(),
    text: v.string(),
    periodicity: periodicityValidator,
    timezone: v.string(),
    schedule: scheduleValidator,
    enabled: v.optional(v.boolean()),
    nowMs: v.optional(v.number()),
  },
  returns: v.id("messagePushJobs"),
  handler: async (ctx, args) => {
    assertValidTimezone(args.timezone);
    validateSchedule(args.periodicity, args.schedule);
    const nowMs = args.nowMs ?? Date.now();
    const enabled = args.enabled ?? true;
    const recurringSchedule = toRecurringSchedule(args.periodicity, args.schedule);
    const nextRunAt =
      enabled && recurringSchedule
        ? computeNextRunAt({
            periodicity: recurringSchedule.periodicity,
            schedule: recurringSchedule.schedule,
            timezone: args.timezone,
            fromMs: nowMs,
          })
        : undefined;
    const agentKey = await resolveActiveAgentKeyForUser(ctx, args.consumerUserId);
    return await ctx.db.insert("messagePushJobs", {
      companyId: args.companyId,
      consumerUserId: args.consumerUserId,
      agentKey: agentKey ?? undefined,
      sourceTemplateId: undefined,
      title: args.title,
      text: args.text,
      periodicity: args.periodicity,
      timezone: args.timezone,
      schedule: args.schedule,
      enabled,
      nextRunAt,
      createdAt: nowMs,
      updatedAt: nowMs,
    });
  },
});

export const updatePushJob = mutation({
  args: {
    jobId: v.id("messagePushJobs"),
    title: v.optional(v.string()),
    text: v.optional(v.string()),
    periodicity: v.optional(periodicityValidator),
    timezone: v.optional(v.string()),
    schedule: v.optional(scheduleValidator),
    enabled: v.optional(v.boolean()),
    nowMs: v.optional(v.number()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return false;
    const nowMs = args.nowMs ?? Date.now();
    const periodicity = args.periodicity ?? job.periodicity;
    const timezone = args.timezone ?? job.timezone;
    const schedule = args.schedule ?? job.schedule;
    const enabled = args.enabled ?? job.enabled;
    assertValidTimezone(timezone);
    validateSchedule(periodicity, schedule);
    const recurringSchedule = toRecurringSchedule(periodicity, schedule);
    const nextRunAt =
      enabled && recurringSchedule
        ? computeNextRunAt({
            periodicity: recurringSchedule.periodicity,
            schedule: recurringSchedule.schedule,
            timezone,
            fromMs: nowMs,
          })
        : undefined;
    await ctx.db.patch(job._id, {
      title: args.title ?? job.title,
      text: args.text ?? job.text,
      periodicity,
      timezone,
      schedule,
      enabled,
      nextRunAt,
      updatedAt: nowMs,
    });
    return true;
  },
});

export const deletePushJob = mutation({
  args: {
    jobId: v.id("messagePushJobs"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return false;
    await ctx.db.delete(job._id);
    return true;
  },
});

export const setPushJobEnabled = mutation({
  args: {
    jobId: v.id("messagePushJobs"),
    enabled: v.boolean(),
    nowMs: v.optional(v.number()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return false;
    const nowMs = args.nowMs ?? Date.now();
    const recurringSchedule = toRecurringSchedule(job.periodicity, job.schedule);
    const nextRunAt =
      args.enabled && recurringSchedule
        ? computeNextRunAt({
            periodicity: recurringSchedule.periodicity,
            schedule: recurringSchedule.schedule,
            timezone: job.timezone,
            fromMs: nowMs,
          })
        : undefined;
    await ctx.db.patch(job._id, {
      enabled: args.enabled,
      nextRunAt,
      updatedAt: nowMs,
    });
    return true;
  },
});

export const listPushJobsForUser = query({
  args: {
    consumerUserId: v.string(),
    includeDisabled: v.optional(v.boolean()),
  },
  returns: v.array(jobViewValidator),
  handler: async (ctx, args) => {
    const includeDisabled = args.includeDisabled ?? true;
    const rows = includeDisabled
      ? await ctx.db
          .query("messagePushJobs")
          .withIndex("by_consumerUserId", (q) => q.eq("consumerUserId", args.consumerUserId))
          .collect()
      : await ctx.db
          .query("messagePushJobs")
          .withIndex("by_consumerUserId_and_enabled", (q) =>
            q.eq("consumerUserId", args.consumerUserId).eq("enabled", true),
          )
          .collect();
    rows.sort((a, b) => b.updatedAt - a.updatedAt);
    return rows.map((row) => ({
      _id: row._id,
      companyId: row.companyId,
      consumerUserId: row.consumerUserId,
      agentKey: row.agentKey ?? null,
      sourceTemplateId: row.sourceTemplateId ?? null,
      title: row.title,
      text: row.text,
      periodicity: row.periodicity,
      timezone: row.timezone,
      schedule: row.schedule,
      enabled: row.enabled,
      nextRunAt: row.nextRunAt ?? null,
      lastRunAt: row.lastRunAt ?? null,
      lastRunKey: row.lastRunKey ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  },
});

export const triggerPushJobNow = mutation({
  args: {
    jobId: v.id("messagePushJobs"),
    nowMs: v.optional(v.number()),
    providerConfig: v.optional(providerConfigValidator),
  },
  returns: v.object({
    enqueuedMessageId: v.id("messageQueue"),
    runKey: v.string(),
  }),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Push job not found");
    }
    const nowMs = args.nowMs ?? Date.now();
    const agentKey = (await resolveActiveAgentKeyForUser(ctx, job.consumerUserId)) ?? job.agentKey;
    if (!agentKey) {
      throw new Error("No active agent binding for user");
    }
    const runKey = `manual:${job._id}:${nowMs}`;
    const messageId = await enqueuePushMessage(ctx, {
      conversationId: `user:${job.consumerUserId}`,
      agentKey,
      consumerUserId: job.consumerUserId,
      text: job.text,
      metadata: {
        pushJobId: String(job._id),
        runKey,
        pushMode: "manual",
      },
      scheduledFor: nowMs,
      providerConfig: args.providerConfig,
    });
    await ctx.db.insert("messagePushDispatches", {
      jobId: job._id,
      consumerUserId: job.consumerUserId,
      runKey,
      scheduledFor: nowMs,
      enqueuedMessageId: messageId,
      status: "enqueued",
      createdAt: nowMs,
    });
    const recurringSchedule = toRecurringSchedule(job.periodicity, job.schedule);
    const nextRunAt =
      job.enabled && recurringSchedule
        ? computeNextRunAt({
            periodicity: recurringSchedule.periodicity,
            schedule: recurringSchedule.schedule,
            timezone: job.timezone,
            fromMs: nowMs,
          })
        : undefined;
    await ctx.db.patch(job._id, {
      agentKey,
      lastRunAt: nowMs,
      lastRunKey: runKey,
      nextRunAt,
      updatedAt: nowMs,
    });
    return {
      enqueuedMessageId: messageId,
      runKey,
    };
  },
});

export const dispatchDuePushJobs = mutation({
  args: {
    nowMs: v.optional(v.number()),
    limit: v.optional(v.number()),
    providerConfig: v.optional(providerConfigValidator),
  },
  returns: v.object({
    scanned: v.number(),
    enqueued: v.number(),
    skipped: v.number(),
    failed: v.number(),
  }),
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now();
    const limit = Math.max(1, Math.min(args.limit ?? 200, 1000));
    const dueJobs = await ctx.db
      .query("messagePushJobs")
      .withIndex("by_enabled_and_nextRunAt", (q) =>
        q.eq("enabled", true).lte("nextRunAt", nowMs),
      )
      .take(limit);

    let enqueued = 0;
    let skipped = 0;
    let failed = 0;
    for (const job of dueJobs) {
      if (job.nextRunAt === undefined) {
        continue;
      }
      const runKey = buildRunKey(job._id, job.nextRunAt);
      const existingDispatch = await ctx.db
        .query("messagePushDispatches")
        .withIndex("by_jobId_and_runKey", (q) => q.eq("jobId", job._id).eq("runKey", runKey))
        .unique();
      if (existingDispatch) {
        skipped += 1;
        await advanceJobNextRun(ctx, job, nowMs, runKey);
        continue;
      }
      const agentKey = (await resolveActiveAgentKeyForUser(ctx, job.consumerUserId)) ?? job.agentKey;
      if (!agentKey) {
        await ctx.db.insert("messagePushDispatches", {
          jobId: job._id,
          consumerUserId: job.consumerUserId,
          runKey,
          scheduledFor: job.nextRunAt,
          status: "failed",
          error: "No active agent binding for user",
          createdAt: nowMs,
        });
        await advanceJobNextRun(ctx, job, nowMs, runKey);
        failed += 1;
        continue;
      }
      try {
        const messageId = await enqueuePushMessage(ctx, {
          conversationId: `user:${job.consumerUserId}`,
          agentKey,
          consumerUserId: job.consumerUserId,
          text: job.text,
          metadata: {
            pushJobId: String(job._id),
            runKey,
            pushMode: "scheduled",
          },
          scheduledFor: nowMs,
          providerConfig: args.providerConfig,
        });
        await ctx.db.insert("messagePushDispatches", {
          jobId: job._id,
          consumerUserId: job.consumerUserId,
          runKey,
          scheduledFor: job.nextRunAt,
          enqueuedMessageId: messageId,
          status: "enqueued",
          createdAt: nowMs,
        });
        await advanceJobNextRun(ctx, { ...job, agentKey }, nowMs, runKey);
        enqueued += 1;
      } catch (error: unknown) {
        const errorMessage = (error && typeof error === "object" && "message" in error)
          ? (error.message as string)
          : "Unknown enqueue error";
        await ctx.db.insert("messagePushDispatches", {
          jobId: job._id,
          consumerUserId: job.consumerUserId,
          runKey,
          scheduledFor: job.nextRunAt,
          status: "failed",
          error: errorMessage,
          createdAt: nowMs,
        });
        await advanceJobNextRun(ctx, job, nowMs, runKey);
        failed += 1;
      }
    }

    return {
      scanned: dueJobs.length,
      enqueued,
      skipped,
      failed,
    };
  },
});

export const sendBroadcastToAllActiveAgents = mutation({
  args: {
    companyId: v.string(),
    title: v.string(),
    text: v.string(),
    requestedBy: v.string(),
    nowMs: v.optional(v.number()),
    providerConfig: v.optional(providerConfigValidator),
  },
  returns: v.object({
    broadcastId: v.id("messagePushBroadcasts"),
    totalTargets: v.number(),
    enqueued: v.number(),
    failed: v.number(),
  }),
  handler: async (ctx, args) => {
    const nowMs = args.nowMs ?? Date.now();
    const targets = await getBroadcastTargets(ctx, args.companyId);
    const broadcastId = await ctx.db.insert("messagePushBroadcasts", {
      companyId: args.companyId,
      title: args.title,
      text: args.text,
      target: "all_active_agents",
      requestedBy: args.requestedBy,
      requestedAt: nowMs,
      status: "running",
      totalTargets: targets.length,
      enqueuedCount: 0,
      failedCount: 0,
    });

    let enqueued = 0;
    let failed = 0;
    for (const target of targets) {
      const targetConsumerUserId = `agent:${target.agentKey}`;
      const existing = await ctx.db
        .query("messagePushBroadcastDispatches")
        .withIndex("by_broadcastId_and_consumerUserId", (q) =>
          q.eq("broadcastId", broadcastId).eq("consumerUserId", targetConsumerUserId),
        )
        .first();
      if (existing) {
        continue;
      }
      const runKey = `broadcast:${broadcastId}:${target.agentKey}`;
      try {
        const messageId = await enqueuePushMessage(ctx, {
          conversationId: `broadcast:agent:${target.agentKey}`,
          agentKey: target.agentKey,
          consumerUserId: targetConsumerUserId,
          text: `${args.title}\n\n${args.text}`.trim(),
          metadata: {
            broadcastId: String(broadcastId),
            runKey,
            adminInitiated: "true",
            companyId: args.companyId,
          },
          scheduledFor: nowMs,
          providerConfig: args.providerConfig,
        });
        await ctx.db.insert("messagePushBroadcastDispatches", {
          broadcastId,
          consumerUserId: targetConsumerUserId,
          agentKey: target.agentKey,
          runKey,
          enqueuedMessageId: messageId,
          status: "enqueued",
          createdAt: nowMs,
        });
        enqueued += 1;
      } catch (error: unknown) {
        const errorMessage = (error && typeof error === "object" && "message" in error)
          ? (error.message as string)
          : "Unknown enqueue error";
        await ctx.db.insert("messagePushBroadcastDispatches", {
          broadcastId,
          consumerUserId: targetConsumerUserId,
          agentKey: target.agentKey,
          runKey,
          status: "failed",
          error: errorMessage,
          createdAt: nowMs,
        });
        failed += 1;
      }
    }

    await ctx.db.patch(broadcastId, {
      status: failed > 0 ? "failed" : "done",
      enqueuedCount: enqueued,
      failedCount: failed,
      completedAt: nowMs,
    });

    return {
      broadcastId,
      totalTargets: targets.length,
      enqueued,
      failed,
    };
  },
});

export const listPushDispatchesByJob = query({
  args: {
    jobId: v.id("messagePushJobs"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("messagePushDispatches"),
      runKey: v.string(),
      status: dispatchStatusValidator,
      scheduledFor: v.number(),
      createdAt: v.number(),
      error: v.union(v.null(), v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 50, 200));
    const rows = await ctx.db
      .query("messagePushDispatches")
      .withIndex("by_jobId_and_runKey", (q) => q.eq("jobId", args.jobId))
      .take(limit);
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return rows.map((row) => ({
      _id: row._id,
      runKey: row.runKey,
      status: row.status,
      scheduledFor: row.scheduledFor,
      createdAt: row.createdAt,
      error: row.error ?? null,
    }));
  },
});

async function enqueuePushMessage(
  ctx: MutationCtx,
  input: {
    conversationId: string;
    agentKey: string;
    consumerUserId: string;
    text: string;
    metadata: Record<string, string>;
    scheduledFor: number;
    providerConfig?: ProviderConfig;
  },
): Promise<Id<"messageQueue">> {
  return await ctx.runMutation((internal.queue as any).enqueueMessage, {
    conversationId: input.conversationId,
    agentKey: input.agentKey,
    payload: {
      provider: "system_push",
      providerUserId: input.consumerUserId,
      messageText: input.text,
      metadata: input.metadata,
    },
    scheduledFor: input.scheduledFor,
    providerConfig: input.providerConfig,
  });
}

async function resolveActiveAgentKeyForUser(ctx: MutationCtx, consumerUserId: string) {
  const binding = await ctx.db
    .query("identityBindings")
    .withIndex("by_consumerUserId_and_status", (q) =>
      q.eq("consumerUserId", consumerUserId).eq("status", "active"),
    )
    .first();
  if (!binding) {
    return null;
  }
  const profile = await ctx.db
    .query("agentProfiles")
    .withIndex("by_agentKey", (q) => q.eq("agentKey", binding.agentKey))
    .unique();
  if (!profile || !profile.enabled) {
    return null;
  }
  return binding.agentKey;
}

async function advanceJobNextRun(
  ctx: MutationCtx,
  job: {
    _id: Id<"messagePushJobs">;
    periodicity: Periodicity;
    schedule: Schedule;
    timezone: string;
    enabled: boolean;
    agentKey?: string;
  },
  nowMs: number,
  runKey: string,
) {
  const recurringSchedule = toRecurringSchedule(job.periodicity, job.schedule);
  const nextRunAt =
    job.enabled && recurringSchedule
      ? computeNextRunAt({
          periodicity: recurringSchedule.periodicity,
          schedule: recurringSchedule.schedule,
          timezone: job.timezone,
          fromMs: nowMs,
        })
      : undefined;
  await ctx.db.patch(job._id, {
    agentKey: job.agentKey,
    lastRunAt: nowMs,
    lastRunKey: runKey,
    nextRunAt,
    updatedAt: nowMs,
  });
}

async function getBroadcastTargets(ctx: MutationCtx, _companyId: string) {
  const enabledProfiles = await ctx.db
    .query("agentProfiles")
    .withIndex("by_enabled", (q) => q.eq("enabled", true))
    .collect();
  return enabledProfiles.map((profile) => ({
    agentKey: profile.agentKey,
  }));
}

function resolveScheduleForTemplate(
  periodicity: Periodicity,
  suggestedTimes: Array<SuggestedTime>,
  providedSchedule: Schedule | undefined,
): Schedule {
  if (periodicity === "manual") {
    return { kind: "manual" } as const;
  }
  if (providedSchedule) {
    return providedSchedule;
  }
  const fallback = suggestedTimes.find((time) => time.kind === periodicity);
  if (!fallback) {
    throw new Error("Schedule is required for non-manual template");
  }
  return fallback;
}

function validateTemplateTimes(
  periodicity: Periodicity,
  suggestedTimes: Array<SuggestedTime>,
) {
  if (periodicity === "manual") {
    if (suggestedTimes.length > 0) {
      throw new Error("Manual template does not accept suggested times");
    }
    return;
  }
  for (const time of suggestedTimes) {
    if (time.kind !== periodicity) {
      throw new Error("All suggested times must match template periodicity");
    }
    assertScheduleSlotValidity(time);
  }
}

function validateSchedule(
  periodicity: Periodicity,
  schedule: Schedule,
) {
  if (schedule.kind !== periodicity) {
    throw new Error("Schedule kind must match periodicity");
  }
  assertScheduleSlotValidity(schedule);
}

function assertScheduleSlotValidity(
  schedule: Schedule,
) {
  if (schedule.kind === "manual") {
    return;
  }
  parseTimeString(schedule.time);
  if (schedule.kind === "weekly") {
    if (!Number.isInteger(schedule.weekday) || schedule.weekday < 1 || schedule.weekday > 7) {
      throw new Error("Weekly schedule weekday must be in range 1..7");
    }
  }
  if (schedule.kind === "monthly") {
    if (
      schedule.dayOfMonth !== "last" &&
      (!Number.isInteger(schedule.dayOfMonth) || schedule.dayOfMonth < 1 || schedule.dayOfMonth > 31)
    ) {
      throw new Error("Monthly schedule dayOfMonth must be 1..31 or 'last'");
    }
  }
}

function assertValidTimezone(timezone: string) {
  if (!timezone || !timezone.trim()) {
    throw new Error("Timezone is required");
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
  } catch {
    throw new Error(`Invalid timezone '${timezone}'`);
  }
}

function buildRunKey(jobId: string, scheduledFor: number) {
  return `scheduled:${jobId}:${scheduledFor}`;
}

function computeNextRunAt(input: {
  periodicity: RecurringPeriodicity;
  schedule: RecurringSchedule;
  timezone: string;
  fromMs: number;
}) {
  const fromMs = input.fromMs + 1_000;
  if (input.schedule.kind === "daily") {
    const { hour, minute } = parseTimeString(input.schedule.time);
    return findNextDailyUtcMs(fromMs, input.timezone, hour, minute);
  }
  if (input.schedule.kind === "weekly") {
    const { hour, minute } = parseTimeString(input.schedule.time);
    return findNextWeeklyUtcMs(fromMs, input.timezone, input.schedule.weekday, hour, minute);
  }
  const { hour, minute } = parseTimeString(input.schedule.time);
  return findNextMonthlyUtcMs(fromMs, input.timezone, input.schedule.dayOfMonth, hour, minute);
}

function toRecurringSchedule(
  periodicity: Periodicity,
  schedule: Schedule,
): { periodicity: RecurringPeriodicity; schedule: RecurringSchedule } | null {
  if (periodicity === "manual") return null;
  if (schedule.kind === "manual") {
    throw new Error("Recurring periodicity requires a non-manual schedule");
  }
  return {
    periodicity,
    schedule,
  };
}

function parseTimeString(time: string) {
  const trimmed = time.trim();
  const match = trimmed.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) {
    throw new Error(`Invalid time '${time}', expected HH:mm`);
  }
  return {
    hour: Number.parseInt(match[1], 10),
    minute: Number.parseInt(match[2], 10),
  };
}

function getZonedDateParts(timestampMs: number, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date(timestampMs));
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }
  return {
    year: Number.parseInt(map.year, 10),
    month: Number.parseInt(map.month, 10),
    day: Number.parseInt(map.day, 10),
    hour: Number.parseInt(map.hour, 10),
    minute: Number.parseInt(map.minute, 10),
    second: Number.parseInt(map.second, 10),
    weekday: parseWeekday(map.weekday),
  };
}

function parseWeekday(weekday: string) {
  switch (weekday.toLowerCase()) {
    case "mon":
      return 1;
    case "tue":
      return 2;
    case "wed":
      return 3;
    case "thu":
      return 4;
    case "fri":
      return 5;
    case "sat":
      return 6;
    case "sun":
      return 7;
    default:
      throw new Error(`Unsupported weekday '${weekday}'`);
  }
}

function zonedLocalToUtcMs(
  timezone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
) {
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  for (let i = 0; i < 3; i += 1) {
    const offsetMs = getTimeZoneOffsetMs(guess, timezone);
    const nextGuess = Date.UTC(year, month - 1, day, hour, minute, 0, 0) - offsetMs;
    if (nextGuess === guess) break;
    guess = nextGuess;
  }
  return guess;
}

function getTimeZoneOffsetMs(timestampMs: number, timezone: string) {
  const parts = getZonedDateParts(timestampMs, timezone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    0,
  );
  return asUtc - timestampMs;
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function findNextDailyUtcMs(fromMs: number, timezone: string, hour: number, minute: number) {
  const base = getZonedDateParts(fromMs, timezone);
  for (let addDays = 0; addDays < 370; addDays += 1) {
    const dayUtc = Date.UTC(base.year, base.month - 1, base.day + addDays, 0, 0, 0, 0);
    const local = getZonedDateParts(dayUtc, timezone);
    const candidate = zonedLocalToUtcMs(timezone, local.year, local.month, local.day, hour, minute);
    if (candidate > fromMs) return candidate;
  }
  throw new Error("Unable to compute next daily run");
}

function findNextWeeklyUtcMs(
  fromMs: number,
  timezone: string,
  weekday: number,
  hour: number,
  minute: number,
) {
  const base = getZonedDateParts(fromMs, timezone);
  for (let addDays = 0; addDays < 380; addDays += 1) {
    const dayUtc = Date.UTC(base.year, base.month - 1, base.day + addDays, 0, 0, 0, 0);
    const local = getZonedDateParts(dayUtc, timezone);
    if (local.weekday !== weekday) continue;
    const candidate = zonedLocalToUtcMs(timezone, local.year, local.month, local.day, hour, minute);
    if (candidate > fromMs) return candidate;
  }
  throw new Error("Unable to compute next weekly run");
}

function findNextMonthlyUtcMs(
  fromMs: number,
  timezone: string,
  dayOfMonth: number | "last",
  hour: number,
  minute: number,
) {
  const base = getZonedDateParts(fromMs, timezone);
  for (let addMonths = 0; addMonths < 36; addMonths += 1) {
    const monthBaseUtc = Date.UTC(base.year, base.month - 1 + addMonths, 1, 0, 0, 0, 0);
    const local = getZonedDateParts(monthBaseUtc, timezone);
    const monthMaxDay = daysInMonth(local.year, local.month);
    const day =
      dayOfMonth === "last"
        ? monthMaxDay
        : Math.min(dayOfMonth, monthMaxDay);
    const candidate = zonedLocalToUtcMs(timezone, local.year, local.month, day, hour, minute);
    if (candidate > fromMs) return candidate;
  }
  throw new Error("Unable to compute next monthly run");
}

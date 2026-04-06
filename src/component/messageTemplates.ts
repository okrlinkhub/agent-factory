import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";
import type { MutationCtx } from "./_generated/server.js";

const messageTemplateViewValidator = v.object({
  _id: v.id("messageTemplates"),
  templateKey: v.string(),
  title: v.string(),
  text: v.string(),
  tags: v.array(v.string()),
  usageCount: v.number(),
  enabled: v.boolean(),
  createdBy: v.string(),
  updatedBy: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

function normalizeTemplateKey(value: string) {
  return value.trim().toLowerCase();
}

function buildTemplateKeyBase(title: string) {
  const normalized = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "message-template";
}

function normalizeTitle(value: string) {
  return value.trim();
}

function normalizeText(value: string) {
  return value.trim();
}

function normalizeTags(tags: Array<string>) {
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

function validateMessageTemplateFields(input: {
  title?: string;
  text?: string;
}) {
  if (input.title !== undefined && input.title.length === 0) {
    throw new Error("Template title is required");
  }
  if (input.text !== undefined && input.text.length === 0) {
    throw new Error("Template text is required");
  }
}

async function resolveUniqueTemplateKey(
  ctx: MutationCtx,
  title: string,
  currentTemplateId?: string,
) {
  const baseKey = buildTemplateKeyBase(title);
  let candidate = baseKey;
  let suffix = 2;

  while (true) {
    const existing = await ctx.db
      .query("messageTemplates")
      .withIndex("by_templateKey", (q) => q.eq("templateKey", candidate))
      .unique();
    if (!existing || String(existing._id) === currentTemplateId) {
      return candidate;
    }
    candidate = `${baseKey}-${suffix}`;
    suffix += 1;
  }
}

export const createMessageTemplate = mutation({
  args: {
    title: v.string(),
    text: v.string(),
    tags: v.array(v.string()),
    enabled: v.optional(v.boolean()),
    actorUserId: v.string(),
    nowMs: v.optional(v.number()),
  },
  returns: v.id("messageTemplates"),
  handler: async (ctx, args) => {
    const title = normalizeTitle(args.title);
    const text = normalizeText(args.text);
    const tags = normalizeTags(args.tags);
    validateMessageTemplateFields({ title, text });
    const templateKey = normalizeTemplateKey(await resolveUniqueTemplateKey(ctx, title));

    const nowMs = args.nowMs ?? Date.now();
    return await ctx.db.insert("messageTemplates", {
      templateKey,
      title,
      text,
      tags,
      usageCount: 0,
      enabled: args.enabled ?? true,
      createdBy: args.actorUserId,
      updatedBy: args.actorUserId,
      createdAt: nowMs,
      updatedAt: nowMs,
    });
  },
});

export const updateMessageTemplate = mutation({
  args: {
    templateId: v.id("messageTemplates"),
    title: v.optional(v.string()),
    text: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    enabled: v.optional(v.boolean()),
    actorUserId: v.string(),
    nowMs: v.optional(v.number()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    if (!template) return false;

    const title = args.title !== undefined ? normalizeTitle(args.title) : template.title;
    const text = args.text !== undefined ? normalizeText(args.text) : template.text;
    const tags = args.tags !== undefined ? normalizeTags(args.tags) : template.tags;
    validateMessageTemplateFields({ title, text });
    const templateKey =
      title !== template.title
        ? normalizeTemplateKey(await resolveUniqueTemplateKey(ctx, title, String(template._id)))
        : template.templateKey;

    const nowMs = args.nowMs ?? Date.now();
    await ctx.db.patch(template._id, {
      templateKey,
      title,
      text,
      tags,
      enabled: args.enabled ?? template.enabled,
      updatedBy: args.actorUserId,
      updatedAt: nowMs,
    });
    return true;
  },
});

export const deleteMessageTemplate = mutation({
  args: {
    templateId: v.id("messageTemplates"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    if (!template) return false;
    await ctx.db.delete(template._id);
    return true;
  },
});

export const listMessageTemplatesByCompany = query({
  args: {
    includeDisabled: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  returns: v.array(messageTemplateViewValidator),
  handler: async (ctx, args) => {
    const includeDisabled = args.includeDisabled ?? false;
    const limit = Math.max(1, Math.min(args.limit ?? 100, 200));

    const rows = includeDisabled
      ? await ctx.db.query("messageTemplates").take(limit)
      : await ctx.db
          .query("messageTemplates")
          .withIndex("by_enabled", (q) => q.eq("enabled", true))
          .take(limit);

    rows.sort((left, right) => {
      if (right.usageCount !== left.usageCount) {
        return right.usageCount - left.usageCount;
      }
      return right.updatedAt - left.updatedAt;
    });
    return rows.map((row) => ({
      _id: row._id,
      templateKey: row.templateKey,
      title: row.title,
      text: row.text,
      tags: row.tags,
      usageCount: row.usageCount,
      enabled: row.enabled,
      createdBy: row.createdBy,
      updatedBy: row.updatedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  },
});

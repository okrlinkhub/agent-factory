import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    handle: v.string(),
    displayName: v.string(),
  }).index("by_handle", ["handle"]),
});

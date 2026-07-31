import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  aliases: defineTable({
    aliasContentId: v.string(),
    space: v.string(),
    targetContentId: v.string(),
  })
    .index("by_space_alias", ["space", "aliasContentId"])
    .index("by_space_target", ["space", "targetContentId"]),
  content: defineTable({
    contentId: v.string(),
    revision: v.number(),
    sourceFingerprint: v.string(),
    sourceText: v.string(),
    space: v.string(),
    text: v.optional(v.string()),
  }).index("by_space_content", ["space", "contentId"]),
  requests: defineTable({
    contentId: v.string(),
    identity: v.string(),
    requestId: v.string(),
    result: v.any(),
    space: v.string(),
  })
    .index("by_space_request", ["space", "requestId"])
    .index("by_space_content", ["space", "contentId"]),
});

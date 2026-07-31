import {
  __require
} from "./index-6j5pq722.js";

// src/component/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
var schema_default = defineSchema({
  aliases: defineTable({
    aliasContentId: v.string(),
    space: v.string(),
    targetContentId: v.string()
  }).index("by_space_alias", ["space", "aliasContentId"]).index("by_space_target", ["space", "targetContentId"]),
  content: defineTable({
    contentId: v.string(),
    revision: v.number(),
    sourceFingerprint: v.string(),
    sourceText: v.string(),
    space: v.string(),
    text: v.optional(v.string())
  }).index("by_space_content", ["space", "contentId"]),
  requests: defineTable({
    contentId: v.string(),
    identity: v.string(),
    requestId: v.string(),
    result: v.any(),
    space: v.string()
  }).index("by_space_request", ["space", "requestId"]).index("by_space_content", ["space", "contentId"])
});

// src/test.ts
var modules = {
  "./component/_generated/api.ts": async () => await import("./api-d1gtxx58.js"),
  "./component/_generated/server.ts": async () => await import("./server-s2p484g4.js"),
  "./component/persistence.ts": async () => await import("./persistence-z4tephpk.js")
};
function register(test, name = "mallleableText") {
  test.registerComponent(name, schema_default, modules);
}
var test_default = { modules, register, schema: schema_default };
export {
  register,
  modules,
  test_default as default
};

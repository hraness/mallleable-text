import { componentsGeneric, mutationGeneric } from "convex/server";
import { v } from "convex/values";

import type { ComponentApi } from "../component/_generated/component.js";
import {
  parseComponentMigrateAliasesRequest,
  parseWriteResult,
  type WriteResult,
} from "../model.js";
import { exposeApi } from "./index.js";

const components = componentsGeneric() as unknown as {
  mallleableText: ComponentApi;
};

function field(value: unknown, name: string): unknown {
  return typeof value === "object" && value !== null
    ? Reflect.get(value, name)
    : undefined;
}

export const { migrateAliases, replaceText, resetText, resolveBatch } =
  exposeApi(components.mallleableText, {
    authorize: async (ctx, operation) => {
      const identity = await ctx.auth.getUserIdentity();
      if (identity === null) return null;
      const users = await ctx.db.query("hostUsers").collect();
      const user = users.find(
        (candidate) => field(candidate, "subject") === identity.subject,
      );
      const capabilities = field(user, "capabilities");
      return {
        actorId: `host-user:${identity.subject}`,
        canEdit:
          field(capabilities, "hraness/mallleable-text:admin") === true
          && operation.contentId !== "home.protected",
      };
    },
  });

export const seedAlias = mutationGeneric({
  args: { request: v.any() },
  returns: v.any(),
  handler: async (ctx, args): Promise<WriteResult> => {
    const request = parseComponentMigrateAliasesRequest(args.request);
    if (request.status === "invalid") throw new Error(request.code);
    const result: unknown = await ctx.runMutation(
      components.mallleableText.persistence.migrateAliases,
      { request: request.value },
    );
    const write = parseWriteResult(result, request.value.requestId);
    if (write.status === "invalid") throw new Error(write.code);
    return write.value;
  },
});

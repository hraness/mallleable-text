import type {
  GenericDataModel,
  GenericMutationCtx,
} from "convex/server";
import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

import type { ComponentApi } from "../component/_generated/component.js";
import {
  MALLLEABLE_TEXT_LIMITS,
  parseActorId,
  parseAuthorizationTargetsResult,
  parseMigrateAliasesRequest,
  parseReplaceTextRequest,
  parseResetTextRequest,
  parseResolveBatchRequest,
  parseResolveBatchResult,
  parseWriteResult,
  referenceFromDescriptor,
  type InvalidCode,
  type MigrateAliasesRequest,
  type ReplaceTextRequest,
  type ResetTextRequest,
  type ResolveBatchResult,
  type WriteResult,
} from "../model.js";

export * from "../model.js";

export type AuthorizeOperation = Readonly<{
  canonicalContentId: string;
  contentId: string;
  isLegacyContentId: boolean;
  space: string;
  type: "migrateAliases" | "replaceText" | "resetText";
}>;

export type AuthorizationDecision =
  | Readonly<{ actorId: string; canEdit: true }>
  | Readonly<{ canEdit: false }>
  | null;

export type ExposeApiOptions = Readonly<{
  authorize: (
    ctx: AuthorizationContext,
    operation: AuthorizeOperation,
  ) => Promise<unknown>;
}>;

export type AuthorizationContext = Readonly<
  Pick<GenericMutationCtx<GenericDataModel>, "auth" | "db" | "runQuery">
>;

function requestIdFromUnknown(value: unknown): string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return "";
  }
  const requestId = (value as Record<string, unknown>).requestId;
  return typeof requestId === "string" &&
    requestId.length <= MALLLEABLE_TEXT_LIMITS.requestIdLength
    ? requestId
    : "";
}

function invalidWrite(requestId: string, code: InvalidCode): WriteResult {
  return { code, requestId, status: "invalid" };
}

function parseAuthorization(value: unknown): AuthorizationDecision {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const canEdit = record.canEdit;
  if (canEdit !== true) return { canEdit: false };
  const actorId = parseActorId(record.actorId);
  if (actorId.status === "invalid") return { canEdit: false };
  return { actorId: actorId.value, canEdit: true };
}

async function authorizeWrite(
  options: ExposeApiOptions,
  ctx: AuthorizationContext,
  operation: Readonly<{
    canonicalContentId: string;
    contentIds: readonly string[];
    space: string;
    type: AuthorizeOperation["type"];
  }>,
  requestId: string,
): Promise<
  | Readonly<{ actorId: string; status: "authorized" }>
  | Extract<WriteResult, { status: "forbidden" | "retryable" }>
> {
  let actorId: string | null = null;
  for (const contentId of operation.contentIds) {
    let rawDecision: unknown;
    try {
      rawDecision = await options.authorize(ctx, {
        canonicalContentId: operation.canonicalContentId,
        contentId,
        isLegacyContentId: contentId !== operation.canonicalContentId,
        space: operation.space,
        type: operation.type,
      });
    } catch {
      return {
        code: "authorization_unavailable",
        requestId,
        status: "retryable",
      };
    }
    const decision = parseAuthorization(rawDecision);
    if (decision?.canEdit !== true) return { requestId, status: "forbidden" };
    if (actorId !== null && actorId !== decision.actorId) {
      return { requestId, status: "forbidden" };
    }
    actorId = decision.actorId;
  }
  return actorId === null
    ? { requestId, status: "forbidden" }
    : { actorId, status: "authorized" };
}

async function runAuthorizedWrite(
  options: ExposeApiOptions,
  ctx: Pick<
    GenericMutationCtx<GenericDataModel>,
    "auth" | "db" | "runMutation" | "runQuery"
  >,
  componentFunction: ComponentApi["persistence"][
    "migrateAliases" | "replaceText" | "resetText"
  ],
  authorizationFunction: ComponentApi["persistence"]["authorizationTargets"],
  operation: Readonly<{
    space: string;
    type: AuthorizeOperation["type"];
  }>,
  request:
    | MigrateAliasesRequest
    | ReplaceTextRequest
    | ResetTextRequest,
): Promise<WriteResult> {
  let rawTargets: unknown;
  try {
    rawTargets = await ctx.runQuery(authorizationFunction, {
      reference: referenceFromDescriptor(request.descriptor),
    });
  } catch {
    return {
      code: "component_unavailable",
      requestId: request.requestId,
      status: "retryable",
    };
  }
  const parsedTargets = parseAuthorizationTargetsResult(rawTargets);
  if (parsedTargets.status === "invalid") {
    return {
      code: "component_unavailable",
      requestId: request.requestId,
      status: "retryable",
    };
  }
  const targets = parsedTargets.value;
  if (targets.status === "invalid") {
    return invalidWrite(request.requestId, targets.code);
  }
  if (targets.status === "conflict") {
    return {
      code: targets.code,
      currentRevision: null,
      requestId: request.requestId,
      status: "conflict",
    };
  }
  if (targets.space !== operation.space) {
    return {
      code: "component_unavailable",
      requestId: request.requestId,
      status: "retryable",
    };
  }
  const authorization = await authorizeWrite(
    options,
    ctx,
    {
      canonicalContentId: targets.canonicalContentId,
      contentIds: targets.contentIds,
      space: targets.space,
      type: operation.type,
    },
    request.requestId,
  );
  if (authorization.status !== "authorized") return authorization;
  let rawResult: unknown;
  try {
    rawResult = await ctx.runMutation(componentFunction, {
      request: { ...request, actorId: authorization.actorId },
    });
  } catch {
    return {
      code: "component_unavailable",
      requestId: request.requestId,
      status: "retryable",
    };
  }
  const result = parseWriteResult(rawResult, request.requestId);
  if (result.status === "invalid") {
    return {
      code: "component_unavailable",
      requestId: request.requestId,
      status: "retryable",
    };
  }
  return result.value;
}

export function exposeApi(
  component: ComponentApi,
  options: ExposeApiOptions,
) {
  return {
    migrateAliases: mutationGeneric({
      args: { request: v.any() },
      returns: v.any(),
      handler: async (ctx, args): Promise<WriteResult> => {
        const parsed = parseMigrateAliasesRequest(args.request);
        if (parsed.status === "invalid") {
          return invalidWrite(requestIdFromUnknown(args.request), parsed.code);
        }
        const { descriptor } = parsed.value;
        return await runAuthorizedWrite(
          options,
          ctx,
          component.persistence.migrateAliases,
          component.persistence.authorizationTargets,
          {
            space: descriptor.space,
            type: "migrateAliases",
          },
          parsed.value,
        );
      },
    }),
    replaceText: mutationGeneric({
      args: { request: v.any() },
      returns: v.any(),
      handler: async (ctx, args): Promise<WriteResult> => {
        const parsed = parseReplaceTextRequest(args.request);
        if (parsed.status === "invalid") {
          return invalidWrite(requestIdFromUnknown(args.request), parsed.code);
        }
        const { descriptor } = parsed.value;
        return await runAuthorizedWrite(
          options,
          ctx,
          component.persistence.replaceText,
          component.persistence.authorizationTargets,
          {
            space: descriptor.space,
            type: "replaceText",
          },
          parsed.value,
        );
      },
    }),
    resetText: mutationGeneric({
      args: { request: v.any() },
      returns: v.any(),
      handler: async (ctx, args): Promise<WriteResult> => {
        const parsed = parseResetTextRequest(args.request);
        if (parsed.status === "invalid") {
          return invalidWrite(requestIdFromUnknown(args.request), parsed.code);
        }
        const { descriptor } = parsed.value;
        return await runAuthorizedWrite(
          options,
          ctx,
          component.persistence.resetText,
          component.persistence.authorizationTargets,
          {
            space: descriptor.space,
            type: "resetText",
          },
          parsed.value,
        );
      },
    }),
    resolveBatch: queryGeneric({
      args: { requests: v.any() },
      returns: v.any(),
      handler: async (ctx, args): Promise<ResolveBatchResult> => {
        const parsed = parseResolveBatchRequest(args.requests);
        if (parsed.status === "invalid") return parsed;
        let rawResult: unknown;
        try {
          rawResult = await ctx.runQuery(component.persistence.resolveBatch, {
            requests: parsed.value,
          });
        } catch {
          return { code: "invalid_batch", status: "invalid" };
        }
        const result = parseResolveBatchResult(rawResult);
        return result.status === "valid"
          ? result.value
          : { code: "invalid_batch", status: "invalid" };
      },
    }),
  };
}

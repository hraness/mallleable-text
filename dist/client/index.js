import {
  MALLLEABLE_TEXT_LIMITS,
  applyTextRange,
  parseActorId,
  parseAuthorizationTargetsResult,
  parseComponentMigrateAliasesRequest,
  parseComponentReplaceTextRequest,
  parseComponentResetTextRequest,
  parseContentDescriptor,
  parseContentId,
  parseContentReference,
  parseMigrateAliasesRequest,
  parseReplaceTextRequest,
  parseRequestId,
  parseResetTextRequest,
  parseResolveBatchRequest,
  parseResolveBatchResult,
  parseRevision,
  parseSourceFingerprint,
  parseSpace,
  parseText,
  parseTextRange,
  parseWriteResult,
  rangeMatchesText,
  referenceFromDescriptor,
  resolveClientContent,
  sourceFingerprint,
  textRangeFromSelection
} from "../index-18tekesf.js";
import"../index-6j5pq722.js";

// src/client/index.ts
import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
function requestIdFromUnknown(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return "";
  }
  const requestId = value.requestId;
  return typeof requestId === "string" && requestId.length <= MALLLEABLE_TEXT_LIMITS.requestIdLength ? requestId : "";
}
function invalidWrite(requestId, code) {
  return { code, requestId, status: "invalid" };
}
function parseAuthorization(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value;
  const canEdit = record.canEdit;
  if (canEdit !== true)
    return { canEdit: false };
  const actorId = parseActorId(record.actorId);
  if (actorId.status === "invalid")
    return { canEdit: false };
  return { actorId: actorId.value, canEdit: true };
}
async function authorizeWrite(options, ctx, operation, requestId) {
  let actorId = null;
  for (const contentId of operation.contentIds) {
    let rawDecision;
    try {
      rawDecision = await options.authorize(ctx, {
        canonicalContentId: operation.canonicalContentId,
        contentId,
        isLegacyContentId: contentId !== operation.canonicalContentId,
        space: operation.space,
        type: operation.type
      });
    } catch {
      return {
        code: "authorization_unavailable",
        requestId,
        status: "retryable"
      };
    }
    const decision = parseAuthorization(rawDecision);
    if (decision?.canEdit !== true)
      return { requestId, status: "forbidden" };
    if (actorId !== null && actorId !== decision.actorId) {
      return { requestId, status: "forbidden" };
    }
    actorId = decision.actorId;
  }
  return actorId === null ? { requestId, status: "forbidden" } : { actorId, status: "authorized" };
}
async function runAuthorizedWrite(options, ctx, componentFunction, authorizationFunction, operation, request) {
  let rawTargets;
  try {
    rawTargets = await ctx.runQuery(authorizationFunction, {
      reference: referenceFromDescriptor(request.descriptor)
    });
  } catch {
    return {
      code: "component_unavailable",
      requestId: request.requestId,
      status: "retryable"
    };
  }
  const parsedTargets = parseAuthorizationTargetsResult(rawTargets);
  if (parsedTargets.status === "invalid") {
    return {
      code: "component_unavailable",
      requestId: request.requestId,
      status: "retryable"
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
      status: "conflict"
    };
  }
  if (targets.space !== operation.space) {
    return {
      code: "component_unavailable",
      requestId: request.requestId,
      status: "retryable"
    };
  }
  const authorization = await authorizeWrite(options, ctx, {
    canonicalContentId: targets.canonicalContentId,
    contentIds: targets.contentIds,
    space: targets.space,
    type: operation.type
  }, request.requestId);
  if (authorization.status !== "authorized")
    return authorization;
  let rawResult;
  try {
    rawResult = await ctx.runMutation(componentFunction, {
      request: { ...request, actorId: authorization.actorId }
    });
  } catch {
    return {
      code: "component_unavailable",
      requestId: request.requestId,
      status: "retryable"
    };
  }
  const result = parseWriteResult(rawResult, request.requestId);
  if (result.status === "invalid") {
    return {
      code: "component_unavailable",
      requestId: request.requestId,
      status: "retryable"
    };
  }
  return result.value;
}
function exposeApi(component, options) {
  return {
    migrateAliases: mutationGeneric({
      args: { request: v.any() },
      returns: v.any(),
      handler: async (ctx, args) => {
        const parsed = parseMigrateAliasesRequest(args.request);
        if (parsed.status === "invalid") {
          return invalidWrite(requestIdFromUnknown(args.request), parsed.code);
        }
        const { descriptor } = parsed.value;
        return await runAuthorizedWrite(options, ctx, component.persistence.migrateAliases, component.persistence.authorizationTargets, {
          space: descriptor.space,
          type: "migrateAliases"
        }, parsed.value);
      }
    }),
    replaceText: mutationGeneric({
      args: { request: v.any() },
      returns: v.any(),
      handler: async (ctx, args) => {
        const parsed = parseReplaceTextRequest(args.request);
        if (parsed.status === "invalid") {
          return invalidWrite(requestIdFromUnknown(args.request), parsed.code);
        }
        const { descriptor } = parsed.value;
        return await runAuthorizedWrite(options, ctx, component.persistence.replaceText, component.persistence.authorizationTargets, {
          space: descriptor.space,
          type: "replaceText"
        }, parsed.value);
      }
    }),
    resetText: mutationGeneric({
      args: { request: v.any() },
      returns: v.any(),
      handler: async (ctx, args) => {
        const parsed = parseResetTextRequest(args.request);
        if (parsed.status === "invalid") {
          return invalidWrite(requestIdFromUnknown(args.request), parsed.code);
        }
        const { descriptor } = parsed.value;
        return await runAuthorizedWrite(options, ctx, component.persistence.resetText, component.persistence.authorizationTargets, {
          space: descriptor.space,
          type: "resetText"
        }, parsed.value);
      }
    }),
    resolveBatch: queryGeneric({
      args: { requests: v.any() },
      returns: v.any(),
      handler: async (ctx, args) => {
        const parsed = parseResolveBatchRequest(args.requests);
        if (parsed.status === "invalid")
          return parsed;
        let rawResult;
        try {
          rawResult = await ctx.runQuery(component.persistence.resolveBatch, {
            requests: parsed.value
          });
        } catch {
          return { code: "invalid_batch", status: "invalid" };
        }
        const result = parseResolveBatchResult(rawResult);
        return result.status === "valid" ? result.value : { code: "invalid_batch", status: "invalid" };
      }
    })
  };
}
export {
  textRangeFromSelection,
  sourceFingerprint,
  resolveClientContent,
  referenceFromDescriptor,
  rangeMatchesText,
  parseWriteResult,
  parseTextRange,
  parseText,
  parseSpace,
  parseSourceFingerprint,
  parseRevision,
  parseResolveBatchResult,
  parseResolveBatchRequest,
  parseResetTextRequest,
  parseRequestId,
  parseReplaceTextRequest,
  parseMigrateAliasesRequest,
  parseContentReference,
  parseContentId,
  parseContentDescriptor,
  parseComponentResetTextRequest,
  parseComponentReplaceTextRequest,
  parseComponentMigrateAliasesRequest,
  parseAuthorizationTargetsResult,
  parseActorId,
  exposeApi,
  applyTextRange,
  MALLLEABLE_TEXT_LIMITS
};

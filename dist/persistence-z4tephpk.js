import {
  MALLLEABLE_TEXT_LIMITS,
  applyTextRange,
  parseComponentMigrateAliasesRequest,
  parseComponentReplaceTextRequest,
  parseComponentResetTextRequest,
  parseResolveBatchRequest,
  parseWriteResult
} from "./index-18tekesf.js";
import {
  mutation,
  query
} from "./index-3y8hjpcr.js";
import"./index-6j5pq722.js";

// src/component/persistence.ts
import { v } from "convex/values";

class AnalysisLimitExceeded extends Error {
}
var maximumAliasHops = MALLLEABLE_TEXT_LIMITS.aliasHops;
function createAnalysisCache() {
  return {
    aliasRows: new Map,
    contentRows: new Map,
    inboundAliasClosures: new Map,
    inboundAliasRows: new Map,
    lookups: 0
  };
}
function analysisKey(space, contentId) {
  return `${space}\x00${contentId}`;
}
function consumeAnalysisLookup(cache) {
  if (cache.lookups >= MALLLEABLE_TEXT_LIMITS.analysisLookups) {
    throw new AnalysisLimitExceeded;
  }
  cache.lookups += 1;
}
function responseRequestId(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return "";
  }
  const requestId = value.requestId;
  return typeof requestId === "string" && requestId.length <= MALLLEABLE_TEXT_LIMITS.requestIdLength ? requestId : "";
}
function invalidResult(requestId, code) {
  return { code, requestId, status: "invalid" };
}
async function aliasRows(db, space, aliasContentId, cache) {
  const load = async () => await db.query("aliases").withIndex("by_space_alias", (index) => index.eq("space", space).eq("aliasContentId", aliasContentId)).take(2);
  if (cache === undefined)
    return await load();
  const key = analysisKey(space, aliasContentId);
  const existing = cache.aliasRows.get(key);
  if (existing !== undefined)
    return await existing;
  consumeAnalysisLookup(cache);
  const pending = load();
  cache.aliasRows.set(key, pending);
  return await pending;
}
async function resolveAlias(db, space, start, cache) {
  const path = [];
  const seen = new Set;
  let current = start;
  for (let hop = 0;hop < maximumAliasHops; hop += 1) {
    if (seen.has(current))
      return { code: "alias_cycle", status: "conflict" };
    seen.add(current);
    path.push(current);
    const rows = await aliasRows(db, space, current, cache);
    if (rows.length > 1) {
      return { code: "alias_collision", status: "conflict" };
    }
    const row = rows[0];
    if (row === undefined) {
      return { path, root: current, status: "resolved" };
    }
    current = row.targetContentId;
  }
  return { code: "alias_cycle", status: "conflict" };
}
async function inboundAliasRows(db, space, targetContentId, cache) {
  const key = analysisKey(space, targetContentId);
  const existing = cache.inboundAliasRows.get(key);
  if (existing !== undefined)
    return await existing;
  consumeAnalysisLookup(cache);
  const pending = db.query("aliases").withIndex("by_space_target", (index) => index.eq("space", space).eq("targetContentId", targetContentId)).take(MALLLEABLE_TEXT_LIMITS.analysisLookups + 1);
  cache.inboundAliasRows.set(key, pending);
  const rows = await pending;
  if (rows.length > MALLLEABLE_TEXT_LIMITS.analysisLookups) {
    throw new AnalysisLimitExceeded;
  }
  return rows;
}
async function resolveInboundAliasClosure(db, space, root, cache) {
  const key = analysisKey(space, root);
  const existing = cache.inboundAliasClosures.get(key);
  if (existing !== undefined)
    return await existing;
  const pending = (async () => {
    const contentIds = new Set([root]);
    const queue = [
      { contentId: root, depth: 0 }
    ];
    for (let cursor = 0;cursor < queue.length; cursor += 1) {
      const current = queue[cursor];
      if (current === undefined)
        break;
      const rows = await inboundAliasRows(db, space, current.contentId, cache);
      if (current.depth >= maximumAliasHops - 1 && rows.length > 0) {
        return { code: "alias_cycle", status: "conflict" };
      }
      for (const row of rows) {
        const outgoing = await aliasRows(db, space, row.aliasContentId, cache);
        if (outgoing.length !== 1 || outgoing[0]?.targetContentId !== current.contentId) {
          return { code: "alias_collision", status: "conflict" };
        }
        if (contentIds.has(row.aliasContentId)) {
          return { code: "alias_cycle", status: "conflict" };
        }
        contentIds.add(row.aliasContentId);
        queue.push({
          contentId: row.aliasContentId,
          depth: current.depth + 1
        });
      }
    }
    return { contentIds: [...contentIds], status: "resolved" };
  })();
  cache.inboundAliasClosures.set(key, pending);
  return await pending;
}
async function findContent(db, space, contentIds, cache) {
  const documents = [];
  for (const contentId of contentIds) {
    const key = analysisKey(space, contentId);
    let pending = cache.contentRows.get(key);
    if (pending === undefined) {
      consumeAnalysisLookup(cache);
      pending = db.query("content").withIndex("by_space_content", (index) => index.eq("space", space).eq("contentId", contentId)).take(2);
      cache.contentRows.set(key, pending);
    }
    const rows = await pending;
    if (rows.length > 1) {
      return { code: "alias_collision", status: "conflict" };
    }
    const row = rows[0];
    if (row !== undefined)
      documents.push(row);
  }
  return { documents, status: "resolved" };
}
function selectDocument(documents, canonicalContentId) {
  if (documents.length === 0)
    return null;
  return [...documents].sort((left, right) => {
    const authored = Number(right.text !== undefined) - Number(left.text !== undefined);
    if (authored !== 0)
      return authored;
    const revision = right.revision - left.revision;
    if (revision !== 0)
      return revision;
    const canonical = Number(right.contentId === canonicalContentId) - Number(left.contentId === canonicalContentId);
    if (canonical !== 0)
      return canonical;
    return left.contentId.localeCompare(right.contentId);
  })[0] ?? null;
}
async function analyzeReference(db, reference, cache) {
  const requested = await resolveAlias(db, reference.space, reference.contentId, cache);
  if (requested.status === "conflict")
    return requested;
  const declaresRename = reference.legacyContentIds.length > 0;
  if (declaresRename && requested.root !== reference.contentId) {
    return { code: "alias_cycle", status: "conflict" };
  }
  const canonicalContentId = declaresRename ? reference.contentId : requested.root;
  const closureRoots = new Set([canonicalContentId]);
  const allowedRoots = new Set([
    canonicalContentId,
    ...reference.legacyContentIds
  ]);
  const candidateIds = new Set([
    canonicalContentId,
    reference.contentId,
    ...reference.legacyContentIds,
    ...requested.path
  ]);
  for (const legacyContentId of reference.legacyContentIds) {
    const legacy = await resolveAlias(db, reference.space, legacyContentId, cache);
    if (legacy.status === "conflict")
      return legacy;
    if (!allowedRoots.has(legacy.root)) {
      return { code: "alias_collision", status: "conflict" };
    }
    closureRoots.add(legacy.root);
    for (const item of legacy.path)
      candidateIds.add(item);
    candidateIds.add(legacy.root);
  }
  for (const root of closureRoots) {
    const inbound = await resolveInboundAliasClosure(db, reference.space, root, cache);
    if (inbound.status === "conflict")
      return inbound;
    for (const contentId of inbound.contentIds)
      candidateIds.add(contentId);
  }
  const lookup = await findContent(db, reference.space, candidateIds, cache);
  if (lookup.status === "conflict")
    return lookup;
  const distinctAuthoredValues = new Set(lookup.documents.flatMap((document) => document.text === undefined ? [] : [document.text]));
  if (distinctAuthoredValues.size > 1) {
    return { code: "ambiguous_legacy_values", status: "conflict" };
  }
  const histories = new Set(lookup.documents.map((document) => JSON.stringify({
    hasAuthoredText: document.text !== undefined,
    revision: document.revision,
    sourceFingerprint: document.sourceFingerprint,
    sourceText: document.sourceText,
    text: document.text ?? null
  })));
  if (histories.size > 1) {
    return { code: "ambiguous_legacy_history", status: "conflict" };
  }
  const selected = selectDocument(lookup.documents, canonicalContentId);
  const currentRevision = lookup.documents.reduce((highest, document) => Math.max(highest, document.revision), 0);
  return {
    authorizationContentIds: [...candidateIds].sort(),
    canonicalContentId,
    currentRevision,
    documents: lookup.documents,
    selected,
    status: "resolved",
    viaLegacy: canonicalContentId !== reference.contentId || selected !== null && selected.contentId !== reference.contentId
  };
}
function storedResolution(reference, analysis) {
  if (analysis.status === "conflict") {
    return {
      code: analysis.code,
      contentId: reference.contentId,
      space: reference.space,
      status: "conflict"
    };
  }
  const selected = analysis.selected;
  if (selected?.text !== undefined) {
    return {
      canonicalContentId: analysis.canonicalContentId,
      contentId: reference.contentId,
      origin: "authored",
      revision: analysis.currentRevision,
      sourceDrift: selected.sourceFingerprint !== reference.sourceFingerprint,
      sourceFingerprint: selected.sourceFingerprint,
      space: reference.space,
      status: "resolved",
      text: selected.text,
      viaLegacy: analysis.viaLegacy
    };
  }
  return {
    canonicalContentId: analysis.canonicalContentId,
    contentId: reference.contentId,
    origin: "default",
    revision: analysis.currentRevision,
    sourceDrift: false,
    sourceFingerprint: reference.sourceFingerprint,
    space: reference.space,
    status: "resolved",
    viaLegacy: analysis.viaLegacy
  };
}
var authorizationTargets = query({
  args: { reference: v.any() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const parsed = parseResolveBatchRequest([args.reference]);
    const reference = parsed.status === "valid" ? parsed.value[0] : undefined;
    if (reference === undefined) {
      return {
        code: parsed.status === "invalid" ? parsed.code : "invalid_descriptor",
        status: "invalid"
      };
    }
    try {
      const analysis = await analyzeReference(ctx.db, reference, createAnalysisCache());
      return analysis.status === "conflict" ? analysis : {
        canonicalContentId: analysis.canonicalContentId,
        contentIds: analysis.authorizationContentIds,
        space: reference.space,
        status: "resolved"
      };
    } catch (error) {
      if (error instanceof AnalysisLimitExceeded) {
        return { code: "analysis_limit_exceeded", status: "invalid" };
      }
      throw error;
    }
  }
});
var resolveBatch = query({
  args: { requests: v.any() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const parsed = parseResolveBatchRequest(args.requests);
    if (parsed.status === "invalid")
      return parsed;
    const items = [];
    const cache = createAnalysisCache();
    try {
      for (const reference of parsed.value) {
        const analysis = await analyzeReference(ctx.db, reference, cache);
        items.push(storedResolution(reference, analysis));
      }
    } catch (error) {
      if (error instanceof AnalysisLimitExceeded) {
        return { code: "analysis_limit_exceeded", status: "invalid" };
      }
      throw error;
    }
    return { items, status: "resolved" };
  }
});
async function findRequest(db, space, requestId) {
  const rows = await db.query("requests").withIndex("by_space_request", (index) => index.eq("space", space).eq("requestId", requestId)).take(2);
  if (rows.length > 1)
    return "collision";
  const row = rows[0];
  return row === undefined ? null : row;
}
var requestIdentityPattern = /^sha256:[0-9a-f]{64}$/u;
async function sha256Identity(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const hexadecimal = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `sha256:${hexadecimal}`;
}
async function replayResult(stored, identity, requestId) {
  if (stored === null)
    return null;
  const storedIdentity = stored === "collision" ? null : requestIdentityPattern.test(stored.identity) ? stored.identity : await sha256Identity(stored.identity);
  if (stored === "collision" || storedIdentity !== identity) {
    return invalidResult(requestId, "request_mismatch");
  }
  const parsed = parseWriteResult(stored.result, requestId);
  if (parsed.status === "invalid" || parsed.value.status !== "saved") {
    return invalidResult(requestId, "request_mismatch");
  }
  return {
    ...parsed.value,
    replayed: true,
    requestId,
    status: "saved"
  };
}
async function requestIdentity(operation, request) {
  return await sha256Identity(JSON.stringify({ operation, request }));
}
async function registerAliases(db, descriptor) {
  for (const aliasContentId of descriptor.legacyContentIds) {
    const rows = await aliasRows(db, descriptor.space, aliasContentId);
    if (rows.length === 0) {
      await db.insert("aliases", {
        aliasContentId,
        space: descriptor.space,
        targetContentId: descriptor.contentId
      });
    }
  }
}
async function replaceCanonicalDocument(db, analysis, fields) {
  const canonicalDocument = analysis.documents.find((document) => document.contentId === analysis.canonicalContentId);
  if (canonicalDocument === undefined) {
    await db.insert("content", {
      contentId: analysis.canonicalContentId,
      ...fields
    });
  } else {
    await db.replace(canonicalDocument._id, {
      contentId: analysis.canonicalContentId,
      ...fields
    });
  }
  for (const document of analysis.documents) {
    if (document._id !== canonicalDocument?._id)
      await db.delete(document._id);
  }
}
async function recordRequest(db, space, contentId, requestId, identity, result) {
  await db.insert("requests", {
    contentId,
    identity,
    requestId,
    result,
    space
  });
  const retained = await db.query("requests").withIndex("by_space_content", (index) => index.eq("space", space).eq("contentId", contentId)).order("desc").collect();
  for (const expired of retained.slice(MALLLEABLE_TEXT_LIMITS.replayRequestsPerContent)) {
    await db.delete(expired._id);
  }
}
function conflictFromAnalysis(requestId, analysis) {
  return {
    code: analysis.code,
    currentRevision: null,
    requestId,
    status: "conflict"
  };
}
function nextRevision(requestId, currentRevision) {
  if (!Number.isSafeInteger(currentRevision) || currentRevision < 0) {
    return invalidResult(requestId, "invalid_revision");
  }
  if (currentRevision === Number.MAX_SAFE_INTEGER) {
    return invalidResult(requestId, "invalid_revision");
  }
  return currentRevision + 1;
}
function referenceFromDescriptor(descriptor) {
  return {
    contentId: descriptor.contentId,
    legacyContentIds: descriptor.legacyContentIds,
    sourceFingerprint: descriptor.sourceFingerprint,
    space: descriptor.space
  };
}
async function analyzeWriteReference(db, descriptor) {
  try {
    return await analyzeReference(db, referenceFromDescriptor(descriptor), createAnalysisCache());
  } catch (error) {
    if (error instanceof AnalysisLimitExceeded)
      return null;
    throw error;
  }
}
var replaceText = mutation({
  args: { request: v.any() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const parsed = parseComponentReplaceTextRequest(args.request);
    if (parsed.status === "invalid") {
      return invalidResult(responseRequestId(args.request), parsed.code);
    }
    const request = parsed.value;
    const { descriptor } = request;
    const identity = await requestIdentity("replaceText", request);
    const stored = await findRequest(ctx.db, descriptor.space, request.requestId);
    const replay = await replayResult(stored, identity, request.requestId);
    if (replay !== null)
      return replay;
    const analysis = await analyzeWriteReference(ctx.db, descriptor);
    if (analysis === null) {
      return invalidResult(request.requestId, "analysis_limit_exceeded");
    }
    if (analysis.status === "conflict") {
      return conflictFromAnalysis(request.requestId, analysis);
    }
    const currentRevision = analysis.currentRevision;
    if (currentRevision !== request.expectedRevision) {
      return {
        code: "revision_conflict",
        currentRevision,
        requestId: request.requestId,
        status: "conflict"
      };
    }
    const currentText = analysis.selected?.text ?? descriptor.defaultText;
    const replacement = applyTextRange(currentText, request.range, request.replacement);
    if (replacement.status === "invalid") {
      if (replacement.code === "range_mismatch") {
        return {
          code: "range_mismatch",
          currentRevision,
          requestId: request.requestId,
          status: "conflict"
        };
      }
      return invalidResult(request.requestId, replacement.code);
    }
    const revision = nextRevision(request.requestId, currentRevision);
    if (typeof revision !== "number")
      return revision;
    const authoredSource = analysis.selected?.text === undefined ? null : analysis.selected;
    const sourceFingerprint = authoredSource?.sourceFingerprint ?? descriptor.sourceFingerprint;
    const sourceText = authoredSource?.sourceText ?? descriptor.defaultText;
    const result = {
      canonicalContentId: analysis.canonicalContentId,
      contentId: descriptor.contentId,
      origin: "authored",
      replayed: false,
      requestId: request.requestId,
      revision,
      sourceDrift: sourceFingerprint !== descriptor.sourceFingerprint,
      sourceFingerprint,
      space: descriptor.space,
      status: "saved",
      text: replacement.value
    };
    await replaceCanonicalDocument(ctx.db, analysis, {
      revision,
      sourceFingerprint,
      sourceText,
      space: descriptor.space,
      text: replacement.value
    });
    await registerAliases(ctx.db, descriptor);
    await recordRequest(ctx.db, descriptor.space, analysis.canonicalContentId, request.requestId, identity, result);
    return result;
  }
});
var resetText = mutation({
  args: { request: v.any() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const parsed = parseComponentResetTextRequest(args.request);
    if (parsed.status === "invalid") {
      return invalidResult(responseRequestId(args.request), parsed.code);
    }
    const request = parsed.value;
    const { descriptor } = request;
    const identity = await requestIdentity("resetText", request);
    const stored = await findRequest(ctx.db, descriptor.space, request.requestId);
    const replay = await replayResult(stored, identity, request.requestId);
    if (replay !== null)
      return replay;
    const analysis = await analyzeWriteReference(ctx.db, descriptor);
    if (analysis === null) {
      return invalidResult(request.requestId, "analysis_limit_exceeded");
    }
    if (analysis.status === "conflict") {
      return conflictFromAnalysis(request.requestId, analysis);
    }
    const currentRevision = analysis.currentRevision;
    if (currentRevision !== request.expectedRevision) {
      return {
        code: "revision_conflict",
        currentRevision,
        requestId: request.requestId,
        status: "conflict"
      };
    }
    const revision = nextRevision(request.requestId, currentRevision);
    if (typeof revision !== "number")
      return revision;
    const result = {
      canonicalContentId: analysis.canonicalContentId,
      contentId: descriptor.contentId,
      origin: "default",
      replayed: false,
      requestId: request.requestId,
      revision,
      sourceDrift: false,
      sourceFingerprint: descriptor.sourceFingerprint,
      space: descriptor.space,
      status: "saved",
      text: descriptor.defaultText
    };
    await replaceCanonicalDocument(ctx.db, analysis, {
      revision,
      sourceFingerprint: descriptor.sourceFingerprint,
      sourceText: descriptor.defaultText,
      space: descriptor.space
    });
    await registerAliases(ctx.db, descriptor);
    await recordRequest(ctx.db, descriptor.space, analysis.canonicalContentId, request.requestId, identity, result);
    return result;
  }
});
var migrateAliases = mutation({
  args: { request: v.any() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const parsed = parseComponentMigrateAliasesRequest(args.request);
    if (parsed.status === "invalid") {
      return invalidResult(responseRequestId(args.request), parsed.code);
    }
    const request = parsed.value;
    const { descriptor } = request;
    const identity = await requestIdentity("migrateAliases", request);
    const stored = await findRequest(ctx.db, descriptor.space, request.requestId);
    const replay = await replayResult(stored, identity, request.requestId);
    if (replay !== null)
      return replay;
    const analysis = await analyzeWriteReference(ctx.db, descriptor);
    if (analysis === null) {
      return invalidResult(request.requestId, "analysis_limit_exceeded");
    }
    if (analysis.status === "conflict") {
      return conflictFromAnalysis(request.requestId, analysis);
    }
    const currentRevision = analysis.currentRevision;
    if (currentRevision !== request.expectedRevision) {
      return {
        code: "revision_conflict",
        currentRevision,
        requestId: request.requestId,
        status: "conflict"
      };
    }
    const revision = nextRevision(request.requestId, currentRevision);
    if (typeof revision !== "number")
      return revision;
    const authored = analysis.selected?.text;
    const sourceFingerprint = authored === undefined ? descriptor.sourceFingerprint : analysis.selected?.sourceFingerprint ?? descriptor.sourceFingerprint;
    const sourceText = authored === undefined ? descriptor.defaultText : analysis.selected?.sourceText ?? descriptor.defaultText;
    const result = {
      canonicalContentId: analysis.canonicalContentId,
      contentId: descriptor.contentId,
      origin: authored === undefined ? "default" : "authored",
      replayed: false,
      requestId: request.requestId,
      revision,
      sourceDrift: sourceFingerprint !== descriptor.sourceFingerprint,
      sourceFingerprint,
      space: descriptor.space,
      status: "saved",
      text: authored ?? descriptor.defaultText
    };
    await replaceCanonicalDocument(ctx.db, analysis, {
      revision,
      sourceFingerprint,
      sourceText,
      space: descriptor.space,
      ...authored === undefined ? {} : { text: authored }
    });
    await registerAliases(ctx.db, descriptor);
    await recordRequest(ctx.db, descriptor.space, analysis.canonicalContentId, request.requestId, identity, result);
    return result;
  }
});
export {
  resolveBatch,
  resetText,
  replaceText,
  migrateAliases,
  authorizationTargets
};

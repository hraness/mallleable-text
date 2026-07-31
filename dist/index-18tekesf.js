// src/model.ts
var MALLLEABLE_TEXT_LIMITS = Object.freeze({
  actorIdLength: 160,
  analysisLookups: 512,
  aliasHops: 17,
  aliasesPerDescriptor: 16,
  batchIdentityCount: 64,
  batchSize: 10,
  contentIdLength: 160,
  contextLength: 256,
  replayRequestsPerContent: 16,
  requestIdLength: 160,
  spaceLength: 64,
  textLength: 65536
});
var identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u;
var sourceFingerprintPattern = /^mt1:(0|[1-9a-z][0-9a-z]{0,3}):[0-9a-f]{16}$/u;
var invalidCodes = new Set([
  "alias_collision",
  "alias_cycle",
  "ambiguous_legacy_history",
  "ambiguous_legacy_values",
  "analysis_limit_exceeded",
  "batch_too_large",
  "duplicate_alias",
  "invalid_actor_id",
  "invalid_alias",
  "invalid_batch",
  "invalid_content_id",
  "invalid_descriptor",
  "invalid_range",
  "invalid_request",
  "invalid_request_id",
  "invalid_revision",
  "invalid_source_fingerprint",
  "invalid_space",
  "invalid_text",
  "range_mismatch",
  "request_mismatch",
  "source_mismatch",
  "text_too_long",
  "too_many_aliases"
]);
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function invalid(code) {
  return { code, status: "invalid" };
}
function valid(value) {
  return { status: "valid", value };
}
function parseIdentifier(value, maximumLength, code) {
  if (typeof value !== "string" || value.length === 0 || value.length > maximumLength || !identifierPattern.test(value)) {
    return invalid(code);
  }
  return valid(value);
}
function parseOpaqueId(value, maximumLength, code) {
  if (typeof value !== "string" || value.length === 0 || value.length > maximumLength || !isWellFormedUtf16(value) || value.trim() !== value || [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint < 32 || codePoint === 127);
  })) {
    return invalid(code);
  }
  return valid(value);
}
function parseSpace(value) {
  return parseIdentifier(value, MALLLEABLE_TEXT_LIMITS.spaceLength, "invalid_space");
}
function parseContentId(value) {
  return parseIdentifier(value, MALLLEABLE_TEXT_LIMITS.contentIdLength, "invalid_content_id");
}
function parseActorId(value) {
  return parseOpaqueId(value, MALLLEABLE_TEXT_LIMITS.actorIdLength, "invalid_actor_id");
}
function parseRequestId(value) {
  return parseOpaqueId(value, MALLLEABLE_TEXT_LIMITS.requestIdLength, "invalid_request_id");
}
function parseRevision(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    return invalid("invalid_revision");
  }
  return valid(value);
}
function isHighSurrogate(codeUnit) {
  return codeUnit >= 55296 && codeUnit <= 56319;
}
function isLowSurrogate(codeUnit) {
  return codeUnit >= 56320 && codeUnit <= 57343;
}
function isWellFormedUtf16(value) {
  for (let index = 0;index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (isHighSurrogate(codeUnit)) {
      if (index + 1 >= value.length)
        return false;
      const next = value.charCodeAt(index + 1);
      if (!isLowSurrogate(next))
        return false;
      index += 1;
    } else if (isLowSurrogate(codeUnit)) {
      return false;
    }
  }
  return true;
}
function parseText(value) {
  if (typeof value !== "string")
    return invalid("invalid_text");
  if (!isWellFormedUtf16(value))
    return invalid("invalid_text");
  if (value.length > MALLLEABLE_TEXT_LIMITS.textLength) {
    return invalid("text_too_long");
  }
  return valid(value);
}
function sourceFingerprint(text) {
  let first = 2166136261;
  let second = 2654435769;
  for (let index = 0;index < text.length; index += 1) {
    const codeUnit = text.charCodeAt(index);
    first ^= codeUnit & 255;
    first = Math.imul(first, 16777619);
    first ^= codeUnit >>> 8;
    first = Math.imul(first, 16777619);
    second ^= codeUnit + index;
    second = Math.imul(second, 2246822507);
    second ^= second >>> 13;
  }
  const left = (first >>> 0).toString(16).padStart(8, "0");
  const right = (second >>> 0).toString(16).padStart(8, "0");
  return `mt1:${text.length.toString(36)}:${left}${right}`;
}
function parseSourceFingerprint(value) {
  if (typeof value !== "string") {
    return invalid("invalid_source_fingerprint");
  }
  const match = sourceFingerprintPattern.exec(value);
  const encodedLength = match?.[1];
  if (encodedLength === undefined) {
    return invalid("invalid_source_fingerprint");
  }
  const sourceLength = Number.parseInt(encodedLength, 36);
  if (!Number.isSafeInteger(sourceLength) || sourceLength < 0 || sourceLength > MALLLEABLE_TEXT_LIMITS.textLength || sourceLength.toString(36) !== encodedLength) {
    return invalid("invalid_source_fingerprint");
  }
  return valid(value);
}
function parseAliases(value, canonicalContentId) {
  if (value === undefined)
    return valid([]);
  if (!Array.isArray(value))
    return invalid("invalid_alias");
  if (value.length > MALLLEABLE_TEXT_LIMITS.aliasesPerDescriptor) {
    return invalid("too_many_aliases");
  }
  const aliases = [];
  const seen = new Set([canonicalContentId]);
  for (const candidate of value) {
    const parsed = parseContentId(candidate);
    if (parsed.status === "invalid")
      return invalid("invalid_alias");
    if (seen.has(parsed.value))
      return invalid("duplicate_alias");
    seen.add(parsed.value);
    aliases.push(parsed.value);
  }
  return valid(aliases.sort());
}
function parseContentDescriptor(value) {
  if (!isRecord(value))
    return invalid("invalid_descriptor");
  const space = parseSpace(value.space);
  if (space.status === "invalid")
    return space;
  const contentId = parseContentId(value.contentId);
  if (contentId.status === "invalid")
    return contentId;
  const defaultText = parseText(value.defaultText);
  if (defaultText.status === "invalid")
    return defaultText;
  const aliases = parseAliases(value.legacyContentIds, contentId.value);
  if (aliases.status === "invalid")
    return aliases;
  const computedFingerprint = sourceFingerprint(defaultText.value);
  const suppliedFingerprint = value.sourceFingerprint === undefined ? computedFingerprint : parseSourceFingerprint(value.sourceFingerprint);
  if (typeof suppliedFingerprint !== "string") {
    if (suppliedFingerprint.status === "invalid")
      return suppliedFingerprint;
    if (suppliedFingerprint.value !== computedFingerprint) {
      return invalid("source_mismatch");
    }
  }
  return valid({
    contentId: contentId.value,
    defaultText: defaultText.value,
    legacyContentIds: aliases.value,
    sourceFingerprint: computedFingerprint,
    space: space.value
  });
}
function parseContentReference(value) {
  if (!isRecord(value))
    return invalid("invalid_descriptor");
  const space = parseSpace(value.space);
  if (space.status === "invalid")
    return space;
  const contentId = parseContentId(value.contentId);
  if (contentId.status === "invalid")
    return contentId;
  const aliases = parseAliases(value.legacyContentIds, contentId.value);
  if (aliases.status === "invalid")
    return aliases;
  const fingerprint = parseSourceFingerprint(value.sourceFingerprint);
  if (fingerprint.status === "invalid")
    return fingerprint;
  return valid({
    contentId: contentId.value,
    legacyContentIds: aliases.value,
    sourceFingerprint: fingerprint.value,
    space: space.value
  });
}
function referenceFromDescriptor(descriptor) {
  return {
    contentId: descriptor.contentId,
    legacyContentIds: descriptor.legacyContentIds,
    sourceFingerprint: descriptor.sourceFingerprint,
    space: descriptor.space
  };
}
function isAliasConflictCode(value) {
  return value === "alias_collision" || value === "alias_cycle" || value === "ambiguous_legacy_history" || value === "ambiguous_legacy_values";
}
function parseAuthorizationTargetsResult(value) {
  if (!isRecord(value))
    return invalid("invalid_request");
  if (value.status === "invalid") {
    if (typeof value.code !== "string" || !invalidCodes.has(value.code)) {
      return invalid("invalid_request");
    }
    return valid({ code: value.code, status: "invalid" });
  }
  if (value.status === "conflict") {
    return isAliasConflictCode(value.code) ? valid({ code: value.code, status: "conflict" }) : invalid("invalid_request");
  }
  if (value.status !== "resolved" || !Array.isArray(value.contentIds) || value.contentIds.length < 1 || value.contentIds.length > MALLLEABLE_TEXT_LIMITS.analysisLookups) {
    return invalid("invalid_request");
  }
  const space = parseSpace(value.space);
  if (space.status === "invalid")
    return space;
  const canonicalContentId = parseContentId(value.canonicalContentId);
  if (canonicalContentId.status === "invalid")
    return canonicalContentId;
  const contentIds = [];
  const seen = new Set;
  for (const candidate of value.contentIds) {
    const contentId = parseContentId(candidate);
    if (contentId.status === "invalid" || seen.has(contentId.value)) {
      return invalid("invalid_request");
    }
    seen.add(contentId.value);
    contentIds.push(contentId.value);
  }
  if (!seen.has(canonicalContentId.value))
    return invalid("invalid_request");
  return valid({
    canonicalContentId: canonicalContentId.value,
    contentIds: contentIds.sort(),
    space: space.value,
    status: "resolved"
  });
}
function parseResolveBatchRequest(value) {
  if (!Array.isArray(value))
    return invalid("invalid_batch");
  if (value.length > MALLLEABLE_TEXT_LIMITS.batchSize) {
    return invalid("batch_too_large");
  }
  const parsed = [];
  const seen = new Set;
  let identityCount = 0;
  for (const item of value) {
    const reference = parseContentReference(item);
    if (reference.status === "invalid")
      return reference;
    identityCount += 1 + reference.value.legacyContentIds.length;
    if (identityCount > MALLLEABLE_TEXT_LIMITS.batchIdentityCount) {
      return invalid("batch_too_large");
    }
    const key = `${reference.value.space}\x00${reference.value.contentId}`;
    if (seen.has(key))
      return invalid("invalid_batch");
    seen.add(key);
    parsed.push(reference.value);
  }
  return valid(parsed);
}
function parseTextRange(value) {
  if (!isRecord(value))
    return invalid("invalid_range");
  const { end, exact, prefix, start, suffix } = value;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start || typeof exact !== "string" || !isWellFormedUtf16(exact) || exact.length !== end - start || exact.length > MALLLEABLE_TEXT_LIMITS.textLength || typeof prefix !== "string" || !isWellFormedUtf16(prefix) || prefix.length > MALLLEABLE_TEXT_LIMITS.contextLength || typeof suffix !== "string" || !isWellFormedUtf16(suffix) || suffix.length > MALLLEABLE_TEXT_LIMITS.contextLength) {
    return invalid("invalid_range");
  }
  return valid({
    end,
    exact,
    prefix,
    start,
    suffix
  });
}
function rangeMatchesText(text, range) {
  if (range.end > text.length)
    return false;
  if (text.slice(range.start, range.end) !== range.exact)
    return false;
  const prefixStart = Math.max(0, range.start - range.prefix.length);
  if (text.slice(prefixStart, range.start) !== range.prefix)
    return false;
  return text.slice(range.end, range.end + range.suffix.length) === range.suffix;
}
function applyTextRange(text, range, replacement) {
  if (!rangeMatchesText(text, range))
    return invalid("range_mismatch");
  const next = `${text.slice(0, range.start)}${replacement}${text.slice(range.end)}`;
  return parseText(next);
}
function textRangeFromSelection(text, start, end) {
  const parsedText = parseText(text);
  if (parsedText.status === "invalid")
    return parsedText;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start || end > text.length) {
    return invalid("invalid_range");
  }
  let prefixStart = Math.max(0, start - MALLLEABLE_TEXT_LIMITS.contextLength);
  if (prefixStart > 0 && isLowSurrogate(text.charCodeAt(prefixStart)) && isHighSurrogate(text.charCodeAt(prefixStart - 1))) {
    prefixStart += 1;
  }
  let suffixEnd = Math.min(text.length, end + MALLLEABLE_TEXT_LIMITS.contextLength);
  if (suffixEnd < text.length && isLowSurrogate(text.charCodeAt(suffixEnd)) && isHighSurrogate(text.charCodeAt(suffixEnd - 1))) {
    suffixEnd -= 1;
  }
  return parseTextRange({
    end,
    exact: text.slice(start, end),
    prefix: text.slice(prefixStart, start),
    start,
    suffix: text.slice(end, suffixEnd)
  });
}
function parseReplaceTextRequest(value) {
  if (!isRecord(value))
    return invalid("invalid_request");
  const descriptor = parseContentDescriptor(value.descriptor);
  if (descriptor.status === "invalid")
    return descriptor;
  const expectedRevision = parseRevision(value.expectedRevision);
  if (expectedRevision.status === "invalid")
    return expectedRevision;
  const requestId = parseRequestId(value.requestId);
  if (requestId.status === "invalid")
    return requestId;
  const range = parseTextRange(value.range);
  if (range.status === "invalid")
    return range;
  const replacement = parseText(value.replacement);
  if (replacement.status === "invalid")
    return replacement;
  return valid({
    descriptor: descriptor.value,
    expectedRevision: expectedRevision.value,
    range: range.value,
    replacement: replacement.value,
    requestId: requestId.value
  });
}
function parseResetTextRequest(value) {
  if (!isRecord(value))
    return invalid("invalid_request");
  const descriptor = parseContentDescriptor(value.descriptor);
  if (descriptor.status === "invalid")
    return descriptor;
  const expectedRevision = parseRevision(value.expectedRevision);
  if (expectedRevision.status === "invalid")
    return expectedRevision;
  const requestId = parseRequestId(value.requestId);
  if (requestId.status === "invalid")
    return requestId;
  return valid({
    descriptor: descriptor.value,
    expectedRevision: expectedRevision.value,
    requestId: requestId.value
  });
}
function parseMigrateAliasesRequest(value) {
  if (!isRecord(value))
    return invalid("invalid_request");
  const descriptor = parseContentDescriptor(value.descriptor);
  if (descriptor.status === "invalid")
    return descriptor;
  if (descriptor.value.legacyContentIds.length === 0) {
    return invalid("invalid_alias");
  }
  const expectedRevision = parseRevision(value.expectedRevision);
  if (expectedRevision.status === "invalid")
    return expectedRevision;
  const requestId = parseRequestId(value.requestId);
  if (requestId.status === "invalid")
    return requestId;
  return valid({
    descriptor: descriptor.value,
    expectedRevision: expectedRevision.value,
    requestId: requestId.value
  });
}
function parseComponentReplaceTextRequest(value) {
  const parsed = parseReplaceTextRequest(value);
  if (parsed.status === "invalid")
    return parsed;
  const actor = isRecord(value) ? parseActorId(value.actorId) : invalid("invalid_actor_id");
  if (actor.status === "invalid")
    return actor;
  return valid({ ...parsed.value, actorId: actor.value });
}
function parseComponentResetTextRequest(value) {
  const parsed = parseResetTextRequest(value);
  if (parsed.status === "invalid")
    return parsed;
  const actor = isRecord(value) ? parseActorId(value.actorId) : invalid("invalid_actor_id");
  if (actor.status === "invalid")
    return actor;
  return valid({ ...parsed.value, actorId: actor.value });
}
function parseComponentMigrateAliasesRequest(value) {
  const parsed = parseMigrateAliasesRequest(value);
  if (parsed.status === "invalid")
    return parsed;
  const actor = isRecord(value) ? parseActorId(value.actorId) : invalid("invalid_actor_id");
  if (actor.status === "invalid")
    return actor;
  return valid({ ...parsed.value, actorId: actor.value });
}
function resolveClientContent(descriptorValue, resolutionValue) {
  const descriptor = parseContentDescriptor(descriptorValue);
  if (descriptor.status === "invalid")
    return descriptor;
  if (!isRecord(resolutionValue) || resolutionValue.status !== "resolved") {
    return invalid("invalid_batch");
  }
  const canonicalContentId = parseContentId(resolutionValue.canonicalContentId);
  if (canonicalContentId.status === "invalid")
    return canonicalContentId;
  const revision = parseRevision(resolutionValue.revision);
  if (revision.status === "invalid")
    return revision;
  const fingerprint = parseSourceFingerprint(resolutionValue.sourceFingerprint);
  if (fingerprint.status === "invalid")
    return fingerprint;
  if (resolutionValue.contentId !== descriptor.value.contentId || resolutionValue.space !== descriptor.value.space || typeof resolutionValue.viaLegacy !== "boolean") {
    return invalid("invalid_batch");
  }
  if (resolutionValue.origin === "default") {
    return valid({
      canonicalContentId: canonicalContentId.value,
      contentId: descriptor.value.contentId,
      origin: "default",
      revision: revision.value,
      sourceDrift: false,
      sourceFingerprint: descriptor.value.sourceFingerprint,
      space: descriptor.value.space,
      text: descriptor.value.defaultText,
      viaLegacy: resolutionValue.viaLegacy
    });
  }
  if (resolutionValue.origin !== "authored" || typeof resolutionValue.sourceDrift !== "boolean") {
    return invalid("invalid_batch");
  }
  const text = parseText(resolutionValue.text);
  if (text.status === "invalid")
    return text;
  return valid({
    canonicalContentId: canonicalContentId.value,
    contentId: descriptor.value.contentId,
    origin: "authored",
    revision: revision.value,
    sourceDrift: resolutionValue.sourceDrift || fingerprint.value !== descriptor.value.sourceFingerprint,
    sourceFingerprint: fingerprint.value,
    space: descriptor.value.space,
    text: text.value,
    viaLegacy: resolutionValue.viaLegacy
  });
}
function parseWriteResult(value, expectedRequestId) {
  if (!isRecord(value))
    return invalid("invalid_request");
  const requestId = parseRequestId(value.requestId);
  if (requestId.status === "invalid")
    return requestId;
  if (expectedRequestId !== undefined && requestId.value !== expectedRequestId) {
    return invalid("request_mismatch");
  }
  if (value.status === "forbidden") {
    return valid({ requestId: requestId.value, status: "forbidden" });
  }
  if (value.status === "retryable") {
    if (value.code !== "authorization_unavailable" && value.code !== "component_unavailable") {
      return invalid("invalid_request");
    }
    return valid({
      code: value.code,
      requestId: requestId.value,
      status: "retryable"
    });
  }
  if (value.status === "invalid") {
    if (typeof value.code !== "string" || !invalidCodes.has(value.code)) {
      return invalid("invalid_request");
    }
    return valid({
      code: value.code,
      requestId: requestId.value,
      status: "invalid"
    });
  }
  if (value.status === "conflict") {
    const allowedCodes = new Set([
      "alias_collision",
      "alias_cycle",
      "ambiguous_legacy_history",
      "ambiguous_legacy_values",
      "range_mismatch",
      "revision_conflict",
      "source_mismatch"
    ]);
    if (typeof value.code !== "string" || !allowedCodes.has(value.code)) {
      return invalid("invalid_request");
    }
    if (value.currentRevision === null) {
      return valid({
        code: value.code,
        currentRevision: null,
        requestId: requestId.value,
        status: "conflict"
      });
    }
    const revision2 = parseRevision(value.currentRevision);
    if (revision2.status === "invalid")
      return revision2;
    return valid({
      code: value.code,
      currentRevision: revision2.value,
      requestId: requestId.value,
      status: "conflict"
    });
  }
  if (value.status !== "saved")
    return invalid("invalid_request");
  const space = parseSpace(value.space);
  if (space.status === "invalid")
    return space;
  const contentId = parseContentId(value.contentId);
  if (contentId.status === "invalid")
    return contentId;
  const canonicalContentId = parseContentId(value.canonicalContentId);
  if (canonicalContentId.status === "invalid")
    return canonicalContentId;
  const revision = parseRevision(value.revision);
  if (revision.status === "invalid")
    return revision;
  const fingerprint = parseSourceFingerprint(value.sourceFingerprint);
  if (fingerprint.status === "invalid")
    return fingerprint;
  const text = parseText(value.text);
  if (text.status === "invalid")
    return text;
  if (value.origin !== "authored" && value.origin !== "default" || typeof value.replayed !== "boolean" || typeof value.sourceDrift !== "boolean") {
    return invalid("invalid_request");
  }
  return valid({
    canonicalContentId: canonicalContentId.value,
    contentId: contentId.value,
    origin: value.origin,
    replayed: value.replayed,
    requestId: requestId.value,
    revision: revision.value,
    sourceDrift: value.sourceDrift,
    sourceFingerprint: fingerprint.value,
    space: space.value,
    status: "saved",
    text: text.value
  });
}
function parseResolveBatchResult(value) {
  if (!isRecord(value))
    return invalid("invalid_batch");
  if (value.status === "invalid") {
    if (typeof value.code !== "string" || !invalidCodes.has(value.code)) {
      return invalid("invalid_batch");
    }
    return valid({
      code: value.code,
      status: "invalid"
    });
  }
  if (value.status !== "resolved" || !Array.isArray(value.items) || value.items.length > MALLLEABLE_TEXT_LIMITS.batchSize) {
    return invalid("invalid_batch");
  }
  const items = [];
  for (const item of value.items) {
    if (!isRecord(item))
      return invalid("invalid_batch");
    const space = parseSpace(item.space);
    if (space.status === "invalid")
      return invalid("invalid_batch");
    const contentId = parseContentId(item.contentId);
    if (contentId.status === "invalid")
      return invalid("invalid_batch");
    if (item.status === "conflict") {
      if (item.code !== "alias_collision" && item.code !== "alias_cycle" && item.code !== "ambiguous_legacy_history" && item.code !== "ambiguous_legacy_values") {
        return invalid("invalid_batch");
      }
      items.push({
        code: item.code,
        contentId: contentId.value,
        space: space.value,
        status: "conflict"
      });
      continue;
    }
    if (item.status !== "resolved")
      return invalid("invalid_batch");
    const canonicalContentId = parseContentId(item.canonicalContentId);
    if (canonicalContentId.status === "invalid")
      return invalid("invalid_batch");
    const revision = parseRevision(item.revision);
    if (revision.status === "invalid")
      return invalid("invalid_batch");
    const fingerprint = parseSourceFingerprint(item.sourceFingerprint);
    if (fingerprint.status === "invalid")
      return invalid("invalid_batch");
    if (typeof item.viaLegacy !== "boolean")
      return invalid("invalid_batch");
    if (item.origin === "default") {
      if (item.sourceDrift !== false || item.text !== undefined) {
        return invalid("invalid_batch");
      }
      items.push({
        canonicalContentId: canonicalContentId.value,
        contentId: contentId.value,
        origin: "default",
        revision: revision.value,
        sourceDrift: false,
        sourceFingerprint: fingerprint.value,
        space: space.value,
        status: "resolved",
        viaLegacy: item.viaLegacy
      });
      continue;
    }
    if (item.origin !== "authored" || typeof item.sourceDrift !== "boolean") {
      return invalid("invalid_batch");
    }
    const text = parseText(item.text);
    if (text.status === "invalid")
      return invalid("invalid_batch");
    items.push({
      canonicalContentId: canonicalContentId.value,
      contentId: contentId.value,
      origin: "authored",
      revision: revision.value,
      sourceDrift: item.sourceDrift,
      sourceFingerprint: fingerprint.value,
      space: space.value,
      status: "resolved",
      text: text.value,
      viaLegacy: item.viaLegacy
    });
  }
  return valid({ items, status: "resolved" });
}

export { MALLLEABLE_TEXT_LIMITS, parseSpace, parseContentId, parseActorId, parseRequestId, parseRevision, parseText, sourceFingerprint, parseSourceFingerprint, parseContentDescriptor, parseContentReference, referenceFromDescriptor, parseAuthorizationTargetsResult, parseResolveBatchRequest, parseTextRange, rangeMatchesText, applyTextRange, textRangeFromSelection, parseReplaceTextRequest, parseResetTextRequest, parseMigrateAliasesRequest, parseComponentReplaceTextRequest, parseComponentResetTextRequest, parseComponentMigrateAliasesRequest, resolveClientContent, parseWriteResult, parseResolveBatchResult };

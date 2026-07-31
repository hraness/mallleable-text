export const MALLLEABLE_TEXT_LIMITS = Object.freeze({
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
  textLength: 65_536,
});

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u;
const sourceFingerprintPattern = /^mt1:(0|[1-9a-z][0-9a-z]{0,3}):[0-9a-f]{16}$/u;

export type InvalidCode =
  | "alias_collision"
  | "alias_cycle"
  | "ambiguous_legacy_history"
  | "ambiguous_legacy_values"
  | "analysis_limit_exceeded"
  | "batch_too_large"
  | "duplicate_alias"
  | "invalid_actor_id"
  | "invalid_alias"
  | "invalid_batch"
  | "invalid_content_id"
  | "invalid_descriptor"
  | "invalid_range"
  | "invalid_request"
  | "invalid_request_id"
  | "invalid_revision"
  | "invalid_source_fingerprint"
  | "invalid_space"
  | "invalid_text"
  | "range_mismatch"
  | "request_mismatch"
  | "source_mismatch"
  | "text_too_long"
  | "too_many_aliases";

export type ParseResult<T> =
  | Readonly<{ value: T; status: "valid" }>
  | Readonly<{ code: InvalidCode; status: "invalid" }>;

export type ContentDescriptor = Readonly<{
  contentId: string;
  defaultText: string;
  legacyContentIds: readonly string[];
  sourceFingerprint: string;
  space: string;
}>;

export type ContentReference = Readonly<{
  contentId: string;
  legacyContentIds: readonly string[];
  sourceFingerprint: string;
  space: string;
}>;

export type AliasConflictCode =
  | "alias_collision"
  | "alias_cycle"
  | "ambiguous_legacy_history"
  | "ambiguous_legacy_values";

export type AuthorizationTargetsResult =
  | Readonly<{
      canonicalContentId: string;
      contentIds: readonly string[];
      space: string;
      status: "resolved";
    }>
  | Readonly<{
      code: AliasConflictCode;
      status: "conflict";
    }>
  | Readonly<{
      code: InvalidCode;
      status: "invalid";
    }>;

export type TextRange = Readonly<{
  end: number;
  exact: string;
  prefix: string;
  start: number;
  suffix: string;
}>;

export type ReplaceTextRequest = Readonly<{
  descriptor: ContentDescriptor;
  expectedRevision: number;
  range: TextRange;
  replacement: string;
  requestId: string;
}>;

export type ResetTextRequest = Readonly<{
  descriptor: ContentDescriptor;
  expectedRevision: number;
  requestId: string;
}>;

export type MigrateAliasesRequest = Readonly<{
  descriptor: ContentDescriptor;
  expectedRevision: number;
  requestId: string;
}>;

export type ComponentReplaceTextRequest = ReplaceTextRequest &
  Readonly<{ actorId: string }>;

export type ComponentResetTextRequest = ResetTextRequest &
  Readonly<{ actorId: string }>;

export type ComponentMigrateAliasesRequest = MigrateAliasesRequest &
  Readonly<{ actorId: string }>;

export type ResolvedContent = Readonly<{
  canonicalContentId: string;
  contentId: string;
  origin: "authored" | "default";
  revision: number;
  sourceDrift: boolean;
  sourceFingerprint: string;
  space: string;
  text: string;
  viaLegacy: boolean;
}>;

export type StoredResolution =
  | Readonly<{
      canonicalContentId: string;
      contentId: string;
      origin: "authored";
      revision: number;
      sourceDrift: boolean;
      sourceFingerprint: string;
      space: string;
      status: "resolved";
      text: string;
      viaLegacy: boolean;
    }>
  | Readonly<{
      canonicalContentId: string;
      contentId: string;
      origin: "default";
      revision: number;
      sourceDrift: false;
      sourceFingerprint: string;
      space: string;
      status: "resolved";
      viaLegacy: boolean;
    }>
  | Readonly<{
      code: AliasConflictCode;
      contentId: string;
      space: string;
      status: "conflict";
    }>;

export type ResolveBatchResult =
  | Readonly<{
      items: readonly StoredResolution[];
      status: "resolved";
    }>
  | Readonly<{
      code: InvalidCode;
      status: "invalid";
    }>;

export type SavedWriteResult = Readonly<{
  canonicalContentId: string;
  contentId: string;
  origin: "authored" | "default";
  replayed: boolean;
  requestId: string;
  revision: number;
  sourceDrift: boolean;
  sourceFingerprint: string;
  space: string;
  status: "saved";
  text: string;
}>;

export type WriteConflictResult = Readonly<{
  code:
    | AliasConflictCode
    | "range_mismatch"
    | "revision_conflict"
    | "source_mismatch";
  currentRevision: number | null;
  requestId: string;
  status: "conflict";
}>;

export type WriteInvalidResult = Readonly<{
  code: InvalidCode;
  requestId: string;
  status: "invalid";
}>;

export type WriteForbiddenResult = Readonly<{
  requestId: string;
  status: "forbidden";
}>;

export type WriteRetryableResult = Readonly<{
  code: "authorization_unavailable" | "component_unavailable";
  requestId: string;
  status: "retryable";
}>;

export type WriteResult =
  | SavedWriteResult
  | WriteConflictResult
  | WriteForbiddenResult
  | WriteInvalidResult
  | WriteRetryableResult;

export type ComponentWriteResult = Exclude<
  WriteResult,
  WriteForbiddenResult | WriteRetryableResult
>;

const invalidCodes: ReadonlySet<InvalidCode> = new Set<InvalidCode>([
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
  "too_many_aliases",
]);

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid<T>(code: InvalidCode): ParseResult<T> {
  return { code, status: "invalid" };
}

function valid<T>(value: T): ParseResult<T> {
  return { status: "valid", value };
}

function parseIdentifier(
  value: unknown,
  maximumLength: number,
  code: "invalid_content_id" | "invalid_space",
): ParseResult<string> {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maximumLength ||
    !identifierPattern.test(value)
  ) {
    return invalid(code);
  }
  return valid(value);
}

function parseOpaqueId(
  value: unknown,
  maximumLength: number,
  code: "invalid_actor_id" | "invalid_request_id",
): ParseResult<string> {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maximumLength ||
    !isWellFormedUtf16(value) ||
    value.trim() !== value ||
    [...value].some((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined && (codePoint < 0x20 || codePoint === 0x7f);
    })
  ) {
    return invalid(code);
  }
  return valid(value);
}

export function parseSpace(value: unknown): ParseResult<string> {
  return parseIdentifier(value, MALLLEABLE_TEXT_LIMITS.spaceLength, "invalid_space");
}

export function parseContentId(value: unknown): ParseResult<string> {
  return parseIdentifier(
    value,
    MALLLEABLE_TEXT_LIMITS.contentIdLength,
    "invalid_content_id",
  );
}

export function parseActorId(value: unknown): ParseResult<string> {
  return parseOpaqueId(
    value,
    MALLLEABLE_TEXT_LIMITS.actorIdLength,
    "invalid_actor_id",
  );
}

export function parseRequestId(value: unknown): ParseResult<string> {
  return parseOpaqueId(
    value,
    MALLLEABLE_TEXT_LIMITS.requestIdLength,
    "invalid_request_id",
  );
}

export function parseRevision(value: unknown): ParseResult<number> {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    return invalid("invalid_revision");
  }
  return valid(value as number);
}

function isHighSurrogate(codeUnit: number): boolean {
  return codeUnit >= 0xd800 && codeUnit <= 0xdbff;
}

function isLowSurrogate(codeUnit: number): boolean {
  return codeUnit >= 0xdc00 && codeUnit <= 0xdfff;
}

function isWellFormedUtf16(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (isHighSurrogate(codeUnit)) {
      if (index + 1 >= value.length) return false;
      const next = value.charCodeAt(index + 1);
      if (!isLowSurrogate(next)) return false;
      index += 1;
    } else if (isLowSurrogate(codeUnit)) {
      return false;
    }
  }
  return true;
}

export function parseText(value: unknown): ParseResult<string> {
  if (typeof value !== "string") return invalid("invalid_text");
  if (!isWellFormedUtf16(value)) return invalid("invalid_text");
  if (value.length > MALLLEABLE_TEXT_LIMITS.textLength) {
    return invalid("text_too_long");
  }
  return valid(value);
}

export function sourceFingerprint(text: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < text.length; index += 1) {
    const codeUnit = text.charCodeAt(index);
    first ^= codeUnit & 0xff;
    first = Math.imul(first, 0x01000193);
    first ^= codeUnit >>> 8;
    first = Math.imul(first, 0x01000193);

    second ^= codeUnit + index;
    second = Math.imul(second, 0x85ebca6b);
    second ^= second >>> 13;
  }
  const left = (first >>> 0).toString(16).padStart(8, "0");
  const right = (second >>> 0).toString(16).padStart(8, "0");
  return `mt1:${text.length.toString(36)}:${left}${right}`;
}

export function parseSourceFingerprint(value: unknown): ParseResult<string> {
  if (typeof value !== "string") {
    return invalid("invalid_source_fingerprint");
  }
  const match = sourceFingerprintPattern.exec(value);
  const encodedLength = match?.[1];
  if (encodedLength === undefined) {
    return invalid("invalid_source_fingerprint");
  }
  const sourceLength = Number.parseInt(encodedLength, 36);
  if (
    !Number.isSafeInteger(sourceLength)
    || sourceLength < 0
    || sourceLength > MALLLEABLE_TEXT_LIMITS.textLength
    || sourceLength.toString(36) !== encodedLength
  ) {
    return invalid("invalid_source_fingerprint");
  }
  return valid(value);
}

function parseAliases(
  value: unknown,
  canonicalContentId: string,
): ParseResult<readonly string[]> {
  if (value === undefined) return valid([]);
  if (!Array.isArray(value)) return invalid("invalid_alias");
  if (value.length > MALLLEABLE_TEXT_LIMITS.aliasesPerDescriptor) {
    return invalid("too_many_aliases");
  }

  const aliases: string[] = [];
  const seen = new Set<string>([canonicalContentId]);
  for (const candidate of value) {
    const parsed = parseContentId(candidate);
    if (parsed.status === "invalid") return invalid("invalid_alias");
    if (seen.has(parsed.value)) return invalid("duplicate_alias");
    seen.add(parsed.value);
    aliases.push(parsed.value);
  }
  return valid(aliases.sort());
}

export function parseContentDescriptor(value: unknown): ParseResult<ContentDescriptor> {
  if (!isRecord(value)) return invalid("invalid_descriptor");

  const space = parseSpace(value.space);
  if (space.status === "invalid") return space;
  const contentId = parseContentId(value.contentId);
  if (contentId.status === "invalid") return contentId;
  const defaultText = parseText(value.defaultText);
  if (defaultText.status === "invalid") return defaultText;
  const aliases = parseAliases(value.legacyContentIds, contentId.value);
  if (aliases.status === "invalid") return aliases;

  const computedFingerprint = sourceFingerprint(defaultText.value);
  const suppliedFingerprint =
    value.sourceFingerprint === undefined
      ? computedFingerprint
      : parseSourceFingerprint(value.sourceFingerprint);
  if (typeof suppliedFingerprint !== "string") {
    if (suppliedFingerprint.status === "invalid") return suppliedFingerprint;
    if (suppliedFingerprint.value !== computedFingerprint) {
      return invalid("source_mismatch");
    }
  }

  return valid({
    contentId: contentId.value,
    defaultText: defaultText.value,
    legacyContentIds: aliases.value,
    sourceFingerprint: computedFingerprint,
    space: space.value,
  });
}

export function parseContentReference(value: unknown): ParseResult<ContentReference> {
  if (!isRecord(value)) return invalid("invalid_descriptor");
  const space = parseSpace(value.space);
  if (space.status === "invalid") return space;
  const contentId = parseContentId(value.contentId);
  if (contentId.status === "invalid") return contentId;
  const aliases = parseAliases(value.legacyContentIds, contentId.value);
  if (aliases.status === "invalid") return aliases;
  const fingerprint = parseSourceFingerprint(value.sourceFingerprint);
  if (fingerprint.status === "invalid") return fingerprint;
  return valid({
    contentId: contentId.value,
    legacyContentIds: aliases.value,
    sourceFingerprint: fingerprint.value,
    space: space.value,
  });
}

export function referenceFromDescriptor(
  descriptor: ContentDescriptor,
): ContentReference {
  return {
    contentId: descriptor.contentId,
    legacyContentIds: descriptor.legacyContentIds,
    sourceFingerprint: descriptor.sourceFingerprint,
    space: descriptor.space,
  };
}

function isAliasConflictCode(value: unknown): value is AliasConflictCode {
  return value === "alias_collision"
    || value === "alias_cycle"
    || value === "ambiguous_legacy_history"
    || value === "ambiguous_legacy_values";
}

export function parseAuthorizationTargetsResult(
  value: unknown,
): ParseResult<AuthorizationTargetsResult> {
  if (!isRecord(value)) return invalid("invalid_request");
  if (value.status === "invalid") {
    if (typeof value.code !== "string" || !invalidCodes.has(value.code as InvalidCode)) {
      return invalid("invalid_request");
    }
    return valid({ code: value.code as InvalidCode, status: "invalid" });
  }
  if (value.status === "conflict") {
    return isAliasConflictCode(value.code)
      ? valid({ code: value.code, status: "conflict" })
      : invalid("invalid_request");
  }
  if (
    value.status !== "resolved"
    || !Array.isArray(value.contentIds)
    || value.contentIds.length < 1
    || value.contentIds.length > MALLLEABLE_TEXT_LIMITS.analysisLookups
  ) {
    return invalid("invalid_request");
  }
  const space = parseSpace(value.space);
  if (space.status === "invalid") return space;
  const canonicalContentId = parseContentId(value.canonicalContentId);
  if (canonicalContentId.status === "invalid") return canonicalContentId;
  const contentIds: string[] = [];
  const seen = new Set<string>();
  for (const candidate of value.contentIds) {
    const contentId = parseContentId(candidate);
    if (contentId.status === "invalid" || seen.has(contentId.value)) {
      return invalid("invalid_request");
    }
    seen.add(contentId.value);
    contentIds.push(contentId.value);
  }
  if (!seen.has(canonicalContentId.value)) return invalid("invalid_request");
  return valid({
    canonicalContentId: canonicalContentId.value,
    contentIds: contentIds.sort(),
    space: space.value,
    status: "resolved",
  });
}

export function parseResolveBatchRequest(
  value: unknown,
): ParseResult<readonly ContentReference[]> {
  if (!Array.isArray(value)) return invalid("invalid_batch");
  if (value.length > MALLLEABLE_TEXT_LIMITS.batchSize) {
    return invalid("batch_too_large");
  }
  const parsed: ContentReference[] = [];
  const seen = new Set<string>();
  let identityCount = 0;
  for (const item of value) {
    const reference = parseContentReference(item);
    if (reference.status === "invalid") return reference;
    identityCount += 1 + reference.value.legacyContentIds.length;
    if (identityCount > MALLLEABLE_TEXT_LIMITS.batchIdentityCount) {
      return invalid("batch_too_large");
    }
    const key = `${reference.value.space}\u0000${reference.value.contentId}`;
    if (seen.has(key)) return invalid("invalid_batch");
    seen.add(key);
    parsed.push(reference.value);
  }
  return valid(parsed);
}

export function parseTextRange(value: unknown): ParseResult<TextRange> {
  if (!isRecord(value)) return invalid("invalid_range");
  const { end, exact, prefix, start, suffix } = value;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    (start as number) < 0 ||
    (end as number) <= (start as number) ||
    typeof exact !== "string" ||
    !isWellFormedUtf16(exact) ||
    exact.length !== (end as number) - (start as number) ||
    exact.length > MALLLEABLE_TEXT_LIMITS.textLength ||
    typeof prefix !== "string" ||
    !isWellFormedUtf16(prefix) ||
    prefix.length > MALLLEABLE_TEXT_LIMITS.contextLength ||
    typeof suffix !== "string" ||
    !isWellFormedUtf16(suffix) ||
    suffix.length > MALLLEABLE_TEXT_LIMITS.contextLength
  ) {
    return invalid("invalid_range");
  }
  return valid({
    end: end as number,
    exact,
    prefix,
    start: start as number,
    suffix,
  });
}

export function rangeMatchesText(text: string, range: TextRange): boolean {
  if (range.end > text.length) return false;
  if (text.slice(range.start, range.end) !== range.exact) return false;
  const prefixStart = Math.max(0, range.start - range.prefix.length);
  if (text.slice(prefixStart, range.start) !== range.prefix) return false;
  return text.slice(range.end, range.end + range.suffix.length) === range.suffix;
}

export function applyTextRange(
  text: string,
  range: TextRange,
  replacement: string,
): ParseResult<string> {
  if (!rangeMatchesText(text, range)) return invalid("range_mismatch");
  const next = `${text.slice(0, range.start)}${replacement}${text.slice(range.end)}`;
  return parseText(next);
}

export function textRangeFromSelection(
  text: string,
  start: number,
  end: number,
): ParseResult<TextRange> {
  const parsedText = parseText(text);
  if (parsedText.status === "invalid") return parsedText;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end <= start ||
    end > text.length
  ) {
    return invalid("invalid_range");
  }
  let prefixStart = Math.max(
    0,
    start - MALLLEABLE_TEXT_LIMITS.contextLength,
  );
  if (
    prefixStart > 0
    && isLowSurrogate(text.charCodeAt(prefixStart))
    && isHighSurrogate(text.charCodeAt(prefixStart - 1))
  ) {
    prefixStart += 1;
  }
  let suffixEnd = Math.min(
    text.length,
    end + MALLLEABLE_TEXT_LIMITS.contextLength,
  );
  if (
    suffixEnd < text.length
    && isLowSurrogate(text.charCodeAt(suffixEnd))
    && isHighSurrogate(text.charCodeAt(suffixEnd - 1))
  ) {
    suffixEnd -= 1;
  }
  return parseTextRange({
    end,
    exact: text.slice(start, end),
    prefix: text.slice(prefixStart, start),
    start,
    suffix: text.slice(end, suffixEnd),
  });
}

export function parseReplaceTextRequest(
  value: unknown,
): ParseResult<ReplaceTextRequest> {
  if (!isRecord(value)) return invalid("invalid_request");
  const descriptor = parseContentDescriptor(value.descriptor);
  if (descriptor.status === "invalid") return descriptor;
  const expectedRevision = parseRevision(value.expectedRevision);
  if (expectedRevision.status === "invalid") return expectedRevision;
  const requestId = parseRequestId(value.requestId);
  if (requestId.status === "invalid") return requestId;
  const range = parseTextRange(value.range);
  if (range.status === "invalid") return range;
  const replacement = parseText(value.replacement);
  if (replacement.status === "invalid") return replacement;
  return valid({
    descriptor: descriptor.value,
    expectedRevision: expectedRevision.value,
    range: range.value,
    replacement: replacement.value,
    requestId: requestId.value,
  });
}

export function parseResetTextRequest(
  value: unknown,
): ParseResult<ResetTextRequest> {
  if (!isRecord(value)) return invalid("invalid_request");
  const descriptor = parseContentDescriptor(value.descriptor);
  if (descriptor.status === "invalid") return descriptor;
  const expectedRevision = parseRevision(value.expectedRevision);
  if (expectedRevision.status === "invalid") return expectedRevision;
  const requestId = parseRequestId(value.requestId);
  if (requestId.status === "invalid") return requestId;
  return valid({
    descriptor: descriptor.value,
    expectedRevision: expectedRevision.value,
    requestId: requestId.value,
  });
}

export function parseMigrateAliasesRequest(
  value: unknown,
): ParseResult<MigrateAliasesRequest> {
  if (!isRecord(value)) return invalid("invalid_request");
  const descriptor = parseContentDescriptor(value.descriptor);
  if (descriptor.status === "invalid") return descriptor;
  if (descriptor.value.legacyContentIds.length === 0) {
    return invalid("invalid_alias");
  }
  const expectedRevision = parseRevision(value.expectedRevision);
  if (expectedRevision.status === "invalid") return expectedRevision;
  const requestId = parseRequestId(value.requestId);
  if (requestId.status === "invalid") return requestId;
  return valid({
    descriptor: descriptor.value,
    expectedRevision: expectedRevision.value,
    requestId: requestId.value,
  });
}

export function parseComponentReplaceTextRequest(
  value: unknown,
): ParseResult<ComponentReplaceTextRequest> {
  const parsed = parseReplaceTextRequest(value);
  if (parsed.status === "invalid") return parsed;
  const actor = isRecord(value) ? parseActorId(value.actorId) : invalid<string>("invalid_actor_id");
  if (actor.status === "invalid") return actor;
  return valid({ ...parsed.value, actorId: actor.value });
}

export function parseComponentResetTextRequest(
  value: unknown,
): ParseResult<ComponentResetTextRequest> {
  const parsed = parseResetTextRequest(value);
  if (parsed.status === "invalid") return parsed;
  const actor = isRecord(value) ? parseActorId(value.actorId) : invalid<string>("invalid_actor_id");
  if (actor.status === "invalid") return actor;
  return valid({ ...parsed.value, actorId: actor.value });
}

export function parseComponentMigrateAliasesRequest(
  value: unknown,
): ParseResult<ComponentMigrateAliasesRequest> {
  const parsed = parseMigrateAliasesRequest(value);
  if (parsed.status === "invalid") return parsed;
  const actor = isRecord(value) ? parseActorId(value.actorId) : invalid<string>("invalid_actor_id");
  if (actor.status === "invalid") return actor;
  return valid({ ...parsed.value, actorId: actor.value });
}

export function resolveClientContent(
  descriptorValue: unknown,
  resolutionValue: unknown,
): ParseResult<ResolvedContent> {
  const descriptor = parseContentDescriptor(descriptorValue);
  if (descriptor.status === "invalid") return descriptor;
  if (!isRecord(resolutionValue) || resolutionValue.status !== "resolved") {
    return invalid("invalid_batch");
  }
  const canonicalContentId = parseContentId(resolutionValue.canonicalContentId);
  if (canonicalContentId.status === "invalid") return canonicalContentId;
  const revision = parseRevision(resolutionValue.revision);
  if (revision.status === "invalid") return revision;
  const fingerprint = parseSourceFingerprint(resolutionValue.sourceFingerprint);
  if (fingerprint.status === "invalid") return fingerprint;
  if (
    resolutionValue.contentId !== descriptor.value.contentId ||
    resolutionValue.space !== descriptor.value.space ||
    typeof resolutionValue.viaLegacy !== "boolean"
  ) {
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
      viaLegacy: resolutionValue.viaLegacy,
    });
  }
  if (
    resolutionValue.origin !== "authored" ||
    typeof resolutionValue.sourceDrift !== "boolean"
  ) {
    return invalid("invalid_batch");
  }
  const text = parseText(resolutionValue.text);
  if (text.status === "invalid") return text;
  return valid({
    canonicalContentId: canonicalContentId.value,
    contentId: descriptor.value.contentId,
    origin: "authored",
    revision: revision.value,
    sourceDrift:
      resolutionValue.sourceDrift ||
      fingerprint.value !== descriptor.value.sourceFingerprint,
    sourceFingerprint: fingerprint.value,
    space: descriptor.value.space,
    text: text.value,
    viaLegacy: resolutionValue.viaLegacy,
  });
}

export function parseWriteResult(
  value: unknown,
  expectedRequestId?: string,
): ParseResult<WriteResult> {
  if (!isRecord(value)) return invalid("invalid_request");
  const requestId = parseRequestId(value.requestId);
  if (requestId.status === "invalid") return requestId;
  if (expectedRequestId !== undefined && requestId.value !== expectedRequestId) {
    return invalid("request_mismatch");
  }

  if (value.status === "forbidden") {
    return valid({ requestId: requestId.value, status: "forbidden" });
  }
  if (value.status === "retryable") {
    if (
      value.code !== "authorization_unavailable" &&
      value.code !== "component_unavailable"
    ) {
      return invalid("invalid_request");
    }
    return valid({
      code: value.code,
      requestId: requestId.value,
      status: "retryable",
    });
  }
  if (value.status === "invalid") {
    if (typeof value.code !== "string" || !invalidCodes.has(value.code as InvalidCode)) {
      return invalid("invalid_request");
    }
    return valid({
      code: value.code as InvalidCode,
      requestId: requestId.value,
      status: "invalid",
    });
  }
  if (value.status === "conflict") {
    const allowedCodes: ReadonlySet<WriteConflictResult["code"]> = new Set<
      WriteConflictResult["code"]
    >([
      "alias_collision",
      "alias_cycle",
      "ambiguous_legacy_history",
      "ambiguous_legacy_values",
      "range_mismatch",
      "revision_conflict",
      "source_mismatch",
    ]);
    if (
      typeof value.code !== "string" ||
      !allowedCodes.has(value.code as WriteConflictResult["code"])
    ) {
      return invalid("invalid_request");
    }
    if (value.currentRevision === null) {
      return valid({
        code: value.code as WriteConflictResult["code"],
        currentRevision: null,
        requestId: requestId.value,
        status: "conflict",
      });
    }
    const revision = parseRevision(value.currentRevision);
    if (revision.status === "invalid") return revision;
    return valid({
      code: value.code as WriteConflictResult["code"],
      currentRevision: revision.value,
      requestId: requestId.value,
      status: "conflict",
    });
  }
  if (value.status !== "saved") return invalid("invalid_request");

  const space = parseSpace(value.space);
  if (space.status === "invalid") return space;
  const contentId = parseContentId(value.contentId);
  if (contentId.status === "invalid") return contentId;
  const canonicalContentId = parseContentId(value.canonicalContentId);
  if (canonicalContentId.status === "invalid") return canonicalContentId;
  const revision = parseRevision(value.revision);
  if (revision.status === "invalid") return revision;
  const fingerprint = parseSourceFingerprint(value.sourceFingerprint);
  if (fingerprint.status === "invalid") return fingerprint;
  const text = parseText(value.text);
  if (text.status === "invalid") return text;
  if (
    (value.origin !== "authored" && value.origin !== "default") ||
    typeof value.replayed !== "boolean" ||
    typeof value.sourceDrift !== "boolean"
  ) {
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
    text: text.value,
  });
}

export function parseResolveBatchResult(
  value: unknown,
): ParseResult<ResolveBatchResult> {
  if (!isRecord(value)) return invalid("invalid_batch");
  if (value.status === "invalid") {
    if (typeof value.code !== "string" || !invalidCodes.has(value.code as InvalidCode)) {
      return invalid("invalid_batch");
    }
    return valid({
      code: value.code as InvalidCode,
      status: "invalid",
    });
  }
  if (
    value.status !== "resolved" ||
    !Array.isArray(value.items) ||
    value.items.length > MALLLEABLE_TEXT_LIMITS.batchSize
  ) {
    return invalid("invalid_batch");
  }

  const items: StoredResolution[] = [];
  for (const item of value.items) {
    if (!isRecord(item)) return invalid("invalid_batch");
    const space = parseSpace(item.space);
    if (space.status === "invalid") return invalid("invalid_batch");
    const contentId = parseContentId(item.contentId);
    if (contentId.status === "invalid") return invalid("invalid_batch");
    if (item.status === "conflict") {
      if (
        item.code !== "alias_collision" &&
        item.code !== "alias_cycle" &&
        item.code !== "ambiguous_legacy_history" &&
        item.code !== "ambiguous_legacy_values"
      ) {
        return invalid("invalid_batch");
      }
      items.push({
        code: item.code,
        contentId: contentId.value,
        space: space.value,
        status: "conflict",
      });
      continue;
    }
    if (item.status !== "resolved") return invalid("invalid_batch");
    const canonicalContentId = parseContentId(item.canonicalContentId);
    if (canonicalContentId.status === "invalid") return invalid("invalid_batch");
    const revision = parseRevision(item.revision);
    if (revision.status === "invalid") return invalid("invalid_batch");
    const fingerprint = parseSourceFingerprint(item.sourceFingerprint);
    if (fingerprint.status === "invalid") return invalid("invalid_batch");
    if (typeof item.viaLegacy !== "boolean") return invalid("invalid_batch");
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
        viaLegacy: item.viaLegacy,
      });
      continue;
    }
    if (item.origin !== "authored" || typeof item.sourceDrift !== "boolean") {
      return invalid("invalid_batch");
    }
    const text = parseText(item.text);
    if (text.status === "invalid") return invalid("invalid_batch");
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
      viaLegacy: item.viaLegacy,
    });
  }
  return valid({ items, status: "resolved" });
}

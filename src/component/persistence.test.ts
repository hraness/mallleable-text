import { describe, expect, test } from "bun:test";
import { convexTest } from "convex-test";

import {
  MALLLEABLE_TEXT_LIMITS,
  parseContentDescriptor,
  referenceFromDescriptor,
  sourceFingerprint,
  textRangeFromSelection,
  type ContentDescriptor,
} from "../model.js";
import { api } from "./_generated/api.js";
import schema from "./schema.js";

const modules = {
  "./_generated/api.ts": async () => await import("./_generated/api.js"),
  "./_generated/server.ts": async () => await import("./_generated/server.js"),
  "./persistence.ts": async () => await import("./persistence.js"),
};

function descriptor(
  contentId: string,
  defaultText: string,
  legacyContentIds: readonly string[] = [],
): ContentDescriptor {
  const parsed = parseContentDescriptor({
    contentId,
    defaultText,
    legacyContentIds,
    space: "site",
  });
  if (parsed.status === "invalid") throw new Error(parsed.code);
  return parsed.value;
}

function range(text: string, exact: string) {
  const start = text.indexOf(exact);
  const parsed = textRangeFromSelection(text, start, start + exact.length);
  if (parsed.status === "invalid") throw new Error(parsed.code);
  return parsed.value;
}

function replaceRequest(
  content: ContentDescriptor,
  currentText: string,
  exact: string,
  replacement: string,
  expectedRevision: number,
  requestId: string,
) {
  return {
    actorId: "opaque-admin-1",
    descriptor: content,
    expectedRevision,
    range: range(currentText, exact),
    replacement,
    requestId,
  };
}

describe("range writes", () => {
  test("supports first save, CAS, exact replay, conflict, and reset", async () => {
    const t = convexTest(schema, modules);
    const content = descriptor("home.heading", "Hello world");
    const firstRequest = replaceRequest(
      content,
      content.defaultText,
      "world",
      "reader",
      0,
      "request-first",
    );
    const first = await t.mutation(api.persistence.replaceText, {
      request: firstRequest,
    });
    expect(first).toMatchObject({
      replayed: false,
      revision: 1,
      status: "saved",
      text: "Hello reader",
    });

    const replay = await t.mutation(api.persistence.replaceText, {
      request: firstRequest,
    });
    expect(replay).toMatchObject({
      replayed: true,
      revision: 1,
      status: "saved",
      text: "Hello reader",
    });

    const reused = await t.mutation(api.persistence.replaceText, {
      request: { ...firstRequest, replacement: "someone else" },
    });
    expect(reused).toEqual({
      code: "request_mismatch",
      requestId: "request-first",
      status: "invalid",
    });

    const stale = await t.mutation(api.persistence.replaceText, {
      request: replaceRequest(
        content,
        content.defaultText,
        "world",
        "stale",
        0,
        "request-stale",
      ),
    });
    expect(stale).toEqual({
      code: "revision_conflict",
      currentRevision: 1,
      requestId: "request-stale",
      status: "conflict",
    });

    const second = await t.mutation(api.persistence.replaceText, {
      request: replaceRequest(
        content,
        "Hello reader",
        "reader",
        "friend",
        1,
        "request-second",
      ),
    });
    expect(second).toMatchObject({
      revision: 2,
      status: "saved",
      text: "Hello friend",
    });

    const reset = await t.mutation(api.persistence.resetText, {
      request: {
        actorId: "opaque-admin-1",
        descriptor: content,
        expectedRevision: 2,
        requestId: "request-reset",
      },
    });
    expect(reset).toMatchObject({
      origin: "default",
      revision: 3,
      status: "saved",
      text: "Hello world",
    });
  });

  test("verifies quote and context against canonical text", async () => {
    const t = convexTest(schema, modules);
    const content = descriptor("home.body", "before selected after");
    const request = replaceRequest(
      content,
      content.defaultText,
      "selected",
      "new",
      0,
      "request-tampered",
    );
    const result = await t.mutation(api.persistence.replaceText, {
      request: {
        ...request,
        range: { ...request.range, prefix: "tampered" },
      },
    });
    expect(result).toEqual({
      code: "range_mismatch",
      currentRevision: 0,
      requestId: "request-tampered",
      status: "conflict",
    });
  });

  test("uses UTF-16 offsets for emoji and combining text", async () => {
    const t = convexTest(schema, modules);
    const original = "Edit 👩🏽‍💻 then e\u0301.";
    const content = descriptor("home.unicode", original);
    const emoji = await t.mutation(api.persistence.replaceText, {
      request: replaceRequest(
        content,
        original,
        "👩🏽‍💻",
        "code",
        0,
        "request-emoji",
      ),
    });
    expect(emoji).toMatchObject({
      revision: 1,
      status: "saved",
      text: "Edit code then e\u0301.",
    });
    const combining = await t.mutation(api.persistence.replaceText, {
      request: replaceRequest(
        content,
        "Edit code then e\u0301.",
        "e\u0301",
        "é",
        1,
        "request-combining",
      ),
    });
    expect(combining).toMatchObject({
      revision: 2,
      status: "saved",
      text: "Edit code then é.",
    });
  });

  test("allows only one same-revision writer", async () => {
    const t = convexTest(schema, modules);
    const content = descriptor("home.race", "Pick one");
    const [left, right] = await Promise.all([
      t.mutation(api.persistence.replaceText, {
        request: replaceRequest(
          content,
          content.defaultText,
          "one",
          "left",
          0,
          "request-left",
        ),
      }),
      t.mutation(api.persistence.replaceText, {
        request: replaceRequest(
          content,
          content.defaultText,
          "one",
          "right",
          0,
          "request-right",
        ),
      }),
    ]);
    expect([left.status, right.status].sort()).toEqual(["conflict", "saved"]);
  });

  test("enforces maximum text bounds", async () => {
    const t = convexTest(schema, modules);
    const content = descriptor("home.maximum", "x");
    const result = await t.mutation(api.persistence.replaceText, {
      request: {
        ...replaceRequest(
          content,
          "x",
          "x",
          "y",
          0,
          "request-maximum",
        ),
        replacement: "y".repeat(MALLLEABLE_TEXT_LIMITS.textLength + 1),
      },
    });
    expect(result).toEqual({
      code: "text_too_long",
      requestId: "request-maximum",
      status: "invalid",
    });
  });

  test("persists a fixed-size replay identity for maximum escaped text", async () => {
    const t = convexTest(schema, modules);
    const source = "\u0001".repeat(MALLLEABLE_TEXT_LIMITS.textLength);
    const replacement = "\u0002".repeat(MALLLEABLE_TEXT_LIMITS.textLength);
    const content = descriptor("home.escaped-maximum", source);
    const request = replaceRequest(
      content,
      source,
      source,
      replacement,
      0,
      "request-escaped-maximum",
    );
    expect(JSON.stringify({ operation: "replaceText", request }).length)
      .toBeGreaterThan(1_000_000);

    const saved = await t.mutation(api.persistence.replaceText, { request });
    expect(saved).toMatchObject({
      replayed: false,
      revision: 1,
      status: "saved",
    });
    const persisted = await t.run(async (ctx) =>
      await ctx.db
        .query("requests")
        .withIndex("by_space_request", (index) =>
          index
            .eq("space", content.space)
            .eq("requestId", request.requestId),
        )
        .unique(),
    );
    expect(persisted?.identity).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(persisted?.identity).toHaveLength(71);

    const replay = await t.mutation(api.persistence.replaceText, { request });
    expect(replay).toMatchObject({
      replayed: true,
      revision: 1,
      status: "saved",
    });
    const mismatch = await t.mutation(api.persistence.replaceText, {
      request: {
        ...request,
        replacement: `\u0003${replacement.slice(1)}`,
      },
    });
    expect(mismatch).toEqual({
      code: "request_mismatch",
      requestId: request.requestId,
      status: "invalid",
    });
  });

  test("bounds the lost-response replay window per content ID", async () => {
    const t = convexTest(schema, modules);
    const content = descriptor("home.replay-window", "value-0");
    let current = content.defaultText;
    for (
      let revision = 0;
      revision < MALLLEABLE_TEXT_LIMITS.replayRequestsPerContent + 1;
      revision += 1
    ) {
      const next = `value-${revision + 1}`;
      const result = await t.mutation(api.persistence.replaceText, {
        request: replaceRequest(
          content,
          current,
          current,
          next,
          revision,
          `request-window-${revision}`,
        ),
      });
      expect(result.status).toBe("saved");
      current = next;
    }
    const retained = await t.run(async (ctx) =>
      await ctx.db
        .query("requests")
        .withIndex("by_space_content", (index) =>
          index
            .eq("space", "site")
            .eq("contentId", "home.replay-window"),
        )
        .collect(),
    );
    expect(retained).toHaveLength(
      MALLLEABLE_TEXT_LIMITS.replayRequestsPerContent,
    );
  });
});

describe("anonymous resolution and aliases", () => {
  test("returns canonical authored values, leaves defaults client-side, and reports drift", async () => {
    const t = convexTest(schema, modules);
    const authored = descriptor("home.authored", "Original source");
    await t.mutation(api.persistence.replaceText, {
      request: replaceRequest(
        authored,
        authored.defaultText,
        "Original",
        "Authored",
        0,
        "request-authored",
      ),
    });
    const changedSource = descriptor("home.authored", "Changed source");
    const missing = descriptor("home.missing", "Client-only default");
    const result = await t.query(api.persistence.resolveBatch, {
      requests: [
        referenceFromDescriptor(changedSource),
        referenceFromDescriptor(missing),
      ],
    });
    expect(result.status).toBe("resolved");
    if (result.status !== "resolved") throw new Error(result.code);
    const authoredItem = result.items[0];
    const missingItem = result.items[1];
    if (authoredItem === undefined || missingItem === undefined) {
      throw new Error("missing resolution fixture");
    }
    expect(authoredItem).toMatchObject({
      canonicalContentId: "home.authored",
      origin: "authored",
      sourceDrift: true,
      status: "resolved",
      text: "Authored source",
    });
    expect(missingItem).toMatchObject({
      canonicalContentId: "home.missing",
      origin: "default",
      revision: 0,
      status: "resolved",
    });
    expect(Object.hasOwn(missingItem, "text")).toBe(false);
  });

  test("migrates one authored value and converges old and new readers", async () => {
    const t = convexTest(schema, modules);
    const old = descriptor("home.old-title", "Default title");
    await t.mutation(api.persistence.replaceText, {
      request: replaceRequest(
        old,
        old.defaultText,
        "Default",
        "Custom",
        0,
        "request-old-save",
      ),
    });
    const renamed = descriptor(
      "home.new-title",
      "Updated default",
      ["home.old-title"],
    );
    const migrated = await t.mutation(api.persistence.migrateAliases, {
      request: {
        actorId: "opaque-admin-1",
        descriptor: renamed,
        expectedRevision: 1,
        requestId: "request-migrate",
      },
    });
    expect(migrated).toMatchObject({
      canonicalContentId: "home.new-title",
      revision: 2,
      status: "saved",
      text: "Custom title",
    });
    const result = await t.query(api.persistence.resolveBatch, {
      requests: [
        {
          contentId: "home.old-title",
          legacyContentIds: [],
          sourceFingerprint: sourceFingerprint("Default title"),
          space: "site",
        },
        referenceFromDescriptor(renamed),
      ],
    });
    if (result.status !== "resolved") throw new Error(result.code);
    expect(result.items.map((item) =>
      "canonicalContentId" in item ? item.canonicalContentId : undefined,
    )).toEqual([
      "home.new-title",
      "home.new-title",
    ]);
    expect(result.items.map((item) =>
      "text" in item ? item.text : undefined,
    )).toEqual([
      "Custom title",
      "Custom title",
    ]);
  });

  test("does not resurrect authored legacy text across a canonical reset", async () => {
    const t = convexTest(schema, modules);
    const canonical = descriptor("home.new-title", "Canonical default");
    await t.mutation(api.persistence.replaceText, {
      request: replaceRequest(
        canonical,
        canonical.defaultText,
        "Canonical",
        "Authored",
        0,
        "request-canonical-save",
      ),
    });
    await t.mutation(api.persistence.resetText, {
      request: {
        actorId: "opaque-admin-1",
        descriptor: canonical,
        expectedRevision: 1,
        requestId: "request-canonical-reset",
      },
    });
    const legacy = descriptor("home.old-title", "Legacy default");
    await t.mutation(api.persistence.replaceText, {
      request: replaceRequest(
        legacy,
        legacy.defaultText,
        "Legacy",
        "Custom",
        0,
        "request-legacy-save",
      ),
    });
    const renamed = descriptor(
      canonical.contentId,
      canonical.defaultText,
      [legacy.contentId],
    );

    const resolved = await t.query(api.persistence.resolveBatch, {
      requests: [referenceFromDescriptor(renamed)],
    });
    expect(resolved).toEqual({
      items: [{
        code: "ambiguous_legacy_history",
        contentId: canonical.contentId,
        space: "site",
        status: "conflict",
      }],
      status: "resolved",
    });

    const replace = await t.mutation(api.persistence.replaceText, {
      request: replaceRequest(
        renamed,
        canonical.defaultText,
        "Canonical",
        "Current",
        2,
        "request-mixed-replace",
      ),
    });
    const reset = await t.mutation(api.persistence.resetText, {
      request: {
        actorId: "opaque-admin-1",
        descriptor: renamed,
        expectedRevision: 2,
        requestId: "request-mixed-reset",
      },
    });
    const migrate = await t.mutation(api.persistence.migrateAliases, {
      request: {
        actorId: "opaque-admin-1",
        descriptor: renamed,
        expectedRevision: 2,
        requestId: "request-mixed-migrate",
      },
    });
    for (const result of [replace, reset, migrate]) {
      expect(result).toMatchObject({
        code: "ambiguous_legacy_history",
        currentRevision: null,
        status: "conflict",
      });
    }
  });

  test("fails alias collisions, cycles, and ambiguous legacy values closed", async () => {
    const t = convexTest(schema, modules);
    const first = descriptor("legacy.first", "First");
    const second = descriptor("legacy.second", "Second");
    await t.mutation(api.persistence.replaceText, {
      request: replaceRequest(
        first,
        first.defaultText,
        "First",
        "Value A",
        0,
        "request-first-value",
      ),
    });
    await t.mutation(api.persistence.replaceText, {
      request: replaceRequest(
        second,
        second.defaultText,
        "Second",
        "Value B",
        0,
        "request-second-value",
      ),
    });
    const ambiguous = descriptor("current.value", "Current", [
      "legacy.first",
      "legacy.second",
    ]);
    const ambiguousResult = await t.mutation(api.persistence.migrateAliases, {
      request: {
        actorId: "opaque-admin-1",
        descriptor: ambiguous,
        expectedRevision: 1,
        requestId: "request-ambiguous",
      },
    });
    expect(ambiguousResult).toMatchObject({
      code: "ambiguous_legacy_values",
      status: "conflict",
    });

    const owned = descriptor("owner.value", "Owner", ["shared.alias"]);
    await t.mutation(api.persistence.migrateAliases, {
      request: {
        actorId: "opaque-admin-1",
        descriptor: owned,
        expectedRevision: 0,
        requestId: "request-own-alias",
      },
    });
    const collision = descriptor("other.value", "Other", ["shared.alias"]);
    const collisionResult = await t.mutation(api.persistence.migrateAliases, {
      request: {
        actorId: "opaque-admin-1",
        descriptor: collision,
        expectedRevision: 0,
        requestId: "request-collision",
      },
    });
    expect(collisionResult).toMatchObject({
      code: "alias_collision",
      status: "conflict",
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("aliases", {
        aliasContentId: "cycle.a",
        space: "site",
        targetContentId: "cycle.b",
      });
      await ctx.db.insert("aliases", {
        aliasContentId: "cycle.b",
        space: "site",
        targetContentId: "cycle.a",
      });
    });
    const cycleResult = await t.query(api.persistence.resolveBatch, {
      requests: [
        {
          contentId: "cycle.a",
          legacyContentIds: [],
          sourceFingerprint: sourceFingerprint("Cycle"),
          space: "site",
        },
      ],
    });
    if (cycleResult.status !== "resolved") throw new Error(cycleResult.code);
    expect(cycleResult.items[0]).toMatchObject({
      code: "alias_cycle",
      status: "conflict",
    });
  });

  test("includes transitive inbound aliases in authorization and write analysis", async () => {
    const t = convexTest(schema, modules);
    const canonical = descriptor("canonical.value", "Canonical source");
    await t.mutation(api.persistence.replaceText, {
      request: replaceRequest(
        canonical,
        canonical.defaultText,
        "Canonical",
        "Authored",
        0,
        "request-canonical-value",
      ),
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("aliases", {
        aliasContentId: "legacy.near",
        space: "site",
        targetContentId: canonical.contentId,
      });
      await ctx.db.insert("aliases", {
        aliasContentId: "legacy.far",
        space: "site",
        targetContentId: "legacy.near",
      });
    });

    const targets = await t.query(api.persistence.authorizationTargets, {
      reference: referenceFromDescriptor(canonical),
    });
    expect(targets).toEqual({
      canonicalContentId: canonical.contentId,
      contentIds: [
        canonical.contentId,
        "legacy.far",
        "legacy.near",
      ],
      space: "site",
      status: "resolved",
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("content", {
        contentId: "legacy.far",
        revision: 1,
        sourceFingerprint: sourceFingerprint("Legacy source"),
        sourceText: "Legacy source",
        space: "site",
        text: "Protected value",
      });
    });

    const write = await t.mutation(api.persistence.replaceText, {
      request: replaceRequest(
        canonical,
        "Authored source",
        "Authored",
        "Changed",
        1,
        "request-inbound-conflict",
      ),
    });
    expect(write).toMatchObject({
      code: "ambiguous_legacy_values",
      currentRevision: null,
      status: "conflict",
    });
  });

  test("fails closed on excessive inbound alias depth and fanout", async () => {
    const deep = convexTest(schema, modules);
    await deep.run(async (ctx) => {
      let targetContentId = "depth.root";
      for (let index = 0; index < MALLLEABLE_TEXT_LIMITS.aliasHops; index += 1) {
        const aliasContentId = `depth.${index}`;
        await ctx.db.insert("aliases", {
          aliasContentId,
          space: "site",
          targetContentId,
        });
        targetContentId = aliasContentId;
      }
    });
    const excessiveDepth = await deep.query(
      api.persistence.authorizationTargets,
      {
        reference: referenceFromDescriptor(
          descriptor("depth.root", "Depth fallback"),
        ),
      },
    );
    expect(excessiveDepth).toEqual({
      code: "alias_cycle",
      status: "conflict",
    });

    const wide = convexTest(schema, modules);
    await wide.run(async (ctx) => {
      for (
        let index = 0;
        index < MALLLEABLE_TEXT_LIMITS.analysisLookups;
        index += 1
      ) {
        await ctx.db.insert("aliases", {
          aliasContentId: `fanout.${index}`,
          space: "site",
          targetContentId: "fanout.root",
        });
      }
    });
    const excessiveFanout = await wide.query(
      api.persistence.authorizationTargets,
      {
        reference: referenceFromDescriptor(
          descriptor("fanout.root", "Fanout fallback"),
        ),
      },
    );
    expect(excessiveFanout).toEqual({
      code: "analysis_limit_exceeded",
      status: "invalid",
    });
  });

  test("memoizes a shared maximum-depth alias path across a full batch", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      for (let index = 0; index < MALLLEABLE_TEXT_LIMITS.batchSize; index += 1) {
        await ctx.db.insert("aliases", {
          aliasContentId: `head.${index}`,
          space: "site",
          targetContentId: "shared.0",
        });
      }
      for (let index = 0; index < 15; index += 1) {
        await ctx.db.insert("aliases", {
          aliasContentId: `shared.${index}`,
          space: "site",
          targetContentId: index === 14
            ? "shared.root"
            : `shared.${index + 1}`,
        });
      }
    });
    const result = await t.query(api.persistence.resolveBatch, {
      requests: Array.from({
        length: MALLLEABLE_TEXT_LIMITS.batchSize,
      }, (_, index) => ({
        contentId: `head.${index}`,
        legacyContentIds: [],
        sourceFingerprint: sourceFingerprint("Fallback"),
        space: "site",
      })),
    });
    expect(result.status).toBe("resolved");
    if (result.status !== "resolved") throw new Error(result.code);
    expect(result.items).toHaveLength(MALLLEABLE_TEXT_LIMITS.batchSize);
    expect(result.items.every(item =>
      item.status === "resolved"
      && item.canonicalContentId === "shared.root"
      && item.revision === 0
      && item.viaLegacy
    )).toBe(true);
  });
});

import { expect, test } from "bun:test";
import { convexTest } from "convex-test";
import { defineSchema, defineTable, makeFunctionReference } from "convex/server";
import { v } from "convex/values";

import {
  parseContentDescriptor,
  textRangeFromSelection,
  type ContentDescriptor,
  type WriteResult,
} from "../model.js";
import { register } from "../test.js";

const hostSchema = defineSchema({
  hostUsers: defineTable({
    capabilities: v.object({
      "hraness/mallleable-text:admin": v.boolean(),
    }),
    subject: v.string(),
  }).index("by_subject", ["subject"]),
});

const hostModules = {
  "./_generated/api.ts": async () =>
    await import("../component/_generated/api.js"),
  "./_generated/server.ts": async () =>
    await import("../component/_generated/server.js"),
  "./client/host.fixture.ts": async () => await import("./host.fixture.js"),
};

const replaceText = makeFunctionReference<
  "mutation",
  { request: unknown },
  WriteResult
>(
  "client/host.fixture:replaceText",
);

const seedAlias = makeFunctionReference<
  "mutation",
  { request: unknown },
  WriteResult
>("client/host.fixture:seedAlias");

function descriptor(
  legacyContentIds: readonly string[] = [],
): ContentDescriptor {
  const parsed = parseContentDescriptor({
    contentId: "home.heading",
    defaultText: "Hello world",
    legacyContentIds,
    space: "site",
  });
  if (parsed.status === "invalid") throw new Error(parsed.code);
  return parsed.value;
}

function request(
  requestId: string,
  expectedRevision = 0,
  legacyContentIds: readonly string[] = [],
) {
  const content = descriptor(legacyContentIds);
  return requestForDescriptor(
    content,
    requestId,
    expectedRevision,
  );
}

function requestForDescriptor(
  content: ContentDescriptor,
  requestId: string,
  expectedRevision: number,
) {
  const selected = textRangeFromSelection(content.defaultText, 6, 11);
  if (selected.status === "invalid") throw new Error(selected.code);
  return {
    descriptor: content,
    expectedRevision,
    range: selected.value,
    replacement: "reader",
    requestId,
  };
}

test("host writes authorize from trusted app state every time", async () => {
  const t = convexTest(hostSchema, hostModules);
  register(t);

  const signedOut = await t.mutation(replaceText, {
    request: request("signed-out"),
  });
  expect(signedOut).toEqual({ requestId: "signed-out", status: "forbidden" });

  await t.run(async (ctx) => {
    await ctx.db.insert("hostUsers", {
      capabilities: { "hraness/mallleable-text:admin": false },
      subject: "person-1",
    });
  });
  const signedIn = t.withIdentity({ subject: "person-1" });
  const nonAdmin = await signedIn.mutation(replaceText, {
    request: request("non-admin"),
  });
  expect(nonAdmin).toEqual({ requestId: "non-admin", status: "forbidden" });

  await t.run(async (ctx) => {
    const user = await ctx.db
      .query("hostUsers")
      .withIndex("by_subject", (index) => index.eq("subject", "person-1"))
      .unique();
    if (user === null) throw new Error("missing fixture user");
    await ctx.db.patch(user._id, {
      capabilities: { "hraness/mallleable-text:admin": true },
    });
  });
  const admin = await signedIn.mutation(replaceText, {
    request: request("admin-save"),
  });
  expect(admin).toMatchObject({
    requestId: "admin-save",
    revision: 1,
    status: "saved",
    text: "Hello reader",
  });

  const protectedAlias = await signedIn.mutation(replaceText, {
    request: request("protected-alias", 1, ["home.protected"]),
  });
  expect(protectedAlias).toEqual({
    requestId: "protected-alias",
    status: "forbidden",
  });

  const protectedCanonical = parseContentDescriptor({
    contentId: "home.protected",
    defaultText: "Hello world",
    legacyContentIds: ["home.allowed"],
    space: "site",
  });
  if (protectedCanonical.status === "invalid") {
    throw new Error(protectedCanonical.code);
  }
  await t.mutation(seedAlias, {
    request: {
      actorId: "fixture-seed",
      descriptor: protectedCanonical.value,
      expectedRevision: 0,
      requestId: "seed-stored-alias",
    },
  });
  const oldId = parseContentDescriptor({
    contentId: "home.allowed",
    defaultText: "Hello world",
    legacyContentIds: [],
    space: "site",
  });
  if (oldId.status === "invalid") throw new Error(oldId.code);
  const storedAlias = await signedIn.mutation(replaceText, {
    request: requestForDescriptor(oldId.value, "stored-alias", 1),
  });
  expect(storedAlias).toEqual({
    requestId: "stored-alias",
    status: "forbidden",
  });

  await t.run(async (ctx) => {
    const user = await ctx.db
      .query("hostUsers")
      .withIndex("by_subject", (index) => index.eq("subject", "person-1"))
      .unique();
    if (user === null) throw new Error("missing fixture user");
    await ctx.db.patch(user._id, {
      capabilities: { "hraness/mallleable-text:admin": false },
    });
  });
  const revoked = await signedIn.mutation(replaceText, {
    request: request("revoked", 1),
  });
  expect(revoked).toEqual({ requestId: "revoked", status: "forbidden" });
});

test("host writes authorize protected aliases that point to an allowed canonical ID", async () => {
  const t = convexTest(hostSchema, hostModules);
  register(t);
  await t.run(async (ctx) => {
    await ctx.db.insert("hostUsers", {
      capabilities: { "hraness/mallleable-text:admin": true },
      subject: "person-1",
    });
  });
  const admin = t.withIdentity({ subject: "person-1" });
  const canonical = parseContentDescriptor({
    contentId: "home.allowed-canonical",
    defaultText: "Hello world",
    legacyContentIds: ["home.protected"],
    space: "site",
  });
  if (canonical.status === "invalid") throw new Error(canonical.code);
  const seeded = await t.mutation(seedAlias, {
    request: {
      actorId: "fixture-seed",
      descriptor: canonical.value,
      expectedRevision: 0,
      requestId: "seed-protected-inbound-alias",
    },
  });
  expect(seeded).toMatchObject({ revision: 1, status: "saved" });

  const canonicalOnly = parseContentDescriptor({
    contentId: canonical.value.contentId,
    defaultText: canonical.value.defaultText,
    legacyContentIds: [],
    space: canonical.value.space,
  });
  if (canonicalOnly.status === "invalid") {
    throw new Error(canonicalOnly.code);
  }
  const result = await admin.mutation(replaceText, {
    request: requestForDescriptor(
      canonicalOnly.value,
      "protected-inbound-alias",
      1,
    ),
  });
  expect(result).toEqual({
    requestId: "protected-inbound-alias",
    status: "forbidden",
  });
});

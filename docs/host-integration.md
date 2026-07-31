# Host integration

The host application owns four things that the package cannot decide: user identity, the author capability, public or private read policy, and how saved results refresh the rendered page.

## Register the component

Add the component to `convex/convex.config.ts`:

```ts
import mallleableText from "@hraness/mallleable-text/convex.config.js";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(mallleableText);

export default app;
```

Run `bunx convex dev` so the host's generated `components` object includes `components.mallleableText`.

## Put the capability in the host schema

Keep the user table in the application. This example gives prose authoring one dedicated optional capability:

```ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    authSubject: v.string(),
    displayName: v.string(),
    malleableTextAdmin: v.optional(v.boolean()),
  }).index("by_auth_subject", ["authSubject"]),
});
```

Grant `malleableTextAdmin: true` through an audited, server-owned account workflow. An absent or false value denies authoring. Do not let a client update this field through a generic profile mutation.

If the application uses a capability map, use a specific key such as `hraness/mallleable-text:admin`. Keep the same fail-closed behavior.

## Read the user through an internal query

The authorization callback receives the caller's trusted Convex identity and can run an internal query. Keep the typed user-table lookup in a separate host file:

```ts
// convex/mallleableTextPolicy.ts
import { v } from "convex/values";

import { internalQuery } from "./_generated/server";

export const authorBySubject = internalQuery({
  args: { authSubject: v.string() },
  returns: v.union(
    v.null(),
    v.object({ actorId: v.string() }),
  ),
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (index) =>
        index.eq("authSubject", args.authSubject),
      )
      .take(2);
    const [user] = users;

    if (users.length !== 1 || user?.malleableTextAdmin !== true) {
      return null;
    }

    return { actorId: `user:${user._id}` };
  },
});
```

The duplicate check matters because an index does not enforce uniqueness. Ambiguous identities deny access. The opaque actor ID should be stable, bounded, and free of an email address, display name, access token, or other unnecessary personal data.

## Expose safe host functions

Use `exposeApi` with the installed component. Export its function definitions from a normal host Convex module:

```ts
// convex/mallleableText.ts
import { exposeApi } from "@hraness/mallleable-text";

import { components, internal } from "./_generated/api";

const exposed = exposeApi(components.mallleableText, {
  authorize: async (ctx, operation) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) return { canEdit: false };

    // Optional: use operation.space, operation.contentId, or operation.type
    // to apply a narrower host policy. The component checks the canonical ID
    // and each legacy ID separately. All checks must authorize the same actor.
    const author = await ctx.runQuery(
      internal.mallleableTextPolicy.authorBySubject,
      { authSubject: identity.subject },
    );

    return author === null
      ? { canEdit: false }
      : { actorId: author.actorId, canEdit: true };
  },
});

export const resolveBatch = exposed.resolveBatch;
export const replaceText = exposed.replaceText;
export const resetText = exposed.resetText;
export const migrateAliases = exposed.migrateAliases;
```

`resolveBatch` is anonymous by default. Each write parses its request, calls `authorize`, adds the trusted actor ID, and then calls the isolated component. The browser never receives a component mutation reference.

The write wrapper returns `forbidden` when the callback denies access. If the callback throws, it returns `retryable` with `authorization_unavailable`. If the component call fails, it returns `retryable` with `component_unavailable`. None of those outcomes writes content.

The `operation` value contains `type`, `space`, and `contentId`. Use it to limit an author to particular content spaces or operations when one global capability is too broad.

## Decide whether reads are public

The default `resolveBatch` function does not authenticate. This suits public site prose and keeps server rendering simple.

Do not export that query for confidential prose. Create a host-owned query that checks the caller before it runs `components.mallleableText.persistence.resolveBatch`. Apply the same duplicate-user and capability checks as the write path. The component's table isolation does not turn public prose into a safe place for secrets.

## Resolve a descriptor

The component read accepts content references, not source fallback text. This keeps the stored response small and makes source the authority for defaults.

```tsx
import {
  referenceFromDescriptor,
  resolveClientContent,
} from "@hraness/mallleable-text";
import { useQuery } from "convex/react";

import { api } from "../convex/_generated/api";
import { introduction } from "./content";

export function useIntroduction() {
  const result = useQuery(api.mallleableText.resolveBatch, {
    requests: [referenceFromDescriptor(introduction)],
  });

  const stored = result?.status === "resolved" ? result.items[0] : undefined;
  if (stored?.status === "conflict") {
    throw new Error(`Content identity conflict: ${stored.code}`);
  }
  const parsed = resolveClientContent(introduction, stored);

  return parsed.status === "valid"
    ? parsed.value
    : {
        canonicalContentId: introduction.contentId,
        contentId: introduction.contentId,
        origin: "default" as const,
        revision: 0,
        sourceDrift: false,
        sourceFingerprint: introduction.sourceFingerprint,
        space: introduction.space,
        text: introduction.defaultText,
        viaLegacy: false,
      };
}
```

For server rendering, call the same host query from the application's trusted Convex client. Set the default source text before the request begins, and keep it when the query is unavailable. A client-only loading gap should not erase the source prose.

Treat an alias conflict as an operator-visible error. Source fallback is appropriate for an unavailable read, not for a collision, cycle, or ambiguous authored value.

## Connect the save adapter

Parse the host mutation result because network and generated `v.any()` values cross a trust boundary:

```tsx
import { parseWriteResult } from "@hraness/mallleable-text";
import type { MalleableTextSaveAdapter } from "@hraness/mallleable-text/react";
import { useMutation } from "convex/react";
import { useCallback } from "react";

import { api } from "../convex/_generated/api";

export function useMalleableTextSave(): MalleableTextSaveAdapter {
  const replaceText = useMutation(api.mallleableText.replaceText);

  return useCallback(async (request, { signal }) => {
    if (signal.aborted) {
      return {
        code: "component_unavailable",
        requestId: request.requestId,
        status: "retryable",
      };
    }

    const raw = await replaceText({ request });
    const parsed = parseWriteResult(raw, request.requestId);

    return parsed.status === "valid"
      ? parsed.value
      : {
          code: "component_unavailable",
          requestId: request.requestId,
          status: "retryable",
        };
  }, [replaceText]);
}
```

An `AbortSignal` stops stale controller work, but it cannot prove that a remote mutation did not commit. Retry an unchanged request with the same request ID. Exact request replay is the correctness mechanism for a lost response.

After a `saved` result, let the normal Convex query subscription or application state update render the returned text and revision. Do not assign directly to a marker's DOM text.

## Connect sign-in and author state

Map the application's existing account state to `MalleableTextAccess`:

```ts
import type { MalleableTextAccess } from "@hraness/mallleable-text/react";

type SessionState =
  | { status: "signed-out"; signIn: () => void }
  | {
      status: "ready";
      displayName: string;
      malleableTextAdmin: boolean;
      signOut: () => void;
    };

export function authorAccess(session: SessionState): MalleableTextAccess {
  if (session.status === "signed-out") {
    return { status: "no-session", signIn: session.signIn };
  }
  if (session.status === "ready" && session.malleableTextAdmin) {
    return {
      status: "authorized",
      accountLabel: session.displayName,
      signOut: session.signOut,
    };
  }
  return { status: "read-only" };
}
```

This access state controls whether the React editor appears. It is not authorization evidence. A stale or modified browser can still call a mutation, so the host wrapper must check the current user table on every write.

Use one sign-in route that returns the author to the page they were reading. Keep identity-provider tokens in the host's established secure session boundary. The package needs only the supplied sign-in action and the host mutation result.

## Reset and alias migration

Reset and migration are server-authorized operations, even if the application exposes them only in an administrative tool. Both require the current expected revision and a unique request ID.

A reset removes the authored override and advances the revision to the descriptor's current source default. An alias migration makes earlier semantic IDs resolve to one canonical ID. Read [Content migrations](./content-migrations.md) before exposing either operation.

# Malleable Text

> [!IMPORTANT]
> Malleable Text is retired. No current Hraness application uses this package, and no maintenance, security updates, or compatibility work is planned. The [`v0.1.0` tag](https://github.com/hraness/mallleable-text/tree/v0.1.0) and [immutable GitHub release](https://github.com/hraness/mallleable-text/releases/tag/v0.1.0) are retained for existing Git-pinned installs and historical reference. The remaining documentation describes that release.

Malleable Text keeps prose in source and lets authorized authors revise a selected passage on the rendered page. An isolated Convex Component stores the current plain-text override. The host application keeps control of sign-in, authorization, server rendering, and data flow.

Source text remains useful when persistence or JavaScript is unavailable. Stable semantic IDs let an override follow its content when components, files, routes, or DOM structure change.

## Archived release

An existing project that must reproduce the final release can pin its immutable tag:

```json
{
  "dependencies": {
    "@hraness/mallleable-text": "github:hraness/mallleable-text#v0.1.0"
  }
}
```

Install that pinned release with Bun:

```sh
bun install
```

The package has peer dependencies on Convex, React, and React DOM. The model and host helpers are available from the root import. React and browser behavior stays in `@hraness/mallleable-text/react`.

## Install the Convex Component

Add the component to the host application's `convex/convex.config.ts`:

```ts
import mallleableText from "@hraness/mallleable-text/convex.config.js";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(mallleableText);

export default app;
```

Run Convex code generation after installation:

```sh
bunx convex dev
```

The component owns isolated tables for content, aliases, and exact request replay. It cannot read the host application's user table and does not install an authentication provider.

## Define authorable prose

Give each prose segment a semantic ID. Keep that ID when implementation details change.

```ts
import {
  sourceFingerprint,
  type ContentDescriptor,
} from "@hraness/mallleable-text";

const defaultText = "Build a durable interface for your content.";

export const introduction = {
  space: "website.en",
  contentId: "home.introduction",
  defaultText,
  legacyContentIds: [],
  sourceFingerprint: sourceFingerprint(defaultText),
} satisfies ContentDescriptor;
```

`space` scopes content IDs for a site, tenant, locale, or another application boundary. `contentId` names the prose itself. Do not use a component path, filename, DOM position, array index, or current text as identity.

If an intentional rename changes `contentId`, add the earlier ID to `legacyContentIds`. Aliases support a controlled migration. Cycles, collisions, conflicting values, and independent reset or authored histories fail closed.

The source fingerprint records the default text used with the descriptor. A resolver can report source drift when code changes that default while an override exists. The fingerprint is evidence for review, not an authentication check or security hash.

## Own authorization in the host

Reads can be public. Every replace, reset, and alias migration must return through a host mutation that reauthorizes the current caller. Never expose the component's write functions directly to a browser.

Use a dedicated capability in the host user table:

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

The capability name is intentionally narrow. Do not infer prose-author access from billing, organization, or unrelated product-admin roles.

The root API supplies `exposeApi`. It creates one anonymous read and three protected write functions around the installed component. The authorization callback runs again for every write. It must use `ctx.auth` and the host database. It returns an opaque actor ID from trusted server state. A write checks the requested ID, each declared legacy ID, and each stored target. It also checks each stored alias that resolves to those identities. All checks must return the same actor. See [Host integration](./docs/host-integration.md) for the complete wrapper.

The browser must not send an actor ID or claim `malleableTextAdmin`. A session token is only an input to the host's normal authentication system. Revoking the capability must affect the next write even when an older page remains open.

## Resolve text with a source fallback

Query the host's exposed `resolveBatch` function with content references. Combine each stored resolution with its source descriptor by calling `resolveClientContent`:

```ts
import {
  referenceFromDescriptor,
  resolveClientContent,
} from "@hraness/mallleable-text";

const result = await convex.query(
  api.mallleableText.resolveBatch,
  { requests: [referenceFromDescriptor(introduction)] },
);

const first = result.status === "resolved" ? result.items[0] : undefined;
if (first?.status === "conflict") {
  throw new Error(`Content identity conflict: ${first.code}`);
}
const parsed = resolveClientContent(introduction, first);
const resolved = parsed.status === "valid"
  ? parsed.value
  : {
      ...introduction,
      canonicalContentId: introduction.contentId,
      origin: "default" as const,
      revision: 0,
      sourceDrift: false,
      text: introduction.defaultText,
      viaLegacy: false,
    };
```

Here, `convex` is the application's Convex client and `api` is its generated host API. The [host guide](./docs/host-integration.md) shows a React query and the matching server wrappers.

In a server-rendered application, perform this resolution on the server when possible. If the query is unavailable or the result is invalid, render `defaultText`. Do not leave an empty region while the browser waits for persistence.

An alias conflict is different from an unavailable query. Surface the conflict for review instead of silently choosing a source or saved value.

Render the final value as text. Do not pass persisted prose to an HTML, Markdown, code, command, or template interpreter.

## Add the React author flow

Mark the resolved text and mount one controller for the relevant document or container:

```tsx
import {
  MalleableTextAccountControl,
  MalleableTextController,
  MalleableTextMarker,
  type MalleableTextAccess,
  type MalleableTextSaveAdapter,
} from "@hraness/mallleable-text/react";

export function Introduction(props: {
  access: MalleableTextAccess;
  resolved: typeof resolved;
  save: MalleableTextSaveAdapter;
}) {
  return (
    <>
      <MalleableTextAccountControl access={props.access} />
      <p>
        <MalleableTextMarker
          descriptor={introduction}
          revision={props.resolved.revision}
        >
          {props.resolved.text}
        </MalleableTextMarker>
      </p>
      <MalleableTextController
        access={props.access}
        save={props.save}
      />
    </>
  );
}
```

The application maps its session to one access state:

- `read-only` has no author account control or editor.
- `no-session` supplies the application's sign-in action.
- `authorized` identifies an author and can supply sign-out.

The package does not choose an identity provider. `MalleableTextAccountControl` calls the supplied sign-in or sign-out action, and the host still makes the final authorization decision during every mutation.

An authorized author selects non-empty text inside one marker. The controller places a large edit icon by the selection without moving focus. Activating it opens a keyboard-operable modal. The draft contains the selected passage, and the save adapter receives the descriptor, expected revision, replacement, request ID, and quoted range.

The application should connect `save` to its host `replaceText` mutation and reconcile a successful result through normal state or query updates. The controller does not imperatively replace React-owned prose.

## Conflict and retry rules

Range offsets count JavaScript UTF-16 code units. Each range also carries the exact selected text and bounded prefix and suffix context. The component checks the offsets and quote against the current text before it writes.

`expectedRevision` provides compare-and-swap behavior. A stale author receives a conflict instead of overwriting newer prose.

`requestId` makes a recent lost response safe to retry. Retry the exact unchanged request with the same ID. Generate a new ID after any change to the descriptor, range, replacement, expected revision, actor, or operation. Reusing an ID for different input is invalid.

The component keeps the 16 most recent saved request records for each canonical content ID. A retry after eviction returns to normal revision and range checks. Later writes have advanced the revision, so an old request cannot overwrite them.

## Scope and limitations

Malleable Text stores plain prose. It does not edit or persist:

- HTML, Markdown, rich-text structures, code, or commands.
- Buttons, tabs, field labels, placeholders, ARIA text, status messages, errors, or other operational interface copy.
- Dynamic values, identifiers, user-generated records, or computed data.
- Authentication credentials, private keys, secrets, or confidential content exposed through a public read.

The package keeps the current override and revision. It does not provide document version history, approval workflows, arbitrary rollback, localization workflow, or collaborative cursor state. A host that needs audit history should record it in a separate host-owned system after successful writes.

IDs and aliases are explicit. The package cannot infer that two strings or two component paths represent the same prose. Split and merge migrations require an application-owned content decision.

Aliases are permanent and add-only in version 0.1. Do not recycle an earlier ID for unrelated prose.

The selection editor targets React applications in modern browsers. The storage and model APIs can support other renderers, but those renderers need their own authoring controls.

## Runtime bounds

`MALLLEABLE_TEXT_LIMITS` exports the values that the parsers and component enforce:

| Value | Limit |
| --- | ---: |
| Content text | 65,536 UTF-16 code units |
| Read batch | 10 descriptors |
| Legacy aliases on one descriptor | 16 |
| Prefix or suffix quote context | 256 UTF-16 code units |
| Content ID or actor ID | 160 UTF-16 code units |
| Request ID | 160 UTF-16 code units |
| Content space | 64 UTF-16 code units |
| Retained saved requests per canonical content ID | 16 |

Input beyond a bound returns an `invalid` result. Check the exported constants instead of copying the numbers into application validation.

The read batch limit keeps a worst-case JSON response below 4 MB. This leaves margin under the 4.5 MB Vercel Functions payload limit used by Suite hosts.

## More guidance

- [Architecture](./docs/architecture.md)
- [Host integration](./docs/host-integration.md)
- [Content migrations](./docs/content-migrations.md)
- [Testing](./docs/testing.md)
- [Contributing](./CONTRIBUTING.md)
- [Security](./SECURITY.md)

## License

MIT

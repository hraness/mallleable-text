# Architecture

Malleable Text lets an application keep prose in source while allowing an authorized author to revise selected text in place. Source remains the fallback and the Convex Component stores only authored overrides and their identity metadata.

The package separates storage, policy, and presentation:

```text
source descriptor and source prose
              |
      anonymous resolution
              |
      server-rendered text
              |
 selection and React editor
              |
  host mutation reauthorizes
              |
 isolated Convex Component
```

## Boundaries

| Boundary | Responsibility |
| --- | --- |
| Application source | Defines the stable content ID, default text, content space, and explicit legacy IDs. |
| Convex Component | Resolves aliases, stores the current override, checks revisions and ranges, and makes exact retries idempotent. |
| Host Convex API | Authenticates the caller, reads the host user table, applies `malleableTextAdmin`, and supplies an opaque actor ID. |
| Server rendering | Resolves persisted prose when available and always has source prose to render as a fallback. |
| React adapter | Marks authorable text, reads a valid browser selection, opens the editor, and sends a bounded range edit through the host adapter. |

The component cannot read the host application's user table. This is intentional. It keeps persistence portable across account systems and makes the authorization decision visible at the host boundary.

## Content identity

The pair of `space` and `contentId` identifies one piece of prose. Choose an ID for the prose's meaning, such as `home.introduction` or `docs.install.summary`. Keep that ID when you move a component, rename a file, change the DOM structure, or switch rendering frameworks.

Do not derive an ID from a file path, component name, array index, DOM position, or current text. Those values change during ordinary development and would disconnect a saved override.

A content descriptor carries:

- `space`, which scopes a set of IDs for a site, tenant, locale, or other application boundary.
- `contentId`, which is the current canonical semantic ID.
- `defaultText`, which is the source fallback.
- `legacyContentIds`, which records intentional earlier IDs.
- `sourceFingerprint`, which is computed from the default text.

Moving code needs no migration when `space` and `contentId` stay the same. Renaming an ID requires an explicit legacy alias. Alias cycles, collisions, ambiguous values, and independent reset or authored histories return a conflict. The component does not guess which value should win.

## Source changes

The source fingerprint records which default text accompanied a saved override. It lets the resolver report source drift when the default later changes. The authored value stays intact, so an application can review the difference and decide whether to keep, reset, or replace it.

The fingerprint is deterministic evidence, not a security primitive. It does not authenticate a caller or protect a value against deliberate modification.

## Writes and conflicts

Every saved value has a revision. A write includes `expectedRevision`, and the component advances the revision only when the stored value still matches that expectation. Alias analysis uses the highest revision from all related identities. A reset or migration cannot reuse an earlier revision. Concurrent authors cannot silently overwrite each other. A stale write returns a conflict with the current revision when available.

An edit replaces one selected range rather than submitting an unqualified full-document value. The range uses JavaScript UTF-16 code-unit offsets and includes the exact selection plus bounded prefix and suffix context. The component checks all of that evidence against the current text before it applies the replacement. Emoji and combining marks therefore need the same JavaScript string offsets at selection and save time.

Each write also includes a `requestId`. If a response is lost, the caller can retry the exact request with the same ID. The component returns a recent saved result without applying it twice. A changed range, replacement, revision, descriptor, actor, or operation needs a new request ID. Reusing an ID for a different request fails closed.

The component retains the 16 most recent saved request records for each canonical content ID. This bounds idempotency storage. A retry after eviction runs through normal compare-and-swap and range checks. The intervening writes have advanced the revision, so the old request conflicts instead of overwriting newer prose.

The public write result is a closed union:

- `saved` means the mutation completed or an exact saved request was replayed.
- `conflict` means current content, aliases, source, or revision no longer matches the request.
- `invalid` means the request broke a bound or contract.
- `forbidden` means the host denied the write.
- `retryable` means authorization or component service was temporarily unavailable.

## Authentication and authorization

Reads may be anonymous. The host can add read authorization when the prose is private.

Writes are never anonymous. The host must inspect trusted server state during every replace, reset, and alias migration. It must authorize the requested identity and all effective targets as the same actor. This check includes all stored aliases that resolve to those identities. The host then passes an opaque actor ID to the component. The browser must not choose the actor ID or assert its own capability.

Use a dedicated capability such as `malleableTextAdmin`. Do not reuse a broad account, organization, billing, or product-admin flag unless it expresses the same authority by design.

## Rendering and authoring

Render resolved text as a plain text node. Never pass it to an HTML, Markdown, template, code, or command interpreter.

The source default should be present in the initial server response. A persistence outage can then fall back to useful prose, and a browser without JavaScript can still read the page. Persisted prose can replace the fallback during server rendering or normal application data resolution.

The React adapter marks a text node with its descriptor and revision. For an authorized author, a valid selection inside one marker reveals an anchored edit icon. The icon opens an accessible modal with the selected text. The controller preserves the draft on retryable errors and reports conflicts without mutating React-owned DOM. The application reconciles a saved result through its normal data flow.

## Stored state and history

The component stores the current source reference, current override, permanent aliases, revision, and a bounded recent request window. It is not a document version-control or editorial workflow system. It does not provide review queues, approval stages, rich diffs, arbitrary rollback, or a durable history of every revision.

Applications that need those features should record an audit event or version snapshot in a host-owned system after a successful write. Keep that system outside the component so the basic persistence contract remains portable.

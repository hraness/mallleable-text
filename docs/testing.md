# Testing

Test the integration at the model, component, host-policy, rendering, and browser boundaries. A passing component mutation does not prove that a host wrapper reauthorized the caller or that a selection editor remained accessible.

## Model tests

Cover bounded parsers and range behavior with examples and property tests:

- Valid and invalid spaces, content IDs, aliases, actor IDs, request IDs, revisions, fingerprints, and text lengths.
- UTF-16 ranges around emoji, surrogate pairs, combining marks, whitespace, and string boundaries.
- Exact, prefix, and suffix mismatches.
- Applying a valid range and parsing the resulting text.
- Descriptor and result parsing from `unknown`.

## Component tests

Use `convex-test` with the registration helper from `@hraness/mallleable-text/test`. Cover:

```sh
bun add --dev convex-test
```

`convex-test` is an optional peer. Install it before you import the `/test`
subpath. Runtime consumers that do not use the test helper do not need it.

- Anonymous reads of source defaults and authored overrides.
- Authorized replace, reset, and alias migration operations.
- Revision races where only one compare-and-swap write succeeds.
- An exact retry after a simulated lost response.
- Reuse of one request ID with changed input.
- Eviction after 16 newer saved requests and a stale retry that conflicts.
- Alias migration, collisions, cycles, and ambiguous legacy values.
- A canonical reset followed by a stale authored legacy value.
- A full read batch that shares a maximum-depth alias path and stays within the
  aggregate lookup budget.
- Source drift after a default-text change.
- Batch and text limits.

## Host authorization tests

Test the host wrappers with users from the host application's own schema:

- No session returns `forbidden` or the application's chosen signed-out response.
- A signed-in user without `malleableTextAdmin` cannot write.
- An authorized user can write and receives an opaque server-derived actor ID.
- Revoking the capability blocks the next write without waiting for the browser session to refresh.
- Replace, reset, and alias migration each perform a fresh authorization check.
- A stored alias cannot redirect an allowed request to a denied canonical ID.
- A protected stored alias cannot point to an otherwise allowed canonical ID.
- A client-supplied actor ID or capability is ignored or rejected.
- Temporary identity-service failure returns `retryable` and does not write.

If the host restricts reads, add the same positive and negative policy tests to its query wrapper.

## Rendering tests

Render source prose without a Convex result and confirm that the page remains useful. Render an authored result and confirm that it replaces only the matching semantic content ID. Confirm that persisted text becomes a text node and cannot execute HTML or script.

Change a component path and DOM structure while keeping the same ID. The authored value must still resolve. Change an ID with an explicit legacy alias and verify the same value. A rename without an alias should resolve as new content.

## React and browser tests

Cover the author flow with real selection behavior when the browser runner supports it:

- A signed-out or read-only user sees no edit trigger.
- One non-empty selection inside one marker reveals one anchored trigger.
- Cross-marker, form-control, editable, code, and whitespace-only selections are rejected.
- Forward and backward selections produce the correct UTF-16 range.
- The trigger does not steal focus before it is activated.
- The modal receives focus, traps Tab navigation, closes with Escape when safe, and restores focus.
- Saving is disabled for an unchanged draft and while a request is pending.
- A retryable failure preserves the draft and request identity.
- Changing the draft after a failure creates a new request ID.
- A conflict remains visible and does not mutate React-owned prose.
- Strict Mode, hydration, unmount, scroll, resize, and aborted requests leave no event listener or stale-update leak.

Use semantic assertions for text, roles, labels, focus, and result state. Add visual review for trigger placement, forced colors, zoom, narrow viewports, and reduced motion.

## Standalone gate

Run the public repository checks from a clean installation:

```sh
bun install --frozen-lockfile --ignore-scripts
bun run check
```

Run `bun run codegen` only from a configured Convex project. Code generation needs a deployment. Also test one small host application with a real Convex deployment before a release that changes the component schema, generated API, authentication wrapper, or React adapter.

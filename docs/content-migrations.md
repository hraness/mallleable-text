# Content migrations

Treat content identity as application data. Plan changes to `space`, `contentId`, and aliases with the same care as a schema migration.

## Move code without changing identity

Keep the same `space` and `contentId` when you move a component, rename a source file, reorganize a route, or change the DOM structure. Update `defaultText` only when the source prose itself changes.

No persistence migration is necessary. The saved override follows the semantic ID.

## Rename a content ID

Choose the new canonical ID and list the old ID in `legacyContentIds`:

```ts
const introduction = {
  space: "website.en",
  contentId: "home.introduction",
  defaultText: "Build a durable interface for your content.",
  legacyContentIds: ["landing.hero.description"],
  sourceFingerprint: sourceFingerprint(
    "Build a durable interface for your content.",
  ),
} as const;
```

Deploy the descriptor before you remove all references to the old ID. Resolve the new descriptor and verify that it reports the canonical ID and `viaLegacy` state you expect. Run the authorized alias migration if your host exposes migration as a separate operation.

Keep the legacy ID in the descriptor so the migration remains visible in source. Stored aliases are permanent and add-only in version 0.1. Older application versions and cached pages continue to converge on the canonical value.

Do not recycle a legacy ID for unrelated prose. Choose a new semantic ID instead.

The migration must stop when:

- The proposed alias already belongs to another canonical value.
- Two legacy IDs contain different authored values.
- A reset canonical ID and an authored legacy ID have independent histories.
- The aliases would form a cycle.
- The expected revision changed during the migration.

Do not resolve one of these states by picking the newest, longest, or first value. Review the values and make an explicit product decision.

## Change source prose

Change `defaultText` and recompute its source fingerprint. A value without an authored override will resolve to the new source text. A saved override remains visible and reports source drift.

Review drift before a broad rewrite. You can keep the authored value, edit it against the current revision, or reset it to the new source default. A reset is an authorized write and must use `expectedRevision` and a new `requestId`.

## Split one text segment

Give each new segment its own semantic ID. Do not assign one old ID to two new segments. The package cannot infer how to divide an authored value.

If the old text has an override, read it first and decide how each part maps to the new segments. Apply explicit writes to the new IDs, verify them, and then retire the old ID. Record this product-specific transformation outside the component when it must be repeatable.

## Merge text segments

Choose one new canonical ID. Resolve each earlier segment and decide how to join their values. Write the joined value to the new ID, then retain the earlier IDs only as migration evidence or aliases when each alias has one unambiguous target.

Do not rely on alias resolution to concatenate text. An alias points to one canonical value.

## Change a content space

A space is part of identity. Moving from `website.en` to `docs.en` creates a new identity even when `contentId` stays the same. Read and copy the value through an authorized, application-owned migration. Verify the destination before retiring the source.

Use separate spaces for locales or tenants when their prose can diverge. Do not change a space merely because code moved between packages or routes.

## Release sequence

For a migration that changes identity:

1. Inventory the current canonical ID, aliases, source fingerprint, revision, and authored value.
2. Add the new descriptor or destination without deleting the old source.
3. Run an authorized migration with the current expected revision.
4. Resolve both old and new references and verify one canonical value.
5. Deploy readers that use the new identity while retaining the permanent legacy alias.
6. Remove obsolete code references only after older callers have expired.

Retry only an unchanged request with the same request ID. Generate a new request ID after any migration input changes.

---
title: Repository seams
type: concept
tags:
  - architecture
  - dependencies
  - repositories
repository_scopes:
  - AGENTS.md
  - package.json
---

# Repository seams

Mallleable Text is an independent public package. It owns stable content identity, bounded edits, the isolated Convex component, host adapters, and accessible plain-text controls. A consuming product owns authentication, authorization policy, application schema, and product-specific composition.

The package currently has no Hraness package dependency. Preserve that product-neutral boundary unless at least two concrete consumers need the same stable extracted interface. If a Hraness dependency becomes justified, pin it to an immutable release or full commit and do not use sibling paths, Git submodules, or coordinated `main` workflows.

Reusable editor behavior belongs here. Product layout, copy, navigation, and visual composition stay with the consuming product. Freeze exported contracts before parallel lanes begin and give public barrels, manifests, generated component files, and lockfiles one convergence owner.

## Related

The normative rules remain in the root `AGENTS.md`. [[documentation-ownership|Documentation ownership]] explains how those rules relate to executable contracts and this pull-based context.


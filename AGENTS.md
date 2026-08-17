<!-- kb:context scopes/repository--cdb4ee2aea69 -->
# Contents

- `src/model.ts` contains bounded public values, stable content descriptors, range edits, revision results, and foreign-input parsers.
- `src/component/` contains the isolated Convex Component schema, persistence functions, generated component types, and component tests.
- `src/client/` contains host-side wrappers that keep authentication and user policy in the consuming application.
- `src/react/` contains plain-text markers, selection controls, the accessible editor, account controls, and browser tests.
- `src/test.ts` exports registration helpers for component tests.
- `docs/` explains architecture, host integration, content migration, verification, and limits.
- `.agents/skills/` contains reusable cross-repository KB and phased-execution workflows.
- `kb/` contains authored repository rationale, evidence, synthesis, and plans.
- `WRITING.md` and `STYLE.md` define internal and public prose contracts.
- `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, and `LICENSE` define the public project contract.
- `.github/workflows/` validates branches and publishes checks-gated immutable releases.

# Guidelines

- Use Bun for repository commands. Keep each published ESM export within its documented Convex, server, React, or browser boundary.
- Follow `WRITING.md` for internal prose and `STYLE.md` for public prose.
- Apply unreasonably robust programming when agent work is cheap. Model invalid states out of existence and pair readable regression examples with property tests for general laws.
- Deliver changes to `main` through a current-head pull request. Keep the stable `Required` CI job green, resolve every review thread, and serialize merges. Human approval stays optional while one regular maintainer would otherwise self-review. Never force-push or bypass the gate.
- Pin Hraness dependencies to reviewed immutable releases or full commits. Never connect repositories with sibling paths, Git submodules, or coordinated `main` assumptions.
- Extract a shared package only after two concrete consumers need the same stable interface. Keep shared packages product-neutral; consuming applications own authentication, product schema, and product composition.
- For UI work, take stable primitives and tokens from a shared design kit only at an immutable version. Keep product layout, copy, navigation, and visual contracts in the consuming product.
- Freeze shared interfaces before parallel lanes begin. Give exported contracts, manifests, generated component files, lockfiles, and other convergence surfaces one owner while lanes edit disjoint paths.
- Keep mandatory rules in the closest `AGENTS.md`, current procedures in `docs/`, executable contracts in types and tests, and pull-based rationale, evidence, synthesis, and plans in `kb/`.
- Keep the package independent of any product, account system, private package, or application-specific schema.
- Use stable semantic content IDs. Component paths, source filenames, DOM positions, and current text are not identity. Register intentional ID changes with explicit aliases, and reject cycles, collisions, and ambiguous values.
- Use source fingerprints only as drift evidence. Compare the expected revision during every write. Replay a request ID only when the full saved request matches.
- Store and render plain prose. Do not interpret saved text as HTML, Markdown, code, interface state, or dynamic data.
- Let the host choose its read policy. Make it authenticate every write and derive the actor ID from trusted server state. Never trust a client-provided actor ID or author capability.
- Preserve source prose during server rendering and outages. Keep the React controls keyboard-operable, focus-safe, forced-color legible, and usable with reduced motion.
- Parse foreign input from `unknown` and enforce every bound. Test concrete behavior and add property tests for general laws.
- Treat this repository as the complete project. Use only its public names, paths, commands, dependencies, and examples.
- Run `bun run check` before handing off a change.

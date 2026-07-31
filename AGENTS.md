# Contents

- `src/model.ts` contains bounded public values, stable content descriptors, range edits, revision results, and foreign-input parsers.
- `src/component/` contains the isolated Convex Component schema, persistence functions, generated component types, and component tests.
- `src/client/` contains host-side wrappers that keep authentication and user policy in the consuming application.
- `src/react/` contains plain-text markers, selection controls, the accessible editor, account controls, and browser tests.
- `src/test.ts` exports registration helpers for component tests.
- `docs/` explains architecture, host integration, content migration, verification, and limits.
- `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, and `LICENSE` define the public project contract.
- `.github/workflows/` validates branches and publishes checks-gated immutable releases.

# Guidelines

- Use Bun for repository commands. Keep each published ESM export within its documented Convex, server, React, or browser boundary.
- Keep the package independent of any product, account system, private package, or application-specific schema.
- Use stable semantic content IDs. Component paths, source filenames, DOM positions, and current text are not identity. Register intentional ID changes with explicit aliases, and reject cycles, collisions, and ambiguous values.
- Use source fingerprints only as drift evidence. Compare the expected revision during every write. Replay a request ID only when the full saved request matches.
- Store and render plain prose. Do not interpret saved text as HTML, Markdown, code, interface state, or dynamic data.
- Let the host choose its read policy. Make it authenticate every write and derive the actor ID from trusted server state. Never trust a client-provided actor ID or author capability.
- Preserve source prose during server rendering and outages. Keep the React controls keyboard-operable, focus-safe, forced-color legible, and usable with reduced motion.
- Parse foreign input from `unknown` and enforce every bound. Test concrete behavior and add property tests for general laws.
- Treat this repository as the complete project. Use only its public names, paths, commands, dependencies, and examples.
- Run `bun run check` before handing off a change.

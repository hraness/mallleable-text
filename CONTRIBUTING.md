# Contributing

Issues and focused pull requests are welcome in the public repository.

Open an issue before you change the storage model, public result unions, content identity rules, or component API. These changes can affect saved prose in every consuming application. Describe the compatibility and migration plan with the proposal.

Run the standalone checks before you open a pull request:

```sh
bun install --frozen-lockfile --ignore-scripts
bun run check
```

Run `bun run codegen` after a component schema change only when you have configured a Convex deployment.

Keep the framework-neutral model separate from Convex, React, and browser code. A host application must own authentication and user policy. Do not add an authentication provider or an application-specific user schema to this package.

Add a readable test for each concrete behavior change. Add a property test for parsers, ranges, alias resolution, revision transitions, request replay, or another rule over arbitrary input. Changes to the React editor need keyboard, focus, selection, hydration, and cleanup coverage when those behaviors are affected.

Public prose examples must remain plain text. Do not demonstrate persisted HTML, Markdown, code, operational interface labels, or dynamic user data.

Read [the architecture guide](./docs/architecture.md) before changing a boundary. Read [the migration guide](./docs/content-migrations.md) before changing content identity or alias behavior.

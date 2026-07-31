import type { TestConvex } from "convex-test";
import type { GenericSchema, SchemaDefinition } from "convex/server";

import schema from "./component/schema.js";

export const modules = {
  "./component/_generated/api.ts": async () =>
    await import("./component/_generated/api.js"),
  "./component/_generated/server.ts": async () =>
    await import("./component/_generated/server.js"),
  "./component/persistence.ts": async () =>
    await import("./component/persistence.js"),
};

export function register(
  test: TestConvex<SchemaDefinition<GenericSchema, boolean>>,
  name = "mallleableText",
): void {
  test.registerComponent(name, schema, modules);
}

export default { modules, register, schema };

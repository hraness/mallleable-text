/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    persistence: {
      authorizationTargets: FunctionReference<
        "query",
        "internal",
        { reference: any },
        any,
        Name
      >;
      migrateAliases: FunctionReference<
        "mutation",
        "internal",
        { request: any },
        any,
        Name
      >;
      replaceText: FunctionReference<
        "mutation",
        "internal",
        { request: any },
        any,
        Name
      >;
      resetText: FunctionReference<
        "mutation",
        "internal",
        { request: any },
        any,
        Name
      >;
      resolveBatch: FunctionReference<
        "query",
        "internal",
        { requests: any },
        any,
        Name
      >;
    };
  };

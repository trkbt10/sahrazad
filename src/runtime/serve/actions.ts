/**
 * @file Generic action types for schema-driven servers (runtime/serve).
 *
 * App-specific registries should be defined in application code (e.g., src/index.ts),
 * where argument parsing/validation is also applied. This module stays framework-agnostic.
 */

export type ActionName = string;

export type ActionArgs = Record<string, unknown>;
export type ActionResult = Record<string, unknown>;

export type ActionHandler<A extends ActionArgs = ActionArgs, R extends ActionResult = ActionResult> = (args: A) => Promise<R>;

export type ActionRegistry = Record<ActionName, ActionHandler>;

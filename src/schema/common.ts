/**
 * Shared, framework-agnostic schema primitives used across the registry.
 *
 * Nothing in this file may reference a specific design tool (Figma, Sketch, ...)
 * or a specific code framework (React, Vue, ...). Those live in their own
 * modules and are composed on top of these primitives.
 */
import { z } from "zod";

/** A stable, human-assignable identifier. Lowercase kebab-case by convention, not enforced. */
export const RegistryId = z
  .string()
  .min(1, "id must not be empty")
  .max(200, "id must be 200 characters or fewer")
  .regex(
    /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/,
    "id may only contain letters, numbers, '.', '_' and '-', and must start with a letter or number",
  );
export type RegistryId = z.infer<typeof RegistryId>;

/** Lifecycle status shared by components, tokens, and patterns. */
export const LifecycleStatus = z.enum([
  "proposed",
  "approved",
  "deprecated",
  "experimental",
]);
export type LifecycleStatus = z.infer<typeof LifecycleStatus>;

/**
 * Reference to *any* design tool's node/component. Deliberately generic:
 * the `tool` field is an open string (not an enum) so new tools never
 * require a schema migration. Figma-specific fields are optional and only
 * meaningful when `tool === "figma"`, but nothing in the schema requires
 * that coupling.
 */
export const DesignReference = z.object({
  /** e.g. "figma", "sketch", "penpot", "adobe-xd", or any other identifier. */
  tool: z.string().min(1),
  /** Design-tool-specific file/document identifier (Figma fileKey, Sketch document id, etc). */
  fileId: z.string().min(1).optional(),
  /** Design-tool-specific node/component identifier. */
  nodeId: z.string().min(1).optional(),
  /** Deep link to the design node, if the tool supports one. */
  url: z.string().url().optional(),
  /** The component/node's name as it appears in the design tool. */
  name: z.string().min(1).optional(),
  /** Free-form variant/property info as understood by the design tool (e.g. Figma variant properties). */
  variantProperties: z.record(z.string()).optional(),
  /** Anything tool-specific that doesn't fit the fields above. */
  metadata: z.record(z.unknown()).optional(),
});
export type DesignReference = z.infer<typeof DesignReference>;

export const Timestamps = z.object({
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});
export type Timestamps = z.infer<typeof Timestamps>;

/** Generic example: a short scenario plus optional code and/or design context. */
export const Example = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  code: z.string().optional(),
  language: z.string().optional(),
});
export type Example = z.infer<typeof Example>;

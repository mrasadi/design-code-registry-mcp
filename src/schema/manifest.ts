import { z } from "zod";

/** Current schema version this server writes and understands natively. */
export const CURRENT_SCHEMA_VERSION = "1.0";

export const Manifest = z.object({
  /** Version of the registry *schema* (component/token/pattern/rules shapes). Bump on breaking changes. */
  schemaVersion: z.string().min(1).default(CURRENT_SCHEMA_VERSION),
  /** Version of this specific registry's *content*, owned by the project (semver recommended, not enforced). */
  registryVersion: z.string().min(1).default("0.1.0"),
  project: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
  }),
  /**
   * The primary design tool(s) this registry is aware of. This is informational
   * only — it does not restrict which `design.tool` values components may use.
   */
  design: z
    .object({
      tool: z.string().min(1).optional(),
      additionalTools: z.array(z.string().min(1)).optional(),
    })
    .optional(),
  /** Arbitrary project-level metadata that doesn't fit elsewhere. */
  metadata: z.record(z.unknown()).optional(),
});
export type Manifest = z.infer<typeof Manifest>;

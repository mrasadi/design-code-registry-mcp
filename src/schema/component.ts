import { z } from "zod";
import { DesignReference, Example, LifecycleStatus, RegistryId, Timestamps } from "./common.js";

/**
 * A single code implementation of a design component. A component may have
 * zero, one, or many implementations (e.g. React + Vue + SwiftUI for the
 * same design concept).
 */
export const Implementation = z.object({
  /** e.g. "typescript", "javascript", "swift", "dart", "kotlin", "html". Open string, not an enum. */
  language: z.string().min(1),
  /** e.g. "react", "vue", "svelte", "angular", "swiftui", "flutter". Optional — some languages have no framework. */
  framework: z.string().optional(),
  /** The exported symbol/component name in code. */
  component: z.string().min(1),
  /** Path to the implementation file, relative to the *consuming project's* root. */
  sourcePath: z.string().optional(),
  /** How code should import this implementation (module specifier / alias path). */
  importPath: z.string().optional(),
  /** Named vs default export, if relevant. */
  exportName: z.string().optional(),
  /** Free-form notes about this specific implementation. */
  notes: z.string().optional(),
});
export type Implementation = z.infer<typeof Implementation>;

export const PropertyDefinition = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  required: z.boolean().default(false),
  defaultValue: z.unknown().optional(),
  description: z.string().optional(),
  allowedValues: z.array(z.string()).optional(),
});
export type PropertyDefinition = z.infer<typeof PropertyDefinition>;

export const AccessibilityInfo = z.object({
  role: z.string().optional(),
  ariaAttributes: z.array(z.string()).optional(),
  keyboardInteractions: z.array(z.string()).optional(),
  notes: z.string().optional(),
});
export type AccessibilityInfo = z.infer<typeof AccessibilityInfo>;

export const ComponentRules = z.object({
  /** If true, agents should reuse this component instead of proposing a new one for equivalent needs. */
  reuse: z.boolean().default(true),
  /** If true, agents must not create a second canonical component covering the same design concept. */
  allowDuplicate: z.boolean().default(false),
  /** Free-form additional constraints an agent should respect. */
  constraints: z.array(z.string()).optional(),
});
export type ComponentRules = z.infer<typeof ComponentRules>;

export const Component = z
  .object({
    id: RegistryId,
    name: z.string().min(1),
    /** Alternate names an agent or human might use to refer to this component. */
    aliases: z.array(z.string().min(1)).default([]),
    description: z.string().optional(),

    /** Zero or more design tool references (a component may exist before any design mapping does). */
    design: z.array(DesignReference).default([]),

    /** Zero or more code implementations across languages/frameworks. */
    implementations: z.array(Implementation).default([]),

    /** Named variant axes and their possible values, e.g. { appearance: ["primary","secondary"] }. */
    variants: z.record(z.array(z.string())).default({}),

    /** Typed properties/props this component accepts. */
    properties: z.array(PropertyDefinition).default([]),

    /** Interaction/visual states this component supports, e.g. ["default","hover","focus","disabled"]. */
    states: z.array(z.string()).default([]),

    accessibility: AccessibilityInfo.optional(),

    rules: ComponentRules.default({ reuse: true, allowDuplicate: false }),

    examples: z.array(Example).default([]),

    status: LifecycleStatus.default("approved"),

    /** Free-form tags for search/filtering. */
    tags: z.array(z.string()).default([]),

    /** Present only when status === "deprecated". */
    deprecation: z
      .object({
        reason: z.string().optional(),
        replacedBy: RegistryId.optional(),
        deprecatedAt: z.string().datetime().optional(),
      })
      .optional(),
  })
  .merge(Timestamps);
export type Component = z.infer<typeof Component>;

/** Shape accepted by `registry_create_component` — id is required, everything else optional with schema defaults. */
export const ComponentInput = Component.partial().extend({
  id: RegistryId,
  name: z.string().min(1),
});
export type ComponentInput = z.infer<typeof ComponentInput>;

/** Shape accepted by `registry_update_component` — only id is required; all other fields are partial patches. */
export const ComponentPatch = Component.partial().extend({
  id: RegistryId,
});
export type ComponentPatch = z.infer<typeof ComponentPatch>;

import { z } from "zod";
import { DesignReference, LifecycleStatus, RegistryId, Timestamps } from "./common.js";

export const Pattern = z
  .object({
    id: RegistryId,
    name: z.string().min(1),
    description: z.string().optional(),

    design: z.array(DesignReference).default([]),

    /** IDs of components used by this pattern. Validated against the component registry during `registry_validate`. */
    components: z.array(RegistryId).default([]),

    /** IDs of other patterns this pattern composes (e.g. a "form section" pattern built from "field group" patterns). Checked for cycles during `registry_validate`. */
    relatedPatterns: z.array(RegistryId).default([]),

    compositionRules: z.array(z.string()).default([]),
    layoutRules: z.array(z.string()).default([]),
    responsiveBehavior: z.string().optional(),
    usageConstraints: z.array(z.string()).default([]),

    status: LifecycleStatus.default("approved"),
    tags: z.array(z.string()).default([]),
  })
  .merge(Timestamps);
export type Pattern = z.infer<typeof Pattern>;

export const PatternInput = Pattern.partial().extend({
  id: RegistryId,
  name: z.string().min(1),
});
export type PatternInput = z.infer<typeof PatternInput>;

export const PatternPatch = Pattern.partial().extend({
  id: RegistryId,
});
export type PatternPatch = z.infer<typeof PatternPatch>;

import { z } from "zod";
import { RegistryId } from "./common.js";

/**
 * A single structured design decision. Kept structured (not just free prose)
 * so agents can filter/reason over rules programmatically, per requirement
 * that rules must not be an arbitrary prompt file.
 */
export const Rule = z.object({
  id: RegistryId,
  /** Short imperative statement, e.g. "Prefer existing Button component". */
  statement: z.string().min(1),
  /** What this rule applies to: a component, token, pattern, or general project-wide guidance. */
  appliesTo: z
    .object({
      type: z.enum(["component", "token", "pattern", "general"]),
      id: RegistryId.optional(),
    })
    .default({ type: "general" }),
  /** How strictly agents must follow this rule. */
  severity: z.enum(["must", "should", "may"]).default("should"),
  rationale: z.string().optional(),
  tags: z.array(z.string()).default([]),
});
export type Rule = z.infer<typeof Rule>;

export const RulesDocument = z.object({
  rules: z.array(Rule).default([]),
});
export type RulesDocument = z.infer<typeof RulesDocument>;

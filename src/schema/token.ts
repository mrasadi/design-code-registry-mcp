import { z } from "zod";
import { RegistryId, Timestamps } from "./common.js";

export const TokenCategory = z.enum([
  "color",
  "typography",
  "spacing",
  "radius",
  "shadow",
  "breakpoint",
  "motion",
  "z-index",
  "border",
  "opacity",
  "size",
  "custom",
]);
export type TokenCategory = z.infer<typeof TokenCategory>;

export const Token = z
  .object({
    id: RegistryId,
    name: z.string().min(1),
    category: TokenCategory,
    /** The token's value. Kept as unknown-ish string/number/object since categories vary widely (typography tokens are composite, colors are strings, etc). */
    value: z.union([z.string(), z.number(), z.record(z.unknown())]),
    /** e.g. "px", "rem", "ms", "hex", "rgba" — informational, not enforced. */
    type: z.string().optional(),
    /** Where this token originates, e.g. "figma", "design-tokens-w3c", "manual". */
    source: z.string().optional(),
    description: z.string().optional(),
    /** Guidance on when/how to use this token. */
    usage: z.string().optional(),
    aliases: z.array(z.string().min(1)).default([]),
    deprecated: z.boolean().default(false),
    deprecation: z
      .object({
        reason: z.string().optional(),
        replacedBy: RegistryId.optional(),
      })
      .optional(),
  })
  .merge(Timestamps);
export type Token = z.infer<typeof Token>;

export const TokenInput = Token.partial().extend({
  id: RegistryId,
  name: z.string().min(1),
  category: TokenCategory,
  value: Token.shape.value,
});
export type TokenInput = z.infer<typeof TokenInput>;

export const TokenPatch = Token.partial().extend({
  id: RegistryId,
});
export type TokenPatch = z.infer<typeof TokenPatch>;

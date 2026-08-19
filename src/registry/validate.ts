import type { RegistryData } from "./provider.js";

export interface ValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  /** e.g. "component:button", "pattern:empty-state" */
  location?: string;
}

export interface ValidationReport {
  valid: boolean;
  errorCount: number;
  warningCount: number;
  issues: ValidationIssue[];
}

function designRefKey(ref: { tool: string; fileId?: string; nodeId?: string; url?: string }): string | null {
  // Only meaningful as a "duplicate" if it identifies a specific node.
  if (ref.nodeId) return `${ref.tool}::${ref.fileId ?? ""}::${ref.nodeId}`;
  if (ref.url) return `${ref.tool}::url::${ref.url}`;
  return null;
}

/**
 * Validate a full registry snapshot. This assumes the individual files
 * already parsed successfully against their zod schemas (i.e. "invalid
 * schema" errors surface earlier, at load time, with precise zod paths) —
 * this pass focuses on *cross-file, semantic* integrity that no single
 * schema can express: duplicate ids, duplicate design references, broken
 * references between components/patterns/tokens/rules, and cycles.
 */
export function validateRegistry(data: RegistryData): ValidationReport {
  const issues: ValidationIssue[] = [];
  const err = (code: string, message: string, location?: string) =>
    issues.push({ severity: "error", code, message, location });
  const warn = (code: string, message: string, location?: string) =>
    issues.push({ severity: "warning", code, message, location });

  // --- Duplicate IDs within each collection ---
  const componentIds = new Set<string>();
  for (const c of data.components) {
    if (componentIds.has(c.id)) {
      err("DUPLICATE_COMPONENT_ID", `Duplicate component id "${c.id}".`, `component:${c.id}`);
    }
    componentIds.add(c.id);
  }

  const tokenIds = new Set<string>();
  for (const t of data.tokens) {
    if (tokenIds.has(t.id)) {
      err("DUPLICATE_TOKEN_ID", `Duplicate token id "${t.id}".`, `token:${t.id}`);
    }
    tokenIds.add(t.id);
  }

  const patternIds = new Set<string>();
  for (const p of data.patterns) {
    if (patternIds.has(p.id)) {
      err("DUPLICATE_PATTERN_ID", `Duplicate pattern id "${p.id}".`, `pattern:${p.id}`);
    }
    patternIds.add(p.id);
  }

  const ruleIds = new Set<string>();
  for (const r of data.rules.rules) {
    if (ruleIds.has(r.id)) {
      err("DUPLICATE_RULE_ID", `Duplicate rule id "${r.id}".`, `rule:${r.id}`);
    }
    ruleIds.add(r.id);
  }

  // --- Duplicate design references across components ---
  const designRefOwners = new Map<string, string[]>();
  for (const c of data.components) {
    for (const ref of c.design) {
      const key = designRefKey(ref);
      if (!key) continue;
      const owners = designRefOwners.get(key) ?? [];
      owners.push(c.id);
      designRefOwners.set(key, owners);
    }
  }
  for (const [key, owners] of designRefOwners) {
    if (owners.length > 1) {
      err(
        "DUPLICATE_DESIGN_REFERENCE",
        `Design reference "${key}" is claimed by multiple components: ${owners.join(", ")}.`,
      );
    }
  }

  // --- Duplicate aliases across components (an alias resolving to >1 component is inherently ambiguous) ---
  const aliasOwners = new Map<string, string[]>();
  for (const c of data.components) {
    for (const alias of c.aliases) {
      const owners = aliasOwners.get(alias) ?? [];
      owners.push(c.id);
      aliasOwners.set(alias, owners);
    }
  }
  for (const [alias, owners] of aliasOwners) {
    if (owners.length > 1) {
      warn(
        "AMBIGUOUS_ALIAS",
        `Alias "${alias}" is used by multiple components (${owners.join(", ")}); resolution by alias will be ambiguous.`,
      );
    }
  }

  // --- Component-level checks ---
  for (const c of data.components) {
    if (c.status === "deprecated") {
      const replacedBy = c.deprecation?.replacedBy;
      if (replacedBy && !componentIds.has(replacedBy)) {
        err(
          "BROKEN_REFERENCE",
          `Component "${c.id}" is deprecated in favor of "${replacedBy}", which does not exist.`,
          `component:${c.id}`,
        );
      }
    }
    if (c.implementations.length === 0 && c.status === "approved") {
      warn(
        "APPROVED_WITHOUT_IMPLEMENTATION",
        `Component "${c.id}" is approved but has no code implementations.`,
        `component:${c.id}`,
      );
    }
    // Duplicate (language, framework) pairs within the same component.
    const seenImpls = new Set<string>();
    for (const impl of c.implementations) {
      const implKey = `${impl.language}::${impl.framework ?? ""}`;
      if (seenImpls.has(implKey)) {
        err(
          "DUPLICATE_IMPLEMENTATION",
          `Component "${c.id}" has more than one implementation for ${implKey.replace("::", " / ")}.`,
          `component:${c.id}`,
        );
      }
      seenImpls.add(implKey);
    }
  }

  // --- Token-level checks ---
  for (const t of data.tokens) {
    const replacedBy = t.deprecation?.replacedBy;
    if (replacedBy && !tokenIds.has(replacedBy)) {
      err("BROKEN_REFERENCE", `Token "${t.id}" is deprecated in favor of "${replacedBy}", which does not exist.`, `token:${t.id}`);
    }
  }

  // --- Pattern-level checks: broken component references ---
  for (const p of data.patterns) {
    for (const compId of p.components) {
      if (!componentIds.has(compId)) {
        err(
          "BROKEN_REFERENCE",
          `Pattern "${p.id}" references component "${compId}", which does not exist.`,
          `pattern:${p.id}`,
        );
      }
    }
    for (const relatedId of p.relatedPatterns) {
      if (!patternIds.has(relatedId)) {
        err(
          "BROKEN_REFERENCE",
          `Pattern "${p.id}" references related pattern "${relatedId}", which does not exist.`,
          `pattern:${p.id}`,
        );
      }
    }
  }

  // --- Circular pattern references (relatedPatterns forms a graph; detect cycles) ---
  const patternById = new Map(data.patterns.map((p) => [p.id, p] as const));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cyclesReported = new Set<string>();

  function visit(id: string, stack: string[]): void {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      const cycleStart = stack.indexOf(id);
      const cycle = [...stack.slice(cycleStart), id];
      const key = [...cycle].sort().join(">");
      if (!cyclesReported.has(key)) {
        cyclesReported.add(key);
        err("CIRCULAR_PATTERN_REFERENCE", `Circular pattern reference detected: ${cycle.join(" -> ")}.`);
      }
      return;
    }
    const pattern = patternById.get(id);
    if (!pattern) return; // already reported as broken reference above
    visiting.add(id);
    for (const relatedId of pattern.relatedPatterns) {
      visit(relatedId, [...stack, id]);
    }
    visiting.delete(id);
    visited.add(id);
  }
  for (const p of data.patterns) {
    visit(p.id, []);
  }

  // --- Rules-level checks: appliesTo.id must point at a real entity ---
  for (const r of data.rules.rules) {
    if (r.appliesTo.type === "component" && r.appliesTo.id && !componentIds.has(r.appliesTo.id)) {
      err("BROKEN_REFERENCE", `Rule "${r.id}" applies to component "${r.appliesTo.id}", which does not exist.`, `rule:${r.id}`);
    }
    if (r.appliesTo.type === "token" && r.appliesTo.id && !tokenIds.has(r.appliesTo.id)) {
      err("BROKEN_REFERENCE", `Rule "${r.id}" applies to token "${r.appliesTo.id}", which does not exist.`, `rule:${r.id}`);
    }
    if (r.appliesTo.type === "pattern" && r.appliesTo.id && !patternIds.has(r.appliesTo.id)) {
      err("BROKEN_REFERENCE", `Rule "${r.id}" applies to pattern "${r.appliesTo.id}", which does not exist.`, `rule:${r.id}`);
    }
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  return { valid: errorCount === 0, errorCount, warningCount, issues };
}

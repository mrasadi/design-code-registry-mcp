import type { Component } from "../schema/component.js";

/**
 * Deterministic resolution only. No LLM inference, no embeddings, no vector
 * similarity — a match is either exact by one of the strategies below, or it
 * is reported as ambiguous / unresolved. Agents must never be left guessing.
 */
export interface ResolveQuery {
  /** Exact registry id to match against `component.id`. */
  registryId?: string;
  /** Design tool reference to match against `component.design[]`. */
  design?: {
    tool?: string;
    fileId?: string;
    nodeId?: string;
    url?: string;
    name?: string;
  };
  /** Exact canonical name to match against `component.name`. */
  name?: string;
  /** Alias text to match against `component.aliases[]`. */
  alias?: string;
}

export type ResolveStrategy = "design-reference" | "registry-id" | "canonical-name" | "alias";

export type ResolveResult =
  | { status: "resolved"; strategy: ResolveStrategy; component: Component }
  | { status: "ambiguous"; strategy: ResolveStrategy; candidates: Component[] }
  | { status: "unresolved" };

function matchesDesignReference(component: Component, q: NonNullable<ResolveQuery["design"]>): boolean {
  return component.design.some((ref) => {
    if (q.tool && ref.tool !== q.tool) return false;
    // Prefer the most specific identifiers available. At least one identifying
    // field beyond `tool` must match for this to count as a design-reference hit.
    let matchedSomething = false;
    if (q.nodeId !== undefined) {
      if (ref.nodeId !== q.nodeId) return false;
      matchedSomething = true;
    }
    if (q.fileId !== undefined) {
      if (ref.fileId !== q.fileId) return false;
      matchedSomething = true;
    }
    if (q.url !== undefined) {
      if (ref.url !== q.url) return false;
      matchedSomething = true;
    }
    if (q.name !== undefined) {
      if (ref.name !== q.name) return false;
      matchedSomething = true;
    }
    return matchedSomething;
  });
}

/**
 * Resolve a design/code component against the registry using the fixed
 * precedence order:
 *   1. Exact design reference match (tool + node/file/url/name)
 *   2. Exact registry id match
 *   3. Exact canonical name match
 *   4. Explicit alias match
 *   5. Otherwise: unresolved
 *
 * If a given strategy yields more than one candidate, resolution stops at
 * that strategy and reports "ambiguous" rather than falling through to a
 * weaker strategy or guessing.
 */
export function resolveComponent(components: Component[], query: ResolveQuery): ResolveResult {
  const strategies: Array<{ name: ResolveStrategy; run: () => Component[] }> = [
    {
      name: "design-reference",
      run: () => (query.design ? components.filter((c) => matchesDesignReference(c, query.design!)) : []),
    },
    {
      name: "registry-id",
      run: () => (query.registryId ? components.filter((c) => c.id === query.registryId) : []),
    },
    {
      name: "canonical-name",
      run: () => (query.name ? components.filter((c) => c.name === query.name) : []),
    },
    {
      name: "alias",
      run: () => (query.alias ? components.filter((c) => c.aliases.includes(query.alias!)) : []),
    },
  ];

  for (const strategy of strategies) {
    const candidates = strategy.run();
    if (candidates.length === 1) {
      return { status: "resolved", strategy: strategy.name, component: candidates[0]! };
    }
    if (candidates.length > 1) {
      return { status: "ambiguous", strategy: strategy.name, candidates };
    }
  }

  return { status: "unresolved" };
}

import type { Component, ComponentInput, ComponentPatch } from "../schema/component.js";
import type { Pattern, PatternInput, PatternPatch } from "../schema/pattern.js";
import type { Rule, RulesDocument } from "../schema/rules.js";
import type { Token, TokenInput, TokenPatch } from "../schema/token.js";
import { Component as ComponentSchema } from "../schema/component.js";
import { Pattern as PatternSchema } from "../schema/pattern.js";
import { Token as TokenSchema } from "../schema/token.js";
import { DuplicateIdError, NotFoundError } from "../utils/errors.js";
import { FileRegistryProvider } from "./provider.js";
import { resolveComponent, type ResolveQuery, type ResolveResult } from "./resolve.js";
import { validateRegistry, type ValidationReport } from "./validate.js";

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * The registry service is the single place that enforces mutation-safety
 * rules (no silent overwrites, update requires an existing id, "delete"
 * doesn't exist for components — only deprecation) on top of the raw
 * file provider. MCP tool handlers and the CLI both call into this layer
 * so behavior can never drift between the two surfaces.
 */
export class RegistryService {
  constructor(private readonly provider: FileRegistryProvider) {}

  // ---------- Manifest ----------
  getManifest() {
    return this.provider.readManifest();
  }

  // ---------- Components (read) ----------
  async listComponents(filter?: { status?: string; tag?: string }): Promise<Component[]> {
    let components = await this.provider.readComponents();
    if (filter?.status) components = components.filter((c) => c.status === filter.status);
    if (filter?.tag) components = components.filter((c) => c.tags.includes(filter.tag!));
    return components;
  }

  async getComponent(id: string): Promise<Component> {
    const components = await this.provider.readComponents();
    const found = components.find((c) => c.id === id);
    if (!found) throw new NotFoundError("component", id);
    return found;
  }

  /** Free-text search across id, name, aliases, tags, description. Still deterministic substring matching — not fuzzy AI matching. */
  async findComponent(query: string): Promise<Component[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const components = await this.provider.readComponents();
    return components.filter((c) => {
      const haystack = [c.id, c.name, c.description ?? "", ...c.aliases, ...c.tags].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }

  async findByDesignReference(query: ResolveQuery["design"]): Promise<ResolveResult> {
    const components = await this.provider.readComponents();
    return resolveComponent(components, { design: query });
  }

  async resolve(query: ResolveQuery): Promise<ResolveResult> {
    const components = await this.provider.readComponents();
    return resolveComponent(components, query);
  }

  // ---------- Components (write) ----------
  async createComponent(input: ComponentInput): Promise<Component> {
    const components = await this.provider.readComponents();
    if (components.some((c) => c.id === input.id)) {
      throw new DuplicateIdError("component", input.id);
    }
    const timestamp = nowIso();
    const component = ComponentSchema.parse({ ...input, createdAt: timestamp, updatedAt: timestamp });
    await this.provider.writeComponents([...components, component]);
    return component;
  }

  async updateComponent(patch: ComponentPatch): Promise<Component> {
    const components = await this.provider.readComponents();
    const index = components.findIndex((c) => c.id === patch.id);
    if (index === -1) throw new NotFoundError("component", patch.id);
    const existing = components[index]!;
    const merged = ComponentSchema.parse({ ...existing, ...patch, updatedAt: nowIso() });
    const next = [...components];
    next[index] = merged;
    await this.provider.writeComponents(next);
    return merged;
  }

  /** There is no destructive delete for components — deprecate instead, per mutation-safety requirements. */
  async deprecateComponent(id: string, reason?: string, replacedBy?: string): Promise<Component> {
    return this.updateComponent({
      id,
      status: "deprecated",
      deprecation: { reason, replacedBy, deprecatedAt: nowIso() },
    });
  }

  // ---------- Tokens ----------
  async listTokens(filter?: { category?: string }): Promise<Token[]> {
    let tokens = await this.provider.readTokens();
    if (filter?.category) tokens = tokens.filter((t) => t.category === filter.category);
    return tokens;
  }

  async getToken(id: string): Promise<Token> {
    const tokens = await this.provider.readTokens();
    const found = tokens.find((t) => t.id === id);
    if (!found) throw new NotFoundError("token", id);
    return found;
  }

  async createToken(input: TokenInput): Promise<Token> {
    const tokens = await this.provider.readTokens();
    if (tokens.some((t) => t.id === input.id)) throw new DuplicateIdError("token", input.id);
    const timestamp = nowIso();
    const token = TokenSchema.parse({ ...input, createdAt: timestamp, updatedAt: timestamp });
    await this.provider.writeTokens([...tokens, token]);
    return token;
  }

  async updateToken(patch: TokenPatch): Promise<Token> {
    const tokens = await this.provider.readTokens();
    const index = tokens.findIndex((t) => t.id === patch.id);
    if (index === -1) throw new NotFoundError("token", patch.id);
    const merged = TokenSchema.parse({ ...tokens[index], ...patch, updatedAt: nowIso() });
    const next = [...tokens];
    next[index] = merged;
    await this.provider.writeTokens(next);
    return merged;
  }

  // ---------- Patterns ----------
  async listPatterns(): Promise<Pattern[]> {
    return this.provider.readPatterns();
  }

  async getPattern(id: string): Promise<Pattern> {
    const patterns = await this.provider.readPatterns();
    const found = patterns.find((p) => p.id === id);
    if (!found) throw new NotFoundError("pattern", id);
    return found;
  }

  async createPattern(input: PatternInput): Promise<Pattern> {
    const patterns = await this.provider.readPatterns();
    if (patterns.some((p) => p.id === input.id)) throw new DuplicateIdError("pattern", input.id);
    const timestamp = nowIso();
    const pattern = PatternSchema.parse({ ...input, createdAt: timestamp, updatedAt: timestamp });
    await this.provider.writePatterns([...patterns, pattern]);
    return pattern;
  }

  async updatePattern(patch: PatternPatch): Promise<Pattern> {
    const patterns = await this.provider.readPatterns();
    const index = patterns.findIndex((p) => p.id === patch.id);
    if (index === -1) throw new NotFoundError("pattern", patch.id);
    const merged = PatternSchema.parse({ ...patterns[index], ...patch, updatedAt: nowIso() });
    const next = [...patterns];
    next[index] = merged;
    await this.provider.writePatterns(next);
    return merged;
  }

  // ---------- Rules ----------
  async getRules(): Promise<RulesDocument> {
    return this.provider.readRules();
  }

  async updateRules(rules: Rule[]): Promise<RulesDocument> {
    const doc: RulesDocument = { rules };
    await this.provider.writeRules(doc);
    return doc;
  }

  // ---------- Validation ----------
  async validate(): Promise<ValidationReport> {
    const data = await this.provider.readAll();
    return validateRegistry(data);
  }
}

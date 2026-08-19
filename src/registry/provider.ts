import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { Component } from "../schema/component.js";
import { Manifest } from "../schema/manifest.js";
import { Pattern } from "../schema/pattern.js";
import { RulesDocument } from "../schema/rules.js";
import { Token } from "../schema/token.js";
import { RegistryNotFoundError } from "../utils/errors.js";
import { REGISTRY_FILES, registryExists } from "./paths.js";

const ComponentsFile = z.object({ components: z.array(Component).default([]) });
const TokensFile = z.object({ tokens: z.array(Token).default([]) });
const PatternsFile = z.object({ patterns: z.array(Pattern).default([]) });

export type RegistryData = {
  manifest: Manifest;
  components: Component[];
  tokens: Token[];
  patterns: Pattern[];
  rules: RulesDocument;
};

/**
 * The default, file-based registry provider. The MCP server is the generic
 * engine; this class is the only piece that knows registry data lives as
 * JSON files on disk. A different provider (e.g. backed by a remote API)
 * could implement the same shape without changing any MCP tool logic.
 */
export class FileRegistryProvider {
  constructor(private readonly registryPath: string) {}

  get path(): string {
    return this.registryPath;
  }

  exists(): boolean {
    return registryExists(this.registryPath);
  }

  private assertExists(): void {
    if (!this.exists()) {
      throw new RegistryNotFoundError(this.registryPath);
    }
  }

  private filePath(file: keyof typeof REGISTRY_FILES): string {
    return path.join(this.registryPath, REGISTRY_FILES[file]);
  }

  /** Deterministic, diff-friendly JSON: 2-space indent, trailing newline, key order as inserted. */
  private async writeJson(filePath: string, data: unknown): Promise<void> {
    await mkdir(path.dirname(filePath), { recursive: true });
    const json = JSON.stringify(data, null, 2) + "\n";
    await writeFile(filePath, json, "utf-8");
  }

  private async readJson<T>(filePath: string): Promise<T> {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  }

  async readManifest(): Promise<Manifest> {
    this.assertExists();
    const raw = await this.readJson<unknown>(this.filePath("manifest"));
    return Manifest.parse(raw);
  }

  async writeManifest(manifest: Manifest): Promise<void> {
    await this.writeJson(this.filePath("manifest"), Manifest.parse(manifest));
  }

  async readComponents(): Promise<Component[]> {
    this.assertExists();
    const raw = await this.readJson<unknown>(this.filePath("components"));
    return ComponentsFile.parse(raw).components;
  }

  async writeComponents(components: Component[]): Promise<void> {
    await this.writeJson(this.filePath("components"), { components });
  }

  async readTokens(): Promise<Token[]> {
    this.assertExists();
    const raw = await this.readJson<unknown>(this.filePath("tokens"));
    return TokensFile.parse(raw).tokens;
  }

  async writeTokens(tokens: Token[]): Promise<void> {
    await this.writeJson(this.filePath("tokens"), { tokens });
  }

  async readPatterns(): Promise<Pattern[]> {
    this.assertExists();
    const raw = await this.readJson<unknown>(this.filePath("patterns"));
    return PatternsFile.parse(raw).patterns;
  }

  async writePatterns(patterns: Pattern[]): Promise<void> {
    await this.writeJson(this.filePath("patterns"), { patterns });
  }

  async readRules(): Promise<RulesDocument> {
    this.assertExists();
    const raw = await this.readJson<unknown>(this.filePath("rules"));
    return RulesDocument.parse(raw);
  }

  async writeRules(rules: RulesDocument): Promise<void> {
    await this.writeJson(this.filePath("rules"), rules);
  }

  async readAll(): Promise<RegistryData> {
    const [manifest, components, tokens, patterns, rules] = await Promise.all([
      this.readManifest(),
      this.readComponents(),
      this.readTokens(),
      this.readPatterns(),
      this.readRules(),
    ]);
    return { manifest, components, tokens, patterns, rules };
  }
}

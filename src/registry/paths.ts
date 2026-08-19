import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Resolve the registry root directory (the directory that directly contains
 * manifest.json, components.json, etc — i.e. `.design/registry`).
 *
 * Precedence, highest first:
 *   1. `explicitPath` argument (e.g. passed via CLI flag or MCP tool arg)
 *   2. `DESIGN_REGISTRY_PATH` environment variable
 *   3. `.design/registry` under `cwd`
 *
 * This never assumes a fixed absolute path and never requires the registry
 * to already exist — callers decide whether existence matters.
 */
export function resolveRegistryPath(options?: { explicitPath?: string; cwd?: string }): string {
  const cwd = options?.cwd ?? process.cwd();

  if (options?.explicitPath) {
    return path.isAbsolute(options.explicitPath) ? options.explicitPath : path.resolve(cwd, options.explicitPath);
  }

  const envPath = process.env.DESIGN_REGISTRY_PATH;
  if (envPath) {
    return path.isAbsolute(envPath) ? envPath : path.resolve(cwd, envPath);
  }

  return path.resolve(cwd, ".design", "registry");
}

export function registryExists(registryPath: string): boolean {
  return existsSync(path.join(registryPath, "manifest.json"));
}

export const REGISTRY_FILES = {
  manifest: "manifest.json",
  components: "components.json",
  tokens: "tokens.json",
  patterns: "patterns.json",
  rules: "rules.json",
} as const;

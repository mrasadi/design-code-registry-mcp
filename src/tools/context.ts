import { RegistryService } from "../registry/service.js";
import { FileRegistryProvider } from "../registry/provider.js";
import { resolveRegistryPath } from "../registry/paths.js";

/**
 * Per-server context. `registryPath` is resolved once at startup (CLI flag >
 * env var > cwd default) but every tool re-reads files from disk on every
 * call — the registry is the source of truth, and there is no in-memory
 * cache to go stale.
 */
export interface ToolContext {
  registryPath: string;
  service: RegistryService;
}

export function createToolContext(explicitPath?: string): ToolContext {
  const registryPath = resolveRegistryPath({ explicitPath });
  const provider = new FileRegistryProvider(registryPath);
  const service = new RegistryService(provider);
  return { registryPath, service };
}

export interface ToolTextResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

/** All tool results are JSON-serialized text blocks — deterministic, structured, and easy for agents to parse. */
export function jsonResult(data: unknown): ToolTextResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

export function errorResult(error: unknown): ToolTextResult {
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string })?.code ?? "UNKNOWN_ERROR";
  return { content: [{ type: "text", text: JSON.stringify({ error: { code, message } }, null, 2) }], isError: true };
}

#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

export { createServer, SERVER_NAME, SERVER_VERSION } from "./server.js";
export * from "./registry/index.js";
export * from "./schema/index.js";

async function main(): Promise<void> {
  // Optional explicit registry path via --registry-path=<path>, otherwise
  // falls through to DESIGN_REGISTRY_PATH env var, otherwise cwd/.design/registry.
  const flagArg = process.argv.find((a) => a.startsWith("--registry-path="));
  const explicitPath = flagArg?.split("=").slice(1).join("=");

  const server = createServer({ registryPath: explicitPath });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // eslint-disable-next-line no-console
  console.error(`design-code-registry-mcp listening on stdio (registry path resolution deferred per-call)`);
}

// Only auto-start when this file is executed directly (not when imported by tests).
const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Fatal error starting design-code-registry-mcp:", error);
    process.exit(1);
  });
}

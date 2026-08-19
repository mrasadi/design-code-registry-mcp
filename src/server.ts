import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "./tools/index.js";

export const SERVER_NAME = "design-code-registry-mcp";
export const SERVER_VERSION = "0.1.0";

/**
 * Build a fully-configured McpServer. Kept separate from transport wiring
 * (stdio in `index.ts`) so tests can drive the server in-process, and so
 * an HTTP/SSE transport could be added later without touching tool logic.
 */
export function createServer(options?: { registryPath?: string }): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerAllTools(server, options);
  return server;
}

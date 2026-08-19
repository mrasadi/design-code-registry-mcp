import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerReadTools } from "./read.js";
import { registerWriteTools } from "./write.js";

export function registerAllTools(server: McpServer, options?: { registryPath?: string }): void {
  registerReadTools(server, options);
  registerWriteTools(server, options);
}

export { createToolContext } from "./context.js";

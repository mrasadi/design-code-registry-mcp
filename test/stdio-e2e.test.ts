import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTempRegistry, type TempRegistry } from "./helpers.js";

const DIST_ENTRY = path.resolve(process.cwd(), "dist", "index.js");

function parseToolJson(result: Awaited<ReturnType<Client["callTool"]>>): unknown {
  const content = result.content as Array<{ type: string; text?: string }>;
  const first = content[0];
  if (!first || first.type !== "text" || !first.text) throw new Error("Expected a text content block");
  return JSON.parse(first.text);
}

describe.skipIf(!existsSync(DIST_ENTRY))("stdio transport end-to-end (real subprocess)", () => {
  let reg: TempRegistry;
  let client: Client;
  let transport: StdioClientTransport;

  beforeEach(async () => {
    // 1. initialize a temporary registry
    reg = await createTempRegistry("Stdio E2E Project");
    // 2. populate it
    await reg.service.createComponent({
      id: "button",
      name: "Button",
      design: [{ tool: "figma", fileId: "FILE1", nodeId: "10:20", name: "Button" }],
      implementations: [{ language: "typescript", framework: "react", component: "Button", sourcePath: "src/Button.tsx" }],
    });

    // 3. start the MCP server as a real child process over stdio
    transport = new StdioClientTransport({
      command: process.execPath,
      args: [DIST_ENTRY, `--registry-path=${reg.registryPath}`],
    });
    client = new Client({ name: "e2e-test-client", version: "1.0" });
    await client.connect(transport);
  });

  afterEach(async () => {
    await client.close();
    await reg.cleanup();
  });

  it("lists tools, retrieves a component, resolves a Figma reference, and validates — all over real stdio", async () => {
    // 4. invoke MCP tools
    const { tools } = await client.listTools();
    expect(tools.length).toBeGreaterThanOrEqual(20);

    // 5. retrieve a component
    const getResult = await client.callTool({ name: "registry_get_component", arguments: { id: "button" } });
    const component = parseToolJson(getResult) as { id: string; implementations: unknown[] };
    expect(component.id).toBe("button");
    expect(component.implementations).toHaveLength(1);

    // 6. resolve a Figma reference
    const resolveResult = await client.callTool({
      name: "registry_find_by_design_reference",
      arguments: { tool: "figma", fileId: "FILE1", nodeId: "10:20" },
    });
    const resolved = parseToolJson(resolveResult) as { status: string; component?: { id: string } };
    expect(resolved.status).toBe("resolved");
    expect(resolved.component?.id).toBe("button");

    // 7. validate the registry
    const validateResult = await client.callTool({ name: "registry_validate", arguments: {} });
    const report = parseToolJson(validateResult) as { valid: boolean };
    expect(report.valid).toBe(true);
  });
});

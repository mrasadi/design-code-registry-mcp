import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer } from "../src/server.js";
import { createTempRegistry, type TempRegistry } from "./helpers.js";

function parseToolJson(result: Awaited<ReturnType<Client["callTool"]>>): unknown {
  const content = result.content as Array<{ type: string; text?: string }>;
  const first = content[0];
  if (!first || first.type !== "text" || !first.text) throw new Error("Expected a text content block");
  return JSON.parse(first.text);
}

describe("MCP tool invocation", () => {
  let reg: TempRegistry;
  let client: Client;

  beforeEach(async () => {
    reg = await createTempRegistry("MCP Tool Test Project");
    const server = createServer({ registryPath: reg.registryPath });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "test-client", version: "1.0" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterEach(async () => {
    await client.close();
    await reg.cleanup();
  });

  it("exposes exactly the required set of read and write tools", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "registry_get_manifest",
        "registry_list_components",
        "registry_get_component",
        "registry_find_component",
        "registry_find_by_design_reference",
        "registry_list_tokens",
        "registry_get_token",
        "registry_list_patterns",
        "registry_get_pattern",
        "registry_get_rules",
        "registry_validate",
        "registry_init",
        "registry_create_component",
        "registry_update_component",
        "registry_deprecate_component",
        "registry_create_token",
        "registry_update_token",
        "registry_create_pattern",
        "registry_update_pattern",
        "registry_update_rules",
      ].sort(),
    );
  });

  it("registry_get_manifest returns the initialized manifest", async () => {
    const result = await client.callTool({ name: "registry_get_manifest", arguments: {} });
    const manifest = parseToolJson(result) as { project: { name: string } };
    expect(manifest.project.name).toBe("MCP Tool Test Project");
  });

  it("registry_create_component then registry_get_component round-trips", async () => {
    await client.callTool({ name: "registry_create_component", arguments: { id: "button", name: "Button" } });
    const result = await client.callTool({ name: "registry_get_component", arguments: { id: "button" } });
    const component = parseToolJson(result) as { id: string; name: string };
    expect(component.id).toBe("button");
    expect(component.name).toBe("Button");
  });

  it("registry_create_component fails with a structured error on duplicate id", async () => {
    await client.callTool({ name: "registry_create_component", arguments: { id: "button", name: "Button" } });
    const result = await client.callTool({ name: "registry_create_component", arguments: { id: "button", name: "Button 2" } });
    expect(result.isError).toBe(true);
    const body = parseToolJson(result) as { error: { code: string } };
    expect(body.error.code).toBe("DUPLICATE_ID");
  });

  it("registry_find_by_design_reference resolves a Figma reference deterministically", async () => {
    await client.callTool({
      name: "registry_create_component",
      arguments: { id: "button", name: "Button", design: [{ tool: "figma", fileId: "F1", nodeId: "1:1" }] },
    });
    const result = await client.callTool({
      name: "registry_find_by_design_reference",
      arguments: { tool: "figma", fileId: "F1", nodeId: "1:1" },
    });
    const body = parseToolJson(result) as { status: string; component?: { id: string } };
    expect(body.status).toBe("resolved");
    expect(body.component?.id).toBe("button");
  });

  it("registry_deprecate_component marks status without deleting", async () => {
    await client.callTool({ name: "registry_create_component", arguments: { id: "button", name: "Button" } });
    const deprecateResult = await client.callTool({
      name: "registry_deprecate_component",
      arguments: { id: "button", reason: "unused" },
    });
    const deprecated = parseToolJson(deprecateResult) as { status: string };
    expect(deprecated.status).toBe("deprecated");

    const getResult = await client.callTool({ name: "registry_get_component", arguments: { id: "button" } });
    expect((parseToolJson(getResult) as { status: string }).status).toBe("deprecated");
  });

  it("registry_validate reports a clean registry as valid", async () => {
    const result = await client.callTool({ name: "registry_validate", arguments: {} });
    const report = parseToolJson(result) as { valid: boolean };
    expect(report.valid).toBe(true);
  });

  it("registry_create_token then registry_list_tokens round-trips", async () => {
    await client.callTool({
      name: "registry_create_token",
      arguments: { id: "color-primary", name: "Primary", category: "color", value: "#0055FF" },
    });
    const result = await client.callTool({ name: "registry_list_tokens", arguments: {} });
    const body = parseToolJson(result) as { count: number };
    expect(body.count).toBe(1);
  });

  it("registry_create_pattern then registry_get_pattern round-trips", async () => {
    await client.callTool({ name: "registry_create_component", arguments: { id: "button", name: "Button" } });
    await client.callTool({
      name: "registry_create_pattern",
      arguments: { id: "empty-state", name: "Empty State", components: ["button"] },
    });
    const result = await client.callTool({ name: "registry_get_pattern", arguments: { id: "empty-state" } });
    const pattern = parseToolJson(result) as { components: string[] };
    expect(pattern.components).toEqual(["button"]);
  });

  it("registry_update_rules then registry_get_rules round-trips", async () => {
    await client.callTool({
      name: "registry_update_rules",
      arguments: { rules: [{ id: "r1", statement: "Prefer reuse", severity: "must" }] },
    });
    const result = await client.callTool({ name: "registry_get_rules", arguments: {} });
    const doc = parseToolJson(result) as { rules: Array<{ id: string }> };
    expect(doc.rules).toHaveLength(1);
    expect(doc.rules[0]?.id).toBe("r1");
  });
});

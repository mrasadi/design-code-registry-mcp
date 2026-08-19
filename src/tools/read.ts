import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { RegistryId } from "../schema/common.js";
import { createToolContext, errorResult, jsonResult } from "./context.js";

/**
 * Register every read-only (side-effect-free) tool. Registered first so the
 * tool list an agent sees is roughly ordered read-before-write.
 */
export function registerReadTools(server: McpServer, options?: { registryPath?: string }): void {
  const ctx = () => createToolContext(options?.registryPath);

  server.registerTool(
    "registry_get_manifest",
    {
      title: "Get registry manifest",
      description:
        "Return the registry's manifest: schema version, registry version, project info, and configured design tool(s). Use this first to confirm a registry exists and understand what project it describes.",
      inputSchema: {},
    },
    async () => {
      try {
        const manifest = await ctx().service.getManifest();
        return jsonResult(manifest);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "registry_list_components",
    {
      title: "List components",
      description:
        "List all design components in the registry, optionally filtered by lifecycle status or tag. Use this to browse what already exists before proposing a new component.",
      inputSchema: {
        status: z.enum(["proposed", "approved", "deprecated", "experimental"]).optional().describe("Filter by lifecycle status."),
        tag: z.string().optional().describe("Filter to components carrying this tag."),
      },
    },
    async ({ status, tag }) => {
      try {
        const components = await ctx().service.listComponents({ status, tag });
        return jsonResult({ count: components.length, components });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "registry_get_component",
    {
      title: "Get component by id",
      description: "Fetch a single component by its exact stable registry id. Returns an error if no such component exists.",
      inputSchema: { id: RegistryId.describe("The component's stable registry id.") },
    },
    async ({ id }) => {
      try {
        return jsonResult(await ctx().service.getComponent(id));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "registry_find_component",
    {
      title: "Search components",
      description:
        "Deterministic substring search across component id, name, aliases, tags, and description. NOT semantic/AI search — use registry_get_component or registry_find_by_design_reference when you already know an exact identifier.",
      inputSchema: { query: z.string().min(1).describe("Free-text query, matched as a case-insensitive substring.") },
    },
    async ({ query }) => {
      try {
        const results = await ctx().service.findComponent(query);
        return jsonResult({ count: results.length, components: results });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "registry_find_by_design_reference",
    {
      title: "Resolve a design reference to a component",
      description:
        "Deterministically resolve a design-tool reference (e.g. a Figma fileKey/nodeId pair) to a registered component. " +
        "Returns status 'resolved' with exactly one component, 'ambiguous' with all matching candidates, or 'unresolved' if nothing matches. " +
        "Never guesses — if you get 'unresolved', treat the mapping as genuinely absent rather than inferring one.",
      inputSchema: {
        tool: z.string().min(1).describe("Design tool identifier, e.g. 'figma'."),
        fileId: z.string().optional().describe("Design file/document identifier (e.g. Figma fileKey)."),
        nodeId: z.string().optional().describe("Design node/component identifier (e.g. Figma nodeId)."),
        url: z.string().optional().describe("Deep link to the design node, if that's what you have."),
        name: z.string().optional().describe("The component's name as it appears in the design tool."),
      },
    },
    async ({ tool, fileId, nodeId, url, name }) => {
      try {
        const result = await ctx().service.findByDesignReference({ tool, fileId, nodeId, url, name });
        return jsonResult(result);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "registry_list_tokens",
    {
      title: "List design tokens",
      description: "List all design tokens, optionally filtered by category (color, spacing, typography, ...).",
      inputSchema: {
        category: z
          .enum(["color", "typography", "spacing", "radius", "shadow", "breakpoint", "motion", "z-index", "border", "opacity", "size", "custom"])
          .optional(),
      },
    },
    async ({ category }) => {
      try {
        const tokens = await ctx().service.listTokens({ category });
        return jsonResult({ count: tokens.length, tokens });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "registry_get_token",
    {
      title: "Get token by id",
      description: "Fetch a single design token by its exact stable registry id.",
      inputSchema: { id: RegistryId },
    },
    async ({ id }) => {
      try {
        return jsonResult(await ctx().service.getToken(id));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "registry_list_patterns",
    {
      title: "List UI patterns",
      description: "List all higher-level UI patterns (e.g. empty state, search toolbar) registered in the project.",
      inputSchema: {},
    },
    async () => {
      try {
        const patterns = await ctx().service.listPatterns();
        return jsonResult({ count: patterns.length, patterns });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "registry_get_pattern",
    {
      title: "Get pattern by id",
      description: "Fetch a single UI pattern by its exact stable registry id, including the components it composes.",
      inputSchema: { id: RegistryId },
    },
    async ({ id }) => {
      try {
        return jsonResult(await ctx().service.getPattern(id));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "registry_get_rules",
    {
      title: "Get project rules",
      description:
        "Return the full set of structured design/engineering rules (e.g. 'prefer existing Button component', 'do not use arbitrary colors'). " +
        "Read this before generating UI code to respect project-specific constraints.",
      inputSchema: {},
    },
    async () => {
      try {
        return jsonResult(await ctx().service.getRules());
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "registry_validate",
    {
      title: "Validate the registry",
      description:
        "Run comprehensive validation across the whole registry: duplicate ids, duplicate design references, broken cross-references " +
        "(patterns/rules pointing at nonexistent components/tokens/patterns), circular pattern references, and other integrity issues. " +
        "Returns valid=false with a list of issues if anything is wrong.",
      inputSchema: {},
    },
    async () => {
      try {
        return jsonResult(await ctx().service.validate());
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DesignReference, LifecycleStatus, RegistryId } from "../schema/common.js";
import { AccessibilityInfo, ComponentRules, Implementation, PropertyDefinition } from "../schema/component.js";
import { Rule } from "../schema/rules.js";
import { TokenCategory } from "../schema/token.js";
import { initRegistry } from "../registry/init.js";
import { createToolContext, errorResult, jsonResult } from "./context.js";

export function registerWriteTools(server: McpServer, options?: { registryPath?: string }): void {
  const ctx = () => createToolContext(options?.registryPath);

  server.registerTool(
    "registry_init",
    {
      title: "Initialize a new registry",
      description:
        "Create a complete starter registry (.design/registry/{manifest,components,tokens,patterns,rules}.json + README) at the resolved registry path. " +
        "Fails if a registry already exists there unless force=true.",
      inputSchema: {
        projectName: z.string().min(1),
        projectDescription: z.string().optional(),
        designTool: z.string().optional().describe("Primary design tool, e.g. 'figma'. Informational only."),
        force: z.boolean().optional().describe("Overwrite an existing registry at this path. Use with caution."),
      },
    },
    async ({ projectName, projectDescription, designTool, force }) => {
      try {
        const { registryPath } = ctx();
        const manifest = await initRegistry({ registryPath, projectName, projectDescription, designTool, force });
        return jsonResult({ registryPath, manifest });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // ---------- Components ----------
  const componentWritableShape = {
    name: z.string().min(1),
    aliases: z.array(z.string()).optional(),
    description: z.string().optional(),
    design: z.array(DesignReference).optional(),
    implementations: z.array(Implementation).optional(),
    variants: z.record(z.array(z.string())).optional(),
    properties: z.array(PropertyDefinition).optional(),
    states: z.array(z.string()).optional(),
    accessibility: AccessibilityInfo.optional(),
    rules: ComponentRules.optional(),
    tags: z.array(z.string()).optional(),
    status: LifecycleStatus.optional(),
  };

  server.registerTool(
    "registry_create_component",
    {
      title: "Create a new component",
      description:
        "Register a brand-new design component. Fails with DUPLICATE_ID if the id already exists — use registry_update_component instead. " +
        "Only propose a new component when registry_find_component / registry_find_by_design_reference confirm no equivalent component exists.",
      inputSchema: { id: RegistryId, ...componentWritableShape },
    },
    async ({ id, ...rest }) => {
      try {
        const component = await ctx().service.createComponent({ id, ...rest });
        return jsonResult(component);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "registry_update_component",
    {
      title: "Update an existing component",
      description:
        "Patch an existing component by id. Only provided fields are changed; omitted fields are left as-is. " +
        "Fails with NOT_FOUND if the id doesn't exist yet — use registry_create_component instead.",
      inputSchema: { id: RegistryId, ...Object.fromEntries(Object.entries(componentWritableShape).map(([k, v]) => [k, v.optional()])) },
    },
    async ({ id, ...rest }) => {
      try {
        const component = await ctx().service.updateComponent({ id, ...rest } as never);
        return jsonResult(component);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "registry_deprecate_component",
    {
      title: "Deprecate a component",
      description:
        "Mark a component as deprecated instead of deleting it. There is no destructive delete operation for components by design — " +
        "history stays in git and agents can still see what a component used to map to.",
      inputSchema: {
        id: RegistryId,
        reason: z.string().optional(),
        replacedBy: RegistryId.optional().describe("The id of the component that should be used instead, if any."),
      },
    },
    async ({ id, reason, replacedBy }) => {
      try {
        const component = await ctx().service.deprecateComponent(id, reason, replacedBy);
        return jsonResult(component);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // ---------- Tokens ----------
  server.registerTool(
    "registry_create_token",
    {
      title: "Create a new design token",
      description: "Register a brand-new design token. Fails with DUPLICATE_ID if the id already exists — use registry_update_token instead.",
      inputSchema: {
        id: RegistryId,
        name: z.string().min(1),
        category: TokenCategory,
        value: z.union([z.string(), z.number(), z.record(z.unknown())]),
        type: z.string().optional(),
        source: z.string().optional(),
        description: z.string().optional(),
        usage: z.string().optional(),
        aliases: z.array(z.string()).optional(),
      },
    },
    async (input) => {
      try {
        return jsonResult(await ctx().service.createToken(input));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "registry_update_token",
    {
      title: "Update an existing design token",
      description: "Patch an existing token by id. Fails with NOT_FOUND if the id doesn't exist yet.",
      inputSchema: {
        id: RegistryId,
        name: z.string().min(1).optional(),
        category: TokenCategory.optional(),
        value: z.union([z.string(), z.number(), z.record(z.unknown())]).optional(),
        type: z.string().optional(),
        source: z.string().optional(),
        description: z.string().optional(),
        usage: z.string().optional(),
        aliases: z.array(z.string()).optional(),
        deprecated: z.boolean().optional(),
        deprecation: z.object({ reason: z.string().optional(), replacedBy: RegistryId.optional() }).optional(),
      },
    },
    async (input) => {
      try {
        return jsonResult(await ctx().service.updateToken(input as never));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // ---------- Patterns ----------
  const patternWritableShape = {
    name: z.string().min(1),
    description: z.string().optional(),
    design: z.array(DesignReference).optional(),
    components: z.array(RegistryId).optional(),
    relatedPatterns: z.array(RegistryId).optional(),
    compositionRules: z.array(z.string()).optional(),
    layoutRules: z.array(z.string()).optional(),
    responsiveBehavior: z.string().optional(),
    usageConstraints: z.array(z.string()).optional(),
    status: LifecycleStatus.optional(),
    tags: z.array(z.string()).optional(),
  };

  server.registerTool(
    "registry_create_pattern",
    {
      title: "Create a new UI pattern",
      description: "Register a brand-new higher-level UI pattern composed of one or more components.",
      inputSchema: { id: RegistryId, ...patternWritableShape },
    },
    async ({ id, ...rest }) => {
      try {
        return jsonResult(await ctx().service.createPattern({ id, ...rest }));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "registry_update_pattern",
    {
      title: "Update an existing UI pattern",
      description: "Patch an existing pattern by id. Fails with NOT_FOUND if the id doesn't exist yet.",
      inputSchema: { id: RegistryId, ...Object.fromEntries(Object.entries(patternWritableShape).map(([k, v]) => [k, v.optional()])) },
    },
    async ({ id, ...rest }) => {
      try {
        return jsonResult(await ctx().service.updatePattern({ id, ...rest } as never));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // ---------- Rules ----------
  server.registerTool(
    "registry_update_rules",
    {
      title: "Replace the project's rules",
      description:
        "Replace the full set of structured design/engineering rules. This is a full-document replace (send the complete desired rule list, " +
        "not a delta) so the rules file stays deterministic and diff-friendly.",
      inputSchema: { rules: z.array(Rule) },
    },
    async ({ rules }) => {
      try {
        return jsonResult(await ctx().service.updateRules(rules));
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}

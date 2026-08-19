import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { CURRENT_SCHEMA_VERSION, Manifest } from "../schema/manifest.js";
import { RegistryAlreadyExistsError } from "../utils/errors.js";
import { FileRegistryProvider } from "./provider.js";
import { registryExists } from "./paths.js";

export interface RegistryInitOptions {
  registryPath: string;
  projectName: string;
  projectDescription?: string;
  designTool?: string;
  force?: boolean;
}

const README_TEMPLATE = (projectName: string) => `# Design-Code Registry: ${projectName}

This directory is a **Design-Code Registry** — a deterministic, machine- and
human-readable mapping between design components/tokens/patterns and their
code implementations. It is consumed by AI coding agents through the
[Design-Code Registry MCP](https://github.com/) server, and by humans via the
\`design-code-registry\` CLI.

## Files

- \`manifest.json\` — registry metadata (schema version, project info, design tool).
- \`components.json\` — design components mapped to one or more code implementations.
- \`tokens.json\` — design tokens (color, spacing, typography, ...).
- \`patterns.json\` — higher-level UI patterns composed of components.
- \`rules.json\` — structured project decisions/constraints for agents to follow.

## Editing

You can edit these files directly (they're plain JSON, git-diff-friendly), or
use the CLI:

\`\`\`
design-code-registry add component
design-code-registry add token
design-code-registry add pattern
design-code-registry validate
\`\`\`

AI agents connected via MCP should query this registry before creating new
UI components, and treat it as authoritative for project-specific
Design ↔ Code mappings.
`;

/**
 * Create a complete starter registry on disk. Fails loudly (rather than
 * silently overwriting) if a registry already exists at the target path,
 * unless `force` is set.
 */
export async function initRegistry(options: RegistryInitOptions): Promise<Manifest> {
  const { registryPath } = options;

  if (registryExists(registryPath) && !options.force) {
    throw new RegistryAlreadyExistsError(registryPath);
  }

  await mkdir(registryPath, { recursive: true });

  const manifest: Manifest = Manifest.parse({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    registryVersion: "0.1.0",
    project: {
      name: options.projectName,
      description: options.projectDescription,
    },
    design: options.designTool ? { tool: options.designTool } : undefined,
  });

  const provider = new FileRegistryProvider(registryPath);
  await provider.writeManifest(manifest);
  await provider.writeComponents([]);
  await provider.writeTokens([]);
  await provider.writePatterns([]);
  await provider.writeRules({ rules: [] });

  const readmePath = path.join(registryPath, "README.md");
  await writeFile(readmePath, README_TEMPLATE(options.projectName), "utf-8");

  return manifest;
}

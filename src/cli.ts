#!/usr/bin/env node
import { Command } from "commander";
import { createInterface } from "node:readline/promises";
import { FileRegistryProvider } from "./registry/provider.js";
import { initRegistry } from "./registry/init.js";
import { resolveRegistryPath } from "./registry/paths.js";
import { RegistryService } from "./registry/service.js";

const program = new Command();
program
  .name("design-code-registry")
  .description("CLI for the Design-Code Registry — a deterministic Design ↔ Code mapping for AI coding agents.")
  .version("0.1.0")
  .option("-p, --path <path>", "explicit registry path (defaults to DESIGN_REGISTRY_PATH env var, then ./.design/registry)");

function serviceFor(explicitPath?: string): { service: RegistryService; registryPath: string } {
  const registryPath = resolveRegistryPath({ explicitPath });
  const provider = new FileRegistryProvider(registryPath);
  return { service: new RegistryService(provider), registryPath };
}

async function prompt(question: string, fallback = ""): Promise<string> {
  if (!process.stdin.isTTY) return fallback;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer || fallback;
}

program
  .command("init")
  .description("Initialize a new registry in this project")
  .option("--name <name>", "project name")
  .option("--description <description>", "project description")
  .option("--design-tool <tool>", "primary design tool, e.g. figma")
  .option("--force", "overwrite an existing registry", false)
  .action(async (opts) => {
    const { path: explicitPath } = program.opts();
    const registryPath = resolveRegistryPath({ explicitPath });
    const name = opts.name ?? (await prompt("Project name: ", "My Project"));
    try {
      const manifest = await initRegistry({
        registryPath,
        projectName: name,
        projectDescription: opts.description,
        designTool: opts.designTool,
        force: opts.force,
      });
      console.log(`Initialized registry at ${registryPath}`);
      console.log(JSON.stringify(manifest, null, 2));
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  });

program
  .command("validate")
  .description("Validate the registry and report issues")
  .action(async () => {
    const { service, registryPath } = serviceFor(program.opts().path);
    try {
      const report = await service.validate();
      console.log(`Registry: ${registryPath}`);
      console.log(JSON.stringify(report, null, 2));
      if (!report.valid) process.exitCode = 1;
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  });

const list = program.command("list").description("List entries in the registry");

list
  .command("components")
  .description("List all components")
  .option("--status <status>", "filter by lifecycle status")
  .option("--tag <tag>", "filter by tag")
  .action(async (opts) => {
    const { service } = serviceFor(program.opts().path);
    const components = await service.listComponents(opts);
    for (const c of components) {
      console.log(`${c.id}\t${c.name}\t[${c.status}]\t${c.implementations.map((i) => i.framework ?? i.language).join(",") || "(no impl)"}`);
    }
    console.log(`\n${components.length} component(s).`);
  });

list
  .command("tokens")
  .description("List all tokens")
  .option("--category <category>", "filter by category")
  .action(async (opts) => {
    const { service } = serviceFor(program.opts().path);
    const tokens = await service.listTokens(opts);
    for (const t of tokens) console.log(`${t.id}\t${t.name}\t[${t.category}]\t${JSON.stringify(t.value)}`);
    console.log(`\n${tokens.length} token(s).`);
  });

list
  .command("patterns")
  .description("List all patterns")
  .action(async () => {
    const { service } = serviceFor(program.opts().path);
    const patterns = await service.listPatterns();
    for (const p of patterns) console.log(`${p.id}\t${p.name}\tcomponents: ${p.components.join(", ") || "(none)"}`);
    console.log(`\n${patterns.length} pattern(s).`);
  });

const add = program.command("add").description("Add a new entry to the registry");

add
  .command("component")
  .description("Add a new component")
  .requiredOption("--id <id>", "stable registry id")
  .option("--name <name>", "canonical name")
  .option("--description <description>", "description")
  .action(async (opts) => {
    const { service } = serviceFor(program.opts().path);
    const name = opts.name ?? (await prompt(`Canonical name for "${opts.id}": `, opts.id));
    try {
      const component = await service.createComponent({ id: opts.id, name, description: opts.description });
      console.log(JSON.stringify(component, null, 2));
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  });

add
  .command("token")
  .description("Add a new design token")
  .requiredOption("--id <id>", "stable registry id")
  .requiredOption("--name <name>", "token name")
  .requiredOption("--category <category>", "token category, e.g. color, spacing, typography")
  .requiredOption("--value <value>", "token value")
  .action(async (opts) => {
    const { service } = serviceFor(program.opts().path);
    try {
      const token = await service.createToken({ id: opts.id, name: opts.name, category: opts.category, value: opts.value });
      console.log(JSON.stringify(token, null, 2));
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  });

add
  .command("pattern")
  .description("Add a new UI pattern")
  .requiredOption("--id <id>", "stable registry id")
  .option("--name <name>", "pattern name")
  .option("--components <ids>", "comma-separated component ids this pattern composes")
  .action(async (opts) => {
    const { service } = serviceFor(program.opts().path);
    const name = opts.name ?? (await prompt(`Name for pattern "${opts.id}": `, opts.id));
    const components = opts.components ? String(opts.components).split(",").map((s: string) => s.trim()) : [];
    try {
      const pattern = await service.createPattern({ id: opts.id, name, components });
      console.log(JSON.stringify(pattern, null, 2));
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv);

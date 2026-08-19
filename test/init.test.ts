import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initRegistry } from "../src/registry/init.js";
import { registryExists, resolveRegistryPath } from "../src/registry/paths.js";
import { RegistryAlreadyExistsError } from "../src/utils/errors.js";

describe("registry initialization", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "dcr-init-test-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("creates a complete starter registry structure", async () => {
    const registryPath = path.join(root, ".design", "registry");
    await initRegistry({ registryPath, projectName: "Acme", projectDescription: "desc", designTool: "figma" });

    expect(registryExists(registryPath)).toBe(true);

    const { FileRegistryProvider } = await import("../src/registry/provider.js");
    const provider = new FileRegistryProvider(registryPath);
    const manifest = await provider.readManifest();
    expect(manifest.project.name).toBe("Acme");
    expect(manifest.design?.tool).toBe("figma");
    expect(await provider.readComponents()).toEqual([]);
    expect(await provider.readTokens()).toEqual([]);
    expect(await provider.readPatterns()).toEqual([]);
    expect((await provider.readRules()).rules).toEqual([]);
  });

  it("refuses to overwrite an existing registry without force", async () => {
    const registryPath = path.join(root, ".design", "registry");
    await initRegistry({ registryPath, projectName: "Acme" });
    await expect(initRegistry({ registryPath, projectName: "Acme 2" })).rejects.toThrow(RegistryAlreadyExistsError);
  });

  it("overwrites when force=true", async () => {
    const registryPath = path.join(root, ".design", "registry");
    await initRegistry({ registryPath, projectName: "Acme" });
    await expect(initRegistry({ registryPath, projectName: "Acme 2", force: true })).resolves.toBeDefined();
  });
});

describe("registry path configuration", () => {
  const originalEnv = process.env.DESIGN_REGISTRY_PATH;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.DESIGN_REGISTRY_PATH;
    else process.env.DESIGN_REGISTRY_PATH = originalEnv;
  });

  it("defaults to <cwd>/.design/registry", () => {
    delete process.env.DESIGN_REGISTRY_PATH;
    const resolved = resolveRegistryPath({ cwd: "/some/project" });
    expect(resolved).toBe(path.resolve("/some/project", ".design", "registry"));
  });

  it("prefers the DESIGN_REGISTRY_PATH environment variable over the default", () => {
    process.env.DESIGN_REGISTRY_PATH = "/env/registry";
    const resolved = resolveRegistryPath({ cwd: "/some/project" });
    expect(resolved).toBe("/env/registry");
  });

  it("prefers an explicit path over both env var and default", () => {
    process.env.DESIGN_REGISTRY_PATH = "/env/registry";
    const resolved = resolveRegistryPath({ cwd: "/some/project", explicitPath: "/explicit/registry" });
    expect(resolved).toBe("/explicit/registry");
  });

  it("resolves a relative explicit path against cwd", () => {
    delete process.env.DESIGN_REGISTRY_PATH;
    const resolved = resolveRegistryPath({ cwd: "/some/project", explicitPath: "custom/registry" });
    expect(resolved).toBe(path.resolve("/some/project", "custom/registry"));
  });
});

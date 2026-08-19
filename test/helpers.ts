import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { initRegistry } from "../src/registry/init.js";
import { FileRegistryProvider } from "../src/registry/provider.js";
import { RegistryService } from "../src/registry/service.js";

export interface TempRegistry {
  root: string;
  registryPath: string;
  provider: FileRegistryProvider;
  service: RegistryService;
  cleanup: () => Promise<void>;
}

export async function createTempRegistry(projectName = "Test Project"): Promise<TempRegistry> {
  const root = await mkdtemp(path.join(tmpdir(), "dcr-test-"));
  const registryPath = path.join(root, ".design", "registry");
  await initRegistry({ registryPath, projectName, designTool: "figma" });
  const provider = new FileRegistryProvider(registryPath);
  const service = new RegistryService(provider);
  return {
    root,
    registryPath,
    provider,
    service,
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}

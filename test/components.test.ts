import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTempRegistry, type TempRegistry } from "./helpers.js";
import { DuplicateIdError, NotFoundError } from "../src/utils/errors.js";

describe("component operations", () => {
  let reg: TempRegistry;

  beforeEach(async () => {
    reg = await createTempRegistry();
  });

  afterEach(async () => {
    await reg.cleanup();
  });

  it("creates a component with schema defaults applied", async () => {
    const component = await reg.service.createComponent({ id: "button", name: "Button" });
    expect(component.id).toBe("button");
    expect(component.status).toBe("approved");
    expect(component.aliases).toEqual([]);
    expect(component.implementations).toEqual([]);
    expect(component.createdAt).toBeDefined();
    expect(component.updatedAt).toBeDefined();
  });

  it("rejects creating a component whose id already exists", async () => {
    await reg.service.createComponent({ id: "button", name: "Button" });
    await expect(reg.service.createComponent({ id: "button", name: "Button 2" })).rejects.toThrow(DuplicateIdError);
  });

  it("updates a component by patching only provided fields", async () => {
    const created = await reg.service.createComponent({ id: "button", name: "Button", tags: ["cta"] });
    const updated = await reg.service.updateComponent({ id: "button", description: "A clickable button" });
    expect(updated.description).toBe("A clickable button");
    expect(updated.tags).toEqual(["cta"]); // untouched field preserved
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.updatedAt).not.toBe(created.updatedAt);
  });

  it("rejects updating a component that doesn't exist", async () => {
    await expect(reg.service.updateComponent({ id: "does-not-exist", name: "X" })).rejects.toThrow(NotFoundError);
  });

  it("supports multiple implementations across frameworks for one component", async () => {
    const component = await reg.service.createComponent({
      id: "button",
      name: "Button",
      implementations: [
        { language: "typescript", framework: "react", component: "Button", sourcePath: "src/Button.tsx" },
        { language: "dart", framework: "flutter", component: "AppButton", sourcePath: "lib/app_button.dart" },
        { language: "swift", framework: "swiftui", component: "AppButton" },
      ],
    });
    expect(component.implementations).toHaveLength(3);
    expect(component.implementations.map((i) => i.framework)).toEqual(["react", "flutter", "swiftui"]);
  });

  it("deprecates a component instead of deleting it, preserving history", async () => {
    await reg.service.createComponent({ id: "old-button", name: "OldButton" });
    await reg.service.createComponent({ id: "button", name: "Button" });
    const deprecated = await reg.service.deprecateComponent("old-button", "superseded by Button", "button");

    expect(deprecated.status).toBe("deprecated");
    expect(deprecated.deprecation?.reason).toBe("superseded by Button");
    expect(deprecated.deprecation?.replacedBy).toBe("button");

    // Still fetchable — never actually deleted.
    const fetched = await reg.service.getComponent("old-button");
    expect(fetched.status).toBe("deprecated");
  });

  it("has no destructive delete operation exposed on the service", () => {
    expect((reg.service as unknown as { deleteComponent?: unknown }).deleteComponent).toBeUndefined();
  });

  it("lists components filtered by status and tag", async () => {
    await reg.service.createComponent({ id: "button", name: "Button", tags: ["cta"], status: "approved" });
    await reg.service.createComponent({ id: "input", name: "Input", tags: ["form"], status: "proposed" });

    expect((await reg.service.listComponents({ status: "approved" })).map((c) => c.id)).toEqual(["button"]);
    expect((await reg.service.listComponents({ tag: "form" })).map((c) => c.id)).toEqual(["input"]);
  });

  it("finds components via deterministic substring search across id/name/aliases/tags", async () => {
    await reg.service.createComponent({ id: "button", name: "Button", aliases: ["CTA"], tags: ["action"] });
    await reg.service.createComponent({ id: "input", name: "Input" });

    expect((await reg.service.findComponent("cta")).map((c) => c.id)).toEqual(["button"]);
    expect((await reg.service.findComponent("BUT")).map((c) => c.id)).toEqual(["button"]);
    expect(await reg.service.findComponent("nonexistent")).toEqual([]);
  });
});

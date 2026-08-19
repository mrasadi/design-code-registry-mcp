import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTempRegistry, type TempRegistry } from "./helpers.js";

describe("deterministic resolution", () => {
  let reg: TempRegistry;

  beforeEach(async () => {
    reg = await createTempRegistry();
    await reg.service.createComponent({
      id: "button",
      name: "Button",
      aliases: ["CTA", "Action Button"],
      design: [{ tool: "figma", fileId: "FILE123", nodeId: "1:23", name: "Button" }],
    });
    await reg.service.createComponent({
      id: "card",
      name: "Card",
      design: [{ tool: "figma", fileId: "FILE123", nodeId: "1:99", name: "Card" }],
    });
  });

  afterEach(async () => {
    await reg.cleanup();
  });

  it("resolves an exact registry id match", async () => {
    const result = await reg.service.resolve({ registryId: "button" });
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.strategy).toBe("registry-id");
      expect(result.component.id).toBe("button");
    }
  });

  it("resolves an exact Figma design reference (tool + fileId + nodeId)", async () => {
    const result = await reg.service.findByDesignReference({ tool: "figma", fileId: "FILE123", nodeId: "1:23" });
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.strategy).toBe("design-reference");
      expect(result.component.id).toBe("button");
    }
  });

  it("resolves an exact canonical name match", async () => {
    const result = await reg.service.resolve({ name: "Card" });
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") expect(result.component.id).toBe("card");
  });

  it("resolves an explicit alias match", async () => {
    const result = await reg.service.resolve({ alias: "CTA" });
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.strategy).toBe("alias");
      expect(result.component.id).toBe("button");
    }
  });

  it("prioritizes design-reference match over registry id / name / alias", async () => {
    // Even if a registryId is also supplied, design reference is checked first per the fixed precedence order.
    const result = await reg.service.resolve({
      registryId: "card", // would resolve to "card" if checked first
      design: { tool: "figma", fileId: "FILE123", nodeId: "1:23" }, // points to "button"
    });
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.strategy).toBe("design-reference");
      expect(result.component.id).toBe("button");
    }
  });

  it("reports ambiguous when multiple components match the same alias", async () => {
    await reg.service.createComponent({ id: "link-button", name: "LinkButton", aliases: ["CTA"] });
    const result = await reg.service.resolve({ alias: "CTA" });
    expect(result.status).toBe("ambiguous");
    if (result.status === "ambiguous") {
      expect(result.candidates.map((c) => c.id).sort()).toEqual(["button", "link-button"]);
    }
  });

  it("returns unresolved rather than guessing when nothing matches", async () => {
    const result = await reg.service.resolve({ registryId: "does-not-exist", name: "Nonexistent", alias: "nope" });
    expect(result.status).toBe("unresolved");
  });

  it("returns unresolved for a Figma reference to an unmapped node", async () => {
    const result = await reg.service.findByDesignReference({ tool: "figma", fileId: "FILE123", nodeId: "9:99" });
    expect(result.status).toBe("unresolved");
  });
});

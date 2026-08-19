import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTempRegistry, type TempRegistry } from "./helpers.js";

describe("registry validation", () => {
  let reg: TempRegistry;

  beforeEach(async () => {
    reg = await createTempRegistry();
  });

  afterEach(async () => {
    await reg.cleanup();
  });

  it("passes on a clean, empty registry", async () => {
    const report = await reg.service.validate();
    expect(report.valid).toBe(true);
    expect(report.errorCount).toBe(0);
  });

  it("detects a broken component reference from a pattern", async () => {
    await reg.service.createComponent({ id: "button", name: "Button" });
    // Bypass the service's own referential checks (it doesn't enforce pattern->component
    // existence at write time) by writing directly through the provider.
    await reg.provider.writePatterns([
      {
        id: "empty-state",
        name: "Empty State",
        design: [],
        components: ["does-not-exist"],
        relatedPatterns: [],
        compositionRules: [],
        layoutRules: [],
        usageConstraints: [],
        status: "approved",
        tags: [],
      },
    ]);

    const report = await reg.service.validate();
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.code === "BROKEN_REFERENCE")).toBe(true);
  });

  it("detects duplicate design references across two components", async () => {
    await reg.service.createComponent({
      id: "button",
      name: "Button",
      design: [{ tool: "figma", fileId: "F1", nodeId: "1:1" }],
    });
    await reg.service.createComponent({
      id: "button-duplicate",
      name: "Button Duplicate",
      design: [{ tool: "figma", fileId: "F1", nodeId: "1:1" }],
    });

    const report = await reg.service.validate();
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.code === "DUPLICATE_DESIGN_REFERENCE")).toBe(true);
  });

  it("detects circular pattern references", async () => {
    await reg.provider.writePatterns([
      {
        id: "pattern-a",
        name: "Pattern A",
        design: [],
        components: [],
        relatedPatterns: ["pattern-b"],
        compositionRules: [],
        layoutRules: [],
        usageConstraints: [],
        status: "approved",
        tags: [],
      },
      {
        id: "pattern-b",
        name: "Pattern B",
        design: [],
        components: [],
        relatedPatterns: ["pattern-a"],
        compositionRules: [],
        layoutRules: [],
        usageConstraints: [],
        status: "approved",
        tags: [],
      },
    ]);

    const report = await reg.service.validate();
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.code === "CIRCULAR_PATTERN_REFERENCE")).toBe(true);
  });

  it("detects a broken deprecation replacedBy reference", async () => {
    await reg.service.createComponent({ id: "button", name: "Button" });
    await reg.service.deprecateComponent("button", "old", "nonexistent-replacement");

    const report = await reg.service.validate();
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.code === "BROKEN_REFERENCE")).toBe(true);
  });

  it("warns (but does not error) when an approved component has no implementations", async () => {
    await reg.service.createComponent({ id: "button", name: "Button", status: "approved" });
    const report = await reg.service.validate();
    expect(report.valid).toBe(true);
    expect(report.issues.some((i) => i.code === "APPROVED_WITHOUT_IMPLEMENTATION" && i.severity === "warning")).toBe(true);
  });
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTempRegistry, type TempRegistry } from "./helpers.js";
import { DuplicateIdError, NotFoundError } from "../src/utils/errors.js";

describe("token operations", () => {
  let reg: TempRegistry;

  beforeEach(async () => {
    reg = await createTempRegistry();
  });

  afterEach(async () => {
    await reg.cleanup();
  });

  it("creates and fetches a token", async () => {
    await reg.service.createToken({ id: "color-primary", name: "Primary", category: "color", value: "#0055FF" });
    const token = await reg.service.getToken("color-primary");
    expect(token.value).toBe("#0055FF");
    expect(token.category).toBe("color");
  });

  it("rejects duplicate token ids", async () => {
    await reg.service.createToken({ id: "color-primary", name: "Primary", category: "color", value: "#0055FF" });
    await expect(
      reg.service.createToken({ id: "color-primary", name: "Primary 2", category: "color", value: "#000000" }),
    ).rejects.toThrow(DuplicateIdError);
  });

  it("updates a token", async () => {
    await reg.service.createToken({ id: "spacing-sm", name: "Small", category: "spacing", value: 4 });
    const updated = await reg.service.updateToken({ id: "spacing-sm", value: 8 });
    expect(updated.value).toBe(8);
  });

  it("rejects updating a nonexistent token", async () => {
    await expect(reg.service.updateToken({ id: "nope", value: 1 })).rejects.toThrow(NotFoundError);
  });

  it("filters tokens by category", async () => {
    await reg.service.createToken({ id: "color-primary", name: "Primary", category: "color", value: "#000" });
    await reg.service.createToken({ id: "spacing-sm", name: "Small", category: "spacing", value: 4 });
    expect((await reg.service.listTokens({ category: "color" })).map((t) => t.id)).toEqual(["color-primary"]);
  });
});

describe("pattern operations", () => {
  let reg: TempRegistry;

  beforeEach(async () => {
    reg = await createTempRegistry();
    await reg.service.createComponent({ id: "button", name: "Button" });
  });

  afterEach(async () => {
    await reg.cleanup();
  });

  it("creates a pattern referencing existing components", async () => {
    const pattern = await reg.service.createPattern({ id: "empty-state", name: "Empty State", components: ["button"] });
    expect(pattern.components).toEqual(["button"]);
  });

  it("rejects duplicate pattern ids", async () => {
    await reg.service.createPattern({ id: "empty-state", name: "Empty State" });
    await expect(reg.service.createPattern({ id: "empty-state", name: "Empty State 2" })).rejects.toThrow(DuplicateIdError);
  });

  it("updates a pattern", async () => {
    await reg.service.createPattern({ id: "empty-state", name: "Empty State" });
    const updated = await reg.service.updatePattern({ id: "empty-state", responsiveBehavior: "stacks vertically below 480px" });
    expect(updated.responsiveBehavior).toBe("stacks vertically below 480px");
  });
});

describe("rules operations", () => {
  let reg: TempRegistry;

  beforeEach(async () => {
    reg = await createTempRegistry();
    await reg.service.createComponent({ id: "button", name: "Button" });
  });

  afterEach(async () => {
    await reg.cleanup();
  });

  it("replaces the full rules document", async () => {
    const doc = await reg.service.updateRules([
      {
        id: "prefer-button",
        statement: "Prefer the existing Button component",
        appliesTo: { type: "component", id: "button" },
        severity: "must",
        tags: [],
      },
    ]);
    expect(doc.rules).toHaveLength(1);
    expect((await reg.service.getRules()).rules[0]?.id).toBe("prefer-button");
  });
});

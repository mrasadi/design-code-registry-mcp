import { describe, expect, it } from "vitest";
import { Component, ComponentInput } from "../src/schema/component.js";
import { Token } from "../src/schema/token.js";
import { RegistryId } from "../src/schema/common.js";

describe("schema validation", () => {
  it("rejects a registry id with invalid characters", () => {
    expect(() => RegistryId.parse("bad id with spaces!")).toThrow();
    expect(RegistryId.parse("valid-id_123")).toBe("valid-id_123");
  });

  it("rejects a component missing required fields", () => {
    expect(() => ComponentInput.parse({})).toThrow();
    expect(() => ComponentInput.parse({ id: "button" })).toThrow(); // missing name
  });

  it("applies schema defaults for optional component fields", () => {
    const parsed = Component.parse({ id: "button", name: "Button" });
    expect(parsed.status).toBe("approved");
    expect(parsed.aliases).toEqual([]);
    expect(parsed.rules).toEqual({ reuse: true, allowDuplicate: false });
  });

  it("rejects an invalid lifecycle status", () => {
    expect(() => Component.parse({ id: "button", name: "Button", status: "not-a-real-status" })).toThrow();
  });

  it("rejects a token with an invalid category", () => {
    expect(() => Token.parse({ id: "t1", name: "T1", category: "not-a-category", value: "1" })).toThrow();
  });

  it("accepts a token whose value is a composite object (e.g. typography)", () => {
    const parsed = Token.parse({
      id: "heading-lg",
      name: "Heading Large",
      category: "typography",
      value: { fontSize: 32, lineHeight: 40, fontWeight: 700 },
    });
    expect(parsed.value).toEqual({ fontSize: 32, lineHeight: 40, fontWeight: 700 });
  });
});

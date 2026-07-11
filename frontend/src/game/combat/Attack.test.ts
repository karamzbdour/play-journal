import { describe, it, expect } from "vitest";
import { ATTACKS } from "./Attack";
import { STATUS_EFFECTS } from "./StatusEffect";

describe("ATTACKS catalog", () => {
  it("only references effect ids that exist in STATUS_EFFECTS", () => {
    for (const attack of ATTACKS) {
      for (const application of attack.effects) {
        expect(STATUS_EFFECTS[application.effectId]).toBeDefined();
      }
    }
  });

  it("has unique attack ids", () => {
    const ids = ATTACKS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("requires strictly higher aggression for silencing_glare than for brace", () => {
    const brace = ATTACKS.find((a) => a.id === "brace")!;
    const glare = ATTACKS.find((a) => a.id === "silencing_glare")!;
    expect(glare.minAggression).toBeGreaterThan(brace.minAggression);
  });
});

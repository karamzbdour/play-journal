import { describe, it, expect, beforeEach } from "vitest";
import StatusEffectController from "./StatusEffectController";

describe("StatusEffectController", () => {
  let controller: StatusEffectController;

  beforeEach(() => {
    controller = new StatusEffectController();
  });

  it("applies an effect and reports it as active", () => {
    expect(controller.apply("slow", 1000)).toBe(true);
    expect(controller.has("slow")).toBe(true);
    expect(controller.getActiveIds()).toEqual(["slow"]);
  });

  it("returns the effect's magnitude while active, and the fallback when not", () => {
    expect(controller.getMagnitude("slow", 1)).toBe(1);
    controller.apply("slow", 1000);
    expect(controller.getMagnitude("slow", 1)).toBe(0.5);
  });

  it("expires an effect once its duration has elapsed", () => {
    controller.apply("slow", 1000);
    controller.update(600);
    expect(controller.has("slow")).toBe(true);
    controller.update(500);
    expect(controller.has("slow")).toBe(false);
  });

  it("refreshes duration on reapplication instead of stacking", () => {
    controller.apply("slow", 1000);
    controller.update(900);
    controller.apply("slow", 1000);
    controller.update(900);
    expect(controller.has("slow")).toBe(true);
  });

  it("blocks a cc-tagged effect while unstoppable is active", () => {
    controller.apply("unstoppable", 1000);
    expect(controller.apply("slow", 1000)).toBe(false);
    expect(controller.has("slow")).toBe(false);
  });

  it("does not block a buff while unstoppable is active", () => {
    controller.apply("unstoppable", 1000);
    expect(controller.apply("unstoppable", 500)).toBe(true);
  });

  it("ignores unknown effect ids", () => {
    expect(controller.apply("not_a_real_effect", 1000)).toBe(false);
  });
});

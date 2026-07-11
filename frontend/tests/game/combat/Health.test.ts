import { describe, it, expect } from "vitest";
import Health from "@/game/combat/Health";

describe("Health", () => {
  it("starts at full ratio and not dead", () => {
    const health = new Health(100);
    expect(health.getRatio()).toBe(1);
    expect(health.isDead).toBe(false);
  });

  it("reduces the ratio as damage is taken", () => {
    const health = new Health(100);
    health.takeDamage(25);
    expect(health.getRatio()).toBe(0.75);
    expect(health.isDead).toBe(false);
  });

  it("clamps at 0 and reports dead once damage meets or exceeds max", () => {
    const health = new Health(50);
    health.takeDamage(1000);
    expect(health.getRatio()).toBe(0);
    expect(health.isDead).toBe(true);
  });

  it("accumulates damage across multiple hits", () => {
    const health = new Health(100);
    health.takeDamage(30);
    health.takeDamage(30);
    expect(health.getRatio()).toBe(0.4);
    expect(health.isDead).toBe(false);
  });

  it("reports dead exactly at 0 remaining", () => {
    const health = new Health(40);
    health.takeDamage(40);
    expect(health.isDead).toBe(true);
    expect(health.getRatio()).toBe(0);
  });
});

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

describe("Health regen", () => {
  it("does not regen without a regen config", () => {
    const health = new Health(100);
    health.takeDamage(50);
    health.update(10000);
    expect(health.getRatio()).toBe(0.5);
  });

  it("does not regen before the delay has elapsed", () => {
    const health = new Health(100, { delayMs: 5000, perSecond: 10 });
    health.takeDamage(50);
    health.update(4999);
    expect(health.getRatio()).toBe(0.5);
  });

  it("regens at the configured rate once the delay has elapsed", () => {
    const health = new Health(100, { delayMs: 5000, perSecond: 10 });
    health.takeDamage(50);
    health.update(5000);
    health.update(1000);
    expect(health.getRatio()).toBe(0.6);
  });

  it("resets the delay timer whenever damage is taken", () => {
    const health = new Health(100, { delayMs: 5000, perSecond: 10 });
    health.takeDamage(50);
    health.update(4999);
    health.takeDamage(10);
    health.update(4999);
    expect(health.getRatio()).toBe(0.4);
  });

  it("does not regen past max", () => {
    const health = new Health(100, { delayMs: 5000, perSecond: 10 });
    health.takeDamage(5);
    health.update(5000);
    health.update(10000);
    expect(health.getRatio()).toBe(1);
  });

  it("does not revive a dead entity", () => {
    const health = new Health(100, { delayMs: 5000, perSecond: 10 });
    health.takeDamage(100);
    health.update(20000);
    expect(health.isDead).toBe(true);
    expect(health.getRatio()).toBe(0);
  });
});

import { describe, it, expect } from "vitest";
import { diffBadgeIds } from "./EntityLabel";

describe("diffBadgeIds", () => {
  it("reports newly active ids as added", () => {
    expect(diffBadgeIds([], ["slow"])).toEqual({ added: ["slow"], removed: [] });
  });

  it("reports ids no longer active as removed", () => {
    expect(diffBadgeIds(["slow"], [])).toEqual({ added: [], removed: ["slow"] });
  });

  it("reports ids present in both as neither added nor removed", () => {
    expect(diffBadgeIds(["slow"], ["slow"])).toEqual({ added: [], removed: [] });
  });

  it("handles simultaneous additions and removals", () => {
    expect(diffBadgeIds(["slow"], ["suppressed"])).toEqual({ added: ["suppressed"], removed: ["slow"] });
  });
});

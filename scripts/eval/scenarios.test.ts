import { describe, it, expect } from "vitest";
import { SCENARIOS, recallAtK } from "./scenarios";

describe("recallAtK", () => {
  it("scores overlapping results", () => {
    expect(recallAtK(["a", "b"], ["a", "x", "b"], 3)).toBe(1);
    expect(recallAtK(["a", "b"], ["a", "x"], 2)).toBe(0.5);
  });

  it("scores non-overlapping results as 0", () => {
    expect(recallAtK(["a"], ["x", "y"], 2)).toBe(0);
  });

  it("respects K", () => {
    expect(recallAtK(["a"], ["x", "a"], 1)).toBe(0);
    expect(recallAtK(["a"], ["x", "a"], 2)).toBe(1);
  });

  it("scores absent-KB scenarios as 1", () => {
    expect(recallAtK([], ["x"], 8)).toBe(1);
  });
});

describe("SCENARIOS", () => {
  it("has unique ids", () => {
    const ids = SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("references plausible source paths", () => {
    for (const s of SCENARIOS) {
      for (const src of s.expectedSources) {
        expect(src).toMatch(/^[a-z-]+\/[a-z0-9-]+\.ya?ml$/);
      }
    }
  });

  it("marks absent-KB scenarios as emptyKnowledge", () => {
    for (const s of SCENARIOS) {
      if (s.expectedSources.length === 0) {
        expect(s.emptyKnowledge).toBe(true);
      }
    }
  });
});

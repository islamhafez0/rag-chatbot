import { describe, it, expect } from "vitest";
import {
  THINKING_STAGES,
  stageForElapsed,
} from "../../components/chat/ThinkingLoader";

describe("stageForElapsed", () => {
  it("starts at the first stage", () => {
    expect(stageForElapsed(0)).toBe(0);
    expect(stageForElapsed(1499)).toBe(0);
  });

  it("advances through stages by elapsed time", () => {
    expect(stageForElapsed(1500)).toBe(1);
    expect(stageForElapsed(4499)).toBe(1);
    expect(stageForElapsed(4500)).toBe(2);
    expect(stageForElapsed(9999)).toBe(2);
    expect(stageForElapsed(10000)).toBe(3);
  });

  it("clamps at the final stage", () => {
    expect(stageForElapsed(999_999)).toBe(THINKING_STAGES.length - 1);
  });

  it("treats negative input as zero", () => {
    expect(stageForElapsed(-1)).toBe(0);
  });
});

describe("THINKING_STAGES", () => {
  it("covers the pipeline beats with non-empty labels", () => {
    expect(THINKING_STAGES.length).toBeGreaterThan(0);
    for (const label of THINKING_STAGES) {
      expect(label.trim().length).toBeGreaterThan(0);
    }
  });
});

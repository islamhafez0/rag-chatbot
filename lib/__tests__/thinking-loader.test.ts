import { describe, it, expect } from "vitest";
import { loaderLabel, SLOW_AFTER_MS } from "../../components/chat/ThinkingLoader";

describe("ThinkingLoader copy", () => {
  it("starts with a short, honest label", () => {
    expect(loaderLabel(false)).toBe("Thinking");
  });

  it("explains a slow first token instead of faking pipeline stages", () => {
    expect(loaderLabel(true)).toMatch(/still thinking/i);
    expect(SLOW_AFTER_MS).toBeGreaterThanOrEqual(5000);
  });
});

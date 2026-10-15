import { describe, it, expect } from "vitest";
import { replaceBreakTags } from "../markdown";

describe("replaceBreakTags", () => {
  it("collapses br variants to a space", () => {
    expect(replaceBreakTags("a<br>b")).toBe("a b");
    expect(replaceBreakTags("a<br/>b")).toBe("a b");
    expect(replaceBreakTags("a<br />b")).toBe("a b");
    expect(replaceBreakTags("a<BR>b")).toBe("a b");
  });

  it("cleans table cells that already carry bullets", () => {
    expect(replaceBreakTags("• Built X.<br>• Integrated Y.")).toBe(
      "• Built X. • Integrated Y.",
    );
  });

  it("leaves prose without br tags untouched", () => {
    const prose = "Plain text with <brackets> but no breaks.";
    expect(replaceBreakTags(prose)).toBe(prose);
  });
});

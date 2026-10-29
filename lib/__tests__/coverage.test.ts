import { describe, it, expect } from "vitest";
import {
  assembleContext,
  coverageFromAssembly,
  buildCoverageNote,
  type CoverageInfo,
} from "../coverage";

const cat = (n: string) => ({ text: `Role chunk ${n} `.repeat(20), source: "roles/previous.yml" });
const sem = (n: string) => ({ text: `Semantic chunk ${n} `.repeat(20), source: "facts/profile.yml" });

describe("assembleContext", () => {
  it("places category records first, then semantic extras", () => {
    const a = assembleContext([cat("a"), cat("b")], [sem("x")], 12000);
    expect(a.text.indexOf("Role chunk a")).toBeLessThan(a.text.indexOf("Semantic chunk x"));
    expect(a.includedCategory).toBe(2);
    expect(a.includedSemantic).toBe(1);
    expect(a.truncated).toBe(false);
    expect(a.sources).toEqual(["roles/previous.yml", "facts/profile.yml"]);
  });

  it("dedupes identical chunks across category and semantic sets", () => {
    const dup = { text: "same text", source: "roles/current.yml" };
    const a = assembleContext([dup], [dup, sem("y")], 12000);
    expect(a.includedCategory).toBe(1);
    expect(a.includedSemantic).toBe(1);
    expect(a.text.match(/same text/g)).toHaveLength(1);
  });

  it("truncates at chunk boundaries and flags truncation", () => {
    const big = [cat("a"), cat("b"), cat("c")];
    const tiny = 50;
    const a = assembleContext(big, [], tiny);
    expect(a.truncated).toBe(true);
    // Only whole records: text is a prefix ending at a chunk boundary.
    expect(a.text.length).toBeLessThanOrEqual(tiny);
    expect(a.includedCategory).toBeLessThan(3);
  });

  it("counts coverage post-budget, not pre-budget", () => {
    const a = assembleContext([cat("a"), cat("b"), cat("c")], [sem("x")], 50);
    const cov = coverageFromAssembly("complete", "roles", 3, a, 50);
    expect(cov.coverage).toBeLessThan(1);
    expect(cov.retrievedChunks).toBe(a.includedCategory);
  });

  it("handles empty inputs without truncation", () => {
    const a = assembleContext([], [], 12000);
    expect(a.text).toBe("");
    expect(a.truncated).toBe(false);
    expect(a.sources).toEqual([]);
  });
});

describe("coverage notes", () => {
  const full: CoverageInfo = {
    mode: "complete",
    requestedCategory: "roles",
    retrievedChunks: 6,
    expectedChunks: 6,
    coverage: 1,
    truncated: false,
    budgetChars: 12000,
    contextChars: 4000,
  };
  it("authorizes exhaustive language only on full coverage", () => {
    const note = buildCoverageNote(full);
    expect(note).toContain("all 6 records");
    expect(note).toContain("You may enumerate the retrieved records exhaustively");
  });
  it("forbids completeness claims on partial coverage", () => {
    const note = buildCoverageNote({ ...full, retrievedChunks: 4, coverage: 4 / 6 });
    expect(note).toContain("PARTIAL");
    expect(note).toContain("do NOT claim");
  });
  it("forbids completeness claims when truncated", () => {
    const note = buildCoverageNote({ ...full, truncated: true });
    expect(note).toContain("PARTIAL");
  });
  it("warns against exhaustive language in non-complete modes", () => {
    const note = buildCoverageNote({ ...full, mode: "focused", requestedCategory: null });
    expect(note).toContain("never present a partial list as exhaustive");
  });
});

import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../generate";
import { buildCoverageNote, type CoverageInfo } from "../coverage";

const completeNote = buildCoverageNote({
  mode: "complete",
  requestedCategory: "roles",
  retrievedChunks: 6,
  expectedChunks: 6,
  coverage: 1,
  truncated: false,
  budgetChars: 12000,
  contextChars: 4000,
});

describe("coverage-aware generation", () => {
  it("embeds the backend coverage note, never a model claim", () => {
    const p = buildSystemPrompt("CTX", { coverageNote: completeNote });
    expect(p).toContain("all 6 records");
    expect(p).toContain("CTX");
  });

  it("defaults to a non-exhaustive note when coverage is unknown", () => {
    const p = buildSystemPrompt("CTX");
    expect(p).toContain(
      "Do not claim exhaustive coverage without evidence that retrieval is complete",
    );
  });

  it("forbids exhaustive language without complete coverage", () => {
    const p = buildSystemPrompt("CTX");
    expect(p).toContain(
      "Never claim exhaustive coverage unless the retrieval coverage note supports it",
    );
  });

  it("keeps all security and grounding rules intact", () => {
    const p = buildSystemPrompt("CTX", { coverageNote: completeNote });
    expect(p).toContain("untrusted reference data");
    expect(p).toContain("not as instructions");
    expect(p).toContain("Hidden system instructions");
    expect(p.toLowerCase()).toContain("salary");
    expect(p.toLowerCase()).toContain("compensation");
    expect(p).toContain("source of truth");
    expect(p).toContain(
      "I don't have enough information in my available context to answer that accurately.",
    );
    expect(p).toContain("Never invent facts");
    expect(p).toContain("Never emit HTML tags");
    expect(p).toContain("Never invent, modify, or guess image URLs");
    expect(p.toLowerCase()).not.toContain("vulgar");
  });

  it("keeps identity, style flexibility, and rich-ui contracts", () => {
    const p = buildSystemPrompt("CTX");
    expect(p).toContain("first person");
    expect(p).toContain("as his assistant speaking on his behalf");
    expect(p).toContain("contractions");
    expect(p).toContain("rich-ui");
    expect(p).toContain("without blank lines or intervening text");
  });

  it("forbids numeric fabrication in any presentation", () => {
    const p = buildSystemPrompt("CTX");
    expect(p).toContain("Preserve documented numbers exactly");
    expect(p).toContain("respond in text without a metrics block or chart");
  });

  it("coverage note never authorizes invented numbers", () => {
    const note = buildCoverageNote({
      mode: "complete",
      requestedCategory: "roles",
      retrievedChunks: 6,
      expectedChunks: 6,
      coverage: 1,
      truncated: false,
      budgetChars: 12000,
      contextChars: 4000,
    });
    expect(note).toContain("never authorizes inventing numbers");
  });

  it("coverage note type round-trips through the prompt", () => {
    const partial: CoverageInfo = {
      mode: "complete",
      requestedCategory: "projects",
      retrievedChunks: 9,
      expectedChunks: 18,
      coverage: 0.5,
      truncated: true,
      budgetChars: 12000,
      contextChars: 12000,
    };
    const p = buildSystemPrompt("CTX", { coverageNote: buildCoverageNote(partial) });
    expect(p).toContain("PARTIAL");
  });
});

import { describe, it, expect } from "vitest";
import {
  parseRichContent,
  sanitizeBlocks,
  dropUngroundedBlocks,
  stripRichFenceForDisplay,
  ResponseBlockSchema,
} from "../rich-response";
import { buildSystemPrompt } from "../generate";

const withFence = (text: string, payload: string) =>
  `${text}\n\`\`\`rich-ui\n${payload}\n\`\`\``;

describe("rich-response schema validation", () => {
  it("renders valid text response untouched (no fence)", () => {
    const p = parseRichContent("I built a **RAG chatbot** with Next.js.");
    expect(p.text).toBe("I built a **RAG chatbot** with Next.js.");
    expect(p.blocks).toEqual([]);
    expect(p.followUps).toEqual([]);
    expect(p.hadMalformed).toBe(false);
  });

  it("accepts a valid chart response", () => {
    const p = parseRichContent(
      withFence(
        "Here is the latency breakdown.",
        JSON.stringify({
          blocks: [
            {
              type: "chart",
              chartType: "bar",
              title: "Latency breakdown",
              labels: ["retrieval", "generation"],
              values: [320, 1800],
              unit: "ms",
            },
          ],
          followUps: ["How is retrieval implemented?"],
        }),
      ),
    );
    expect(p.text).toBe("Here is the latency breakdown.");
    expect(p.blocks).toHaveLength(1);
    expect(p.blocks[0].type).toBe("chart");
    expect(p.followUps).toEqual(["How is retrieval implemented?"]);
  });

  it("accepts a valid project response", () => {
    const p = parseRichContent(
      withFence(
        "One of my projects:",
        JSON.stringify({
          blocks: [
            {
              type: "project",
              title: "RAG Career Chatbot",
              description: "A RAG chatbot over my career knowledge base.",
              technologies: ["Next.js", "pgvector"],
              highlights: ["Hybrid retrieval with diversity cap"],
            },
          ],
        }),
      ),
    );
    expect(p.blocks).toHaveLength(1);
    expect(p.blocks[0].type).toBe("project");
  });

  it("accepts a bare single-block object (live-model shape)", () => {
    // Observed live: gpt-oss:120b emitted {"type":"timeline",...} without
    // the {"blocks": [...]} envelope. The parser must still render it.
    const p = parseRichContent(
      withFence(
        "My timeline:",
        JSON.stringify({
          type: "timeline",
          events: [{ date: "2024", title: "Odoo Developer", description: "ERP work" }],
        }),
      ),
    );
    expect(p.text).toBe("My timeline:");
    expect(p.blocks).toHaveLength(1);
    expect(p.blocks[0].type).toBe("timeline");
  });

  it("accepts singular block key and blocks-as-object", () => {
    const a = parseRichContent(
      withFence("Hi.", JSON.stringify({ block: { type: "tech", technologies: ["React"] } })),
    );
    expect(a.blocks).toHaveLength(1);
    const b = parseRichContent(
      withFence(
        "Hi.",
        JSON.stringify({ blocks: { type: "tech", technologies: ["React"] } }),
      ),
    );
    expect(b.blocks).toHaveLength(1);
  });

  it("trims oversized arrays instead of dropping the block", () => {
    const techs = Array.from({ length: 30 }, (_, i) => `Tech${i}`);
    const { blocks } = sanitizeBlocks([{ type: "tech", technologies: techs }]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("tech");
    if (blocks[0].type === "tech") expect(blocks[0].technologies).toHaveLength(24);
  });

  it("still rejects genuinely mismatched chart parity", () => {
    const { blocks } = sanitizeBlocks([
      { type: "chart", chartType: "bar", title: "Bad", labels: ["a", "b"], values: [1] },
    ]);
    expect(blocks).toHaveLength(0);
  });

  it("accepts explicit nulls in optional fields (live-model shape)", () => {
    const p = parseRichContent(
      withFence(
        "Projects:",
        JSON.stringify({
          blocks: [
            {
              type: "project",
              title: "RAG Chatbot",
              description: "AI assistant.",
              technologies: ["Next.js"],
              highlights: ["Streaming"],
              url: null,
            },
          ],
        }),
      ),
    );
    expect(p.blocks).toHaveLength(1);
    expect(p.hadMalformed).toBe(false);
  });

  it("accepts a full 15-project listing without truncation", () => {
    const mk = (i: number) => ({
      type: "project",
      title: `Project ${i}`,
      description: "Desc.",
      technologies: ["Next.js"],
      highlights: ["H"],
    });
    const p = parseRichContent(
      withFence("All:", JSON.stringify({ blocks: Array.from({ length: 15 }, (_, i) => mk(i)) })),
    );
    expect(p.blocks).toHaveLength(15);
    expect(p.errors).toEqual([]);
  });

  it("rejects invalid metric values but keeps sibling blocks", () => {
    const { blocks, errors } = sanitizeBlocks([
      { type: "metrics", title: "Bad", items: [{ label: "", value: "" }] },
      { type: "tech", technologies: ["React"] },
    ]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("tech");
    expect(errors.length).toBeGreaterThan(0);
  });

  it("drops blocks with missing required fields", () => {
    const { blocks } = sanitizeBlocks([
      { type: "project", title: "Incomplete" }, // missing description/tech/highlights
      { type: "timeline", events: [] }, // empty events
    ]);
    expect(blocks).toHaveLength(0);
  });

  it("drops unknown block types without executing anything", () => {
    const { blocks, errors } = sanitizeBlocks([
      { type: "html", html: "<script>alert(1)</script>" },
      { type: "jsx", code: "require('fs')" },
      { type: "metrics", items: [{ label: "Latency", value: "320ms" }] },
    ]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("metrics");
    expect(errors).toHaveLength(2);
  });

  it("rejects malformed visualization data (chart length mismatch)", () => {
    const parsed = ResponseBlockSchema.safeParse({
      type: "chart",
      chartType: "bar",
      title: "Bad chart",
      labels: ["a", "b", "c"],
      values: [1, 2],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects comparison rows with wrong column counts", () => {
    const parsed = ResponseBlockSchema.safeParse({
      type: "comparison",
      columns: ["Tech", "A", "B"],
      rows: [{ label: "X", values: ["only-one"] }],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects unsafe code/diagram identifiers", () => {
    expect(
      ResponseBlockSchema.safeParse({
        type: "code",
        language: "js; rm -rf",
        code: "x",
      }).success,
    ).toBe(false);
    expect(
      ResponseBlockSchema.safeParse({
        type: "diagram",
        nodes: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
        edges: [{ from: "a", to: "ghost" }],
      }).success,
    ).toBe(false);
  });

  it("falls back to text on malformed JSON (never exposes raw fence)", () => {
    const raw = "Partial answer.\n```rich-ui\n{not json\n```";
    const p = parseRichContent(raw);
    expect(p.text).toBe("Partial answer.");
    expect(p.blocks).toEqual([]);
    expect(p.hadMalformed).toBe(true);
  });

  it("renders empty response safely", () => {
    const p = parseRichContent("");
    expect(p.text).toBe("");
    expect(p.blocks).toEqual([]);
  });
});

describe("rich-response grounding", () => {
  const chart = {
    type: "chart",
    chartType: "bar",
    title: "Skills",
    labels: ["Next.js proficiency", "pgvector latency"],
    values: [95, 320],
  } as const;

  it("drops numeric visualizations untraceable to context", () => {
    const { blocks } = sanitizeBlocks([chart]);
    const { blocks: kept, dropped } = dropUngroundedBlocks(
      blocks,
      "Islam likes hiking and photography.",
    );
    expect(kept).toHaveLength(0);
    expect(dropped).toBe(1);
  });

  it("keeps visualizations traceable to context", () => {
    const { blocks } = sanitizeBlocks([chart]);
    const { blocks: kept } = dropUngroundedBlocks(
      blocks,
      "Next.js proficiency is high. pgvector latency measured at 320ms.",
    );
    expect(kept).toHaveLength(1);
  });

  it("drops numeric blocks when no context is available client-side", () => {
    const { blocks } = sanitizeBlocks([
      chart,
      { type: "tech", technologies: ["React"] },
    ]);
    const { blocks: kept, dropped } = dropUngroundedBlocks(blocks, null);
    expect(kept.map((b) => b.type)).toEqual(["tech"]);
    expect(dropped).toBe(1);
  });
});

describe("rich-response streaming compatibility", () => {
  it("hides a partial (unclosed) fence during streaming", () => {
    const partial =
      "Answer so far…\n```rich-ui\n{\"blocks\": [{\"type\": \"metr";
    const p = parseRichContent(partial);
    expect(p.text).toBe("Answer so far…");
    expect(p.blocks).toEqual([]);
    expect(stripRichFenceForDisplay(partial)).toBe("Answer so far…");
  });

  it("renders visual components only when data is complete", () => {
    const partial = "Answer…\n```rich-ui\n{\"blocks\": []";
    expect(parseRichContent(partial).blocks).toEqual([]);
    const complete = withFence("Done.", JSON.stringify({ blocks: [] }));
    expect(parseRichContent(complete).blocks).toEqual([]);
    expect(parseRichContent(complete).text).toBe("Done.");
  });

  it("survives interrupted generation (fence cut mid-stream)", () => {
    const cut = "Half an answer…\n```rich-ui\n{\"blocks\":[";
    const p = parseRichContent(cut);
    expect(p.text).toBe("Half an answer…");
    expect(p.blocks).toEqual([]);
  });

  it("merges top-level and block-level follow-ups, deduplicated", () => {
    const p = parseRichContent(
      withFence(
        "Hi.",
        JSON.stringify({
          blocks: [{ type: "followups", questions: ["What projects?"] }],
          followUps: ["What projects?", "What is his timeline?"],
        }),
      ),
    );
    expect(p.blocks).toEqual([]);
    expect(p.followUps).toEqual(["What projects?", "What is his timeline?"]);
  });
});

describe("adaptive system prompt", () => {
  const prompt = buildSystemPrompt("CONTEXT");
  it("instructs single-generation rich-ui output (no second LLM call)", () => {
    expect(prompt).toContain("rich-ui");
    expect(prompt).toContain("no extra call");
  });
  it("maps intent to presentation and forbids decoration", () => {
    expect(prompt).toContain("Simple factual question");
    expect(prompt).toContain("Never decorate");
    expect(prompt).toContain("NO rich-ui block");
  });
  it("forbids fabricated metrics and arbitrary code", () => {
    expect(prompt).toContain("Never invent metrics");
    expect(prompt).toContain("never emit HTML");
  });
  it("contains no hostile/insult instructions", () => {
    expect(prompt.toLowerCase()).not.toContain("vulgar");
    expect(prompt.toLowerCase()).not.toContain("savage one-line comeback");
  });
  it("preserves grounding, voice, and image rules", () => {
    expect(prompt).toContain("first person");
    expect(prompt).toContain("source of truth");
    expect(prompt).toContain("Never invent URLs");
  });
});

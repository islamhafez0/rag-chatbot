import { describe, it, expect } from "vitest";
import {
  parseRichContent,
  sanitizeBlocks,
  dropUngroundedBlocks,
  stripRichFenceForDisplay,
  convertWideMarkdownTable,
  convertBulletRecords,
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
        }),
      ),
    );
    expect(p.text).toBe("Here is the latency breakdown.");
    expect(p.blocks).toHaveLength(1);
    expect(p.blocks[0].type).toBe("chart");
  });

  it("accepts a valid callout with default severity", () => {
    const p = parseRichContent(
      withFence(
        "Worth noting:",
        JSON.stringify({
          blocks: [{ type: "callout", content: "The **pgvector** index needs reindexing after major upgrades." }],
        }),
      ),
    );
    expect(p.blocks).toHaveLength(1);
    expect(p.blocks[0].type).toBe("callout");
    if (p.blocks[0].type === "callout") {
      expect(p.blocks[0].severity).toBeUndefined();
      expect(p.blocks[0].content).toContain("pgvector");
    }
  });

  it("rejects callouts with unknown severity", () => {
    const { blocks } = sanitizeBlocks([
      { type: "callout", severity: "hurtful", content: "x" },
    ]);
    expect(blocks).toHaveLength(0);
  });

  it("trims oversized callout content instead of dropping", () => {
    const { blocks } = sanitizeBlocks([
      { type: "callout", content: "a".repeat(900) },
    ]);
    expect(blocks).toHaveLength(1);
    if (blocks[0].type === "callout") expect(blocks[0].content).toHaveLength(800);
  });

  it("drops callouts without content but keeps sibling blocks", () => {
    const { blocks, errors } = sanitizeBlocks([
      { type: "callout", title: "Only title" },
      { type: "steps", steps: [{ title: "A" }, { title: "B" }] },
    ]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("steps");
    expect(errors.length).toBeGreaterThan(0);
  });

  it("accepts a valid steps response", () => {
    const p = parseRichContent(
      withFence(
        "To reindex:",
        JSON.stringify({
          blocks: [
            {
              type: "steps",
              title: "Reindex pgvector",
              steps: [
                { title: "Back out traffic", description: "Point the app at maintenance mode" },
                { title: "Run REINDEX", description: "CREATE INDEX CONCURRENTLY keeps serving" },
              ],
            },
          ],
        }),
      ),
    );
    expect(p.blocks).toHaveLength(1);
    if (p.blocks[0].type === "steps") {
      expect(p.blocks[0].steps).toHaveLength(2);
      expect(p.blocks[0].steps[0].title).toBe("Back out traffic");
    }
  });

  it("trims oversized step lists instead of dropping", () => {
    const steps = Array.from({ length: 20 }, (_, i) => ({ title: `Step ${i + 1}` }));
    const { blocks } = sanitizeBlocks([{ type: "steps", steps }]);
    expect(blocks).toHaveLength(1);
    if (blocks[0].type === "steps") expect(blocks[0].steps).toHaveLength(12);
  });

  it("rejects steps lists with fewer than two steps", () => {
    const { blocks } = sanitizeBlocks([
      { type: "steps", steps: [{ title: "The only step" }] },
    ]);
    expect(blocks).toHaveLength(0);
  });

  it("accepts a valid project response", () => {    const p = parseRichContent(
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

  it("renders a trailing json-fence payload as blocks (live model variant)", () => {
    const raw = "Scaling notes.\n```json\n" + JSON.stringify({ type: "steps", steps: [{ title: "A" }, { title: "B" }] }) + "\n```";
    const p = parseRichContent(raw);
    expect(p.text).toBe("Scaling notes.");
    expect(p.blocks).toHaveLength(1);
    expect(p.blocks[0].type).toBe("steps");
  });

  it("leaves ordinary json code blocks untouched", () => {
    const raw = 'Example config:\n```json\n{"scaleBy": 3}\n```';
    const p = parseRichContent(raw);
    expect(p.text).toContain("json");
    expect(p.blocks).toEqual([]);
    expect(stripRichFenceForDisplay(raw)).toBe(raw);
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

  it("drops followups blocks and top-level followUps (feature removed)", () => {
    const p = parseRichContent(
      withFence(
        "Hi.",
        JSON.stringify({
          blocks: [
            { type: "followups", questions: ["What projects?"] },
            { type: "tech", technologies: ["React"] },
          ],
          followUps: ["What projects?", "What is his timeline?"],
        }),
      ),
    );
    expect(p.text).toBe("Hi.");
    expect(p.blocks).toHaveLength(1);
    expect(p.blocks[0].type).toBe("tech");
  });
});

describe("wide markdown table fallback", () => {
  const wide = [
    "**Islam's projects**",
    "",
    "| Project | Role | Tech stack | Highlights |",
    "|---|---|---|---|",
    "| **Emdad** | Odoo Developer | Python, Odoo | Custom modules <br> Role-based pricing |",
    "| **Relief Center** | Full-stack | Odoo, OWL | 3D globe <br> OTP alerts |",
    "| **RAG Chatbot** | Solo Developer | Next.js, pgvector | Hybrid retrieval **with RRF** |",
  ].join("\n");

  it("converts a wide table into a comparison block and strips it from text", () => {
    const p = parseRichContent(wide);
    expect(p.blocks).toHaveLength(1);
    expect(p.blocks[0].type).toBe("comparison");
    if (p.blocks[0].type === "comparison") {
      expect(p.blocks[0].title).toBe("Islam's projects");
      expect(p.blocks[0].columns).toEqual(["Project", "Role", "Tech stack", "Highlights"]);
      expect(p.blocks[0].rows).toHaveLength(3);
      expect(p.blocks[0].rows[0].label).toBe("Emdad");
      expect(p.blocks[0].rows[0].values).toContain("Custom modules • Role-based pricing");
    }
    expect(p.text).not.toContain("|");
    expect(stripRichFenceForDisplay(wide)).toBe(p.text);
  });

  it("leaves narrow tables as ordinary markdown", () => {
    const narrow = [
      "| Option | Pros |",
      "|---|---|",
      "| A | Fast |",
      "| B | Cheap |",
    ].join("\n");
    const p = parseRichContent(narrow);
    expect(p.blocks).toHaveLength(0);
    expect(p.text).toContain("| Option | Pros |");
  });

  it("leaves partially streamed tables untouched", () => {
    const partial = wide + "\n| **Taqat** | Frontend";
    const p = parseRichContent(partial);
    expect(p.blocks).toHaveLength(1); // the closed table still converts
    expect(p.text).toContain("| **Taqat** | Frontend");
  });

  it("converts directly and cleans markdown artifacts from cells", () => {
    const c = convertWideMarkdownTable(wide);
    expect(c).not.toBeNull();
    if (!c) return;
    expect(c.block.rows[2].values[2]).toBe("Hybrid retrieval with RRF");
    expect(c.block.rows[2].values[0]).not.toContain("**");
  });
});

describe("bullet record fallback", () => {
  const group = (title: string, desc: string, tech: string, a: string, b: string) =>
    [
      `**${title}**`,
      `*Description*: ${desc}`,
      `*Role*: Solo Developer`,
      `*Tech stack*: ${tech}`,
      `*Highlights*: ${a}`,
      `*Impact*: ${b}`,
    ].join("\n");

  const bulletAnswer = [
    "Here's a complete list of Islam's documented projects:",
    "",
    group("Emdad", "Humanitarian storefront on Odoo 17.", "Python, Odoo 17, PostgreSQL", "Custom modules", "Efficient aid distribution"),
    "",
    group("RAG Chatbot", "Retrieval-augmented chatbot over YAML files.", "Next.js, pgvector, TypeScript", "Hybrid retrieval with RRF", "recall@8 0.904"),
    "",
    group("Relief Center", "Disaster-response platform on a 3D globe.", "Odoo, OWL, JavaScript", "Live data ingestion into Odoo ORM", "Real-time disaster visibility"),
  ].join("\n");

  it("converts 3+ bullet record paragraphs into project blocks", () => {
    const p = parseRichContent(bulletAnswer);
    expect(p.blocks).toHaveLength(3);
    expect(p.blocks.every((b) => b.type === "project")).toBe(true);
    if (p.blocks[0].type === "project") {
      expect(p.blocks[0].title).toBe("Emdad");
      expect(p.blocks[0].technologies).toContain("Odoo 17");
      expect(p.blocks[0].highlights).toContain("Custom modules");
    }
    expect(p.text).not.toContain("**Emdad**");
    expect(p.text).toContain("Here's a complete list");
    expect(stripRichFenceForDisplay(bulletAnswer)).toBe(p.text);
  });

  it("keeps fewer than three groups as plain markdown", () => {
    const two = [
      group("Emdad", "Humanitarian storefront.", "Python, Odoo", "Custom modules", "Aid distribution"),
      "",
      group("RAG Chatbot", "Chatbot over YAML.", "Next.js, pgvector", "Hybrid retrieval", "recall@8 0.9"),
    ].join("\n");
    const p = parseRichContent(two);
    expect(p.blocks).toHaveLength(0);
    expect(p.text).toContain("**Emdad**");
  });

  it("does not convert feedback or steps prose", () => {
    const feedback = [
      "**Ahmed** — Feedback:",
      "- What a great developer!",
      "",
      "**Sara** — Feedback:",
      "- Says he works well under pressure.",
      "",
      "**Omar** — Feedback:",
      "- Great communicator.",
    ].join("\n");
    expect(convertBulletRecords(feedback)).toBeNull();
    const p = parseRichContent(feedback);
    expect(p.blocks).toHaveLength(0);
  });
});

describe("adaptive system prompt", () => {
  const prompt = buildSystemPrompt("CONTEXT");
  it("instructs single-generation rich-ui output (no second LLM call)", () => {
    expect(prompt).toContain("rich-ui");
    expect(prompt).toContain("at most one rich-ui fenced block per response");
  });
  it("maps evidence shape to presentation and forbids decoration", () => {
    expect(prompt).toContain("Shape-driven visual selection");
    expect(prompt).toContain("Do not emit empty, redundant, or decorative visuals");
    expect(prompt).toContain("answer in Markdown without a visual");
  });
  it("maps procedures to steps and highlights to callouts", () => {
    expect(prompt).toContain('"type":"steps"');
    expect(prompt).toContain('"type":"callout"');
    expect(prompt).toContain("A sequence of actions the reader would follow");
  });
  it("selects blocks dynamically without user rendering hints", () => {
    expect(prompt).toContain("Users will not tell you how to render an answer");
    expect(prompt).toContain("Never flatten 3+ attribute-bearing records into one wide Markdown table");
    expect(prompt).toContain("A record count of 3 or more of the same kind is a strong signal");
  });
  it("keeps simple questions concise and grounds component data", () => {
    expect(prompt).toContain("Simple questions receive a concise Markdown answer");
    expect(prompt).toContain("Never invent facts, metrics, evidence, or achievements to fill a visual");
  });
  it("forbids fabricated metrics and arbitrary code", () => {
    expect(prompt).toContain("Never invent data to populate a visual");
    expect(prompt).toContain("Never emit HTML tags");
  });
  it("contains no hostile/insult instructions", () => {
    expect(prompt.toLowerCase()).not.toContain("vulgar");
    expect(prompt.toLowerCase()).not.toContain("savage one-line comeback");
  });
  it("preserves grounding, voice, and image rules", () => {
    expect(prompt).toContain("first person");
    expect(prompt).toContain("source of truth");
    expect(prompt).toContain("Never invent, modify, or guess image URLs");
  });
  it("forbids bare JSON outside the fence", () => {
    expect(prompt).toContain("without the fence it renders");
  });
  it("forbids suggested follow-up questions", () => {
    expect(prompt).toContain("Never append suggested follow-up questions");
  });
  it("forbids repeating block contents in prose", () => {
    expect(prompt).toContain("do not duplicate its contents in the introduction");
  });
  it("forbids HTML tags in answers", () => {
    expect(prompt).toContain("Never emit HTML tags");
  });
});

describe("bare-JSON fallback (issue #37)", () => {
  const projectPayload = JSON.stringify({
    blocks: [
      {
        type: "project",
        title: "Apiary and Honey",
        description: "A bilingual Odoo and Python application.",
        technologies: ["Odoo", "Python"],
        highlights: ["235 commits"],
      },
    ],
  });

  it("renders a trailing bare blocks payload instead of leaking raw JSON", () => {
    const p = parseRichContent(`Here are my projects:\n\n${projectPayload}`);
    expect(p.text).toBe("Here are my projects:");
    expect(p.blocks).toHaveLength(1);
    expect(p.blocks[0].type).toBe("project");
    expect(p.hadMalformed).toBe(false);
  });

  it("renders a bare single-block object without a fence", () => {
    const p = parseRichContent(
      `My timeline:\n\n${JSON.stringify({ type: "timeline", events: [{ date: "2024", title: "Dev", description: "ERP work" }] })}`,
    );
    expect(p.text).toBe("My timeline:");
    expect(p.blocks).toHaveLength(1);
    expect(p.blocks[0].type).toBe("timeline");
  });

  it("leaves ordinary prose with braces untouched", () => {
    const prose = "Use { brackets } sparingly in config {name: value} notes.";
    const p = parseRichContent(prose);
    expect(p.text).toBe(prose);
    expect(p.blocks).toEqual([]);
  });

  it("leaves invalid trailing JSON untouched", () => {
    const raw = "Almost.\n{not json at all}";
    const p = parseRichContent(raw);
    expect(p.text).toBe(raw);
    expect(p.blocks).toEqual([]);
  });

  it("strips bare payloads in the display helper too", () => {
    expect(stripRichFenceForDisplay(`Intro.\n\n${projectPayload}`)).toBe("Intro.");
  });
});

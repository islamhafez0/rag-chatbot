import { describe, it, expect } from "vitest";
import {
  parseRichContent,
  sanitizeBlocks,
  dropUngroundedBlocks,
  stripRichFenceForDisplay,
  ResponseBlockSchema,
  isSafeUrl,
  toHistoryContent,
  summarizeBlocks,
  toRequestMessages,
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

describe("adaptive system prompt", () => {
  const prompt = buildSystemPrompt("CONTEXT");
  it("instructs single-generation rich-ui output (no second LLM call)", () => {
    expect(prompt).toContain("rich-ui");
    expect(prompt).toContain("no extra call");
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

const proj = (extra: Record<string, unknown> = {}) => ({
  type: "project",
  title: "RAG Chatbot",
  description: "A RAG chatbot over my career knowledge base.",
  technologies: ["Next.js", "pgvector"],
  highlights: ["Hybrid retrieval"],
  ...extra,
});
const payload = (...blocks: unknown[]) => JSON.stringify({ blocks });

describe("wire tolerance (json fences, double fences, bare payloads)", () => {
  it("accepts a ```json fence carrying a blocks payload", () => {
    const p = parseRichContent(`I built this.\n\n\`\`\`json\n${payload(proj())}\n\`\`\``);
    expect(p.text).toBe("I built this.");
    expect(p.blocks).toHaveLength(1);
    expect(p.text).not.toContain("{");
  });

  it("leaves an ordinary ```json code sample in the prose", () => {
    const md = 'Config:\n```json\n{"port": 3000}\n```';
    const p = parseRichContent(md);
    expect(p.text).toBe(md);
    expect(p.blocks).toEqual([]);
  });

  it("merges two fences and dedupes a repeated block", () => {
    const tech = { type: "tech", technologies: ["React"] };
    const md = `Answer.\n\`\`\`rich-ui\n${payload(proj(), tech)}\n\`\`\`\n\`\`\`json\n${payload(tech)}\n\`\`\``;
    const p = parseRichContent(md);
    expect(p.text).toBe("Answer.");
    expect(p.blocks.map((b) => b.type)).toEqual(["project", "tech"]);
  });

  it("keeps prose written after the fence", () => {
    const p = parseRichContent(`Before.\n\`\`\`rich-ui\n${payload(proj())}\n\`\`\`\nAfter.`);
    expect(p.text).toBe("Before.\n\nAfter.");
  });

  it("tolerates trailing commas in the payload", () => {
    const p = parseRichContent('Hi.\n```rich-ui\n{"blocks":[{"type":"tech","technologies":["React",],},]}\n```');
    expect(p.blocks).toHaveLength(1);
  });

  it("never returns raw blocks JSON as prose, even when invalid", () => {
    const md = 'Hi.\n```json\n{"blocks":[{"type":"nope"}]}\n```';
    const p = parseRichContent(md);
    expect(p.text).toBe("Hi.");
    expect(p.blocks).toEqual([]);
  });
});

describe("streaming prefixes", () => {
  const full = `I shipped these.\n\n\`\`\`rich-ui\n${payload(proj(), proj({ title: "Other" }))}\n\`\`\``;

  it("never shows backticks or JSON at any cut point", () => {
    for (let i = 1; i <= full.length; i++) {
      const p = parseRichContent(full.slice(0, i));
      expect(p.text).not.toMatch(/`|\{"|"blocks"/);
    }
  });

  it("reports a pending visual with its block type while the fence is open", () => {
    const cut = full.slice(0, full.indexOf("Hybrid"));
    const p = parseRichContent(cut);
    expect(p.text).toBe("I shipped these.");
    expect(p.pending).toEqual({ type: "project", count: 1 });
    expect(parseRichContent(full).pending).toBeNull();
  });

  it("hides a ```json opener mid-stream", () => {
    expect(parseRichContent("Answer.\n```js").text).toBe("Answer.");
    expect(parseRichContent("Answer.\n```json\n{\"bl").text).toBe("Answer.");
    expect(parseRichContent("Answer.\n``").text).toBe("Answer.");
  });

  it("hides an unfenced payload while it streams", () => {
    const p = parseRichContent('Answer.\n\n{"blocks":[{"type":"timeline","events":[');
    expect(p.text).toBe("Answer.");
    expect(p.pending?.type).toBe("timeline");
    expect(parseRichContent('Answer.\n\n{"bl').text).toBe("Answer.");
  });

  it("does not swallow a normal code block being streamed", () => {
    const p = parseRichContent("Run:\n```bash\nnpm install");
    expect(p.text).toContain("npm install");
    expect(p.pending).toBeNull();
  });
});

describe("per-field validation", () => {
  it("drops a bad url but keeps the project", () => {
    const { blocks } = sanitizeBlocks([proj({ url: "github.com/x" })]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type === "project" && blocks[0].url).toBeFalsy();
  });

  it("drops a bad link item but keeps the good ones", () => {
    const { blocks } = sanitizeBlocks([
      proj({
        links: [
          { label: "GitHub", url: "https://github.com/islamhafez0/x" },
          { label: "Bad", url: "javascript:alert(1)" },
          { label: "CV", url: "/files/cv.pdf" },
        ],
      }),
    ]);
    const b = blocks[0];
    expect(b.type === "project" && b.links?.map((l) => l.label)).toEqual(["GitHub", "CV"]);
  });

  it("drops one bad timeline event, not the timeline", () => {
    const { blocks } = sanitizeBlocks([
      { type: "timeline", events: [{ date: "2024", title: "" }, { date: "2023", title: "Odoo" }] },
    ]);
    expect(blocks[0].type === "timeline" && blocks[0].events).toHaveLength(1);
  });

  it("truncates over-long strings and wraps a lone string into an array", () => {
    const { blocks } = sanitizeBlocks([
      proj({ title: "T".repeat(300), highlights: "Single highlight" }),
    ]);
    const b = blocks[0];
    expect(b.type === "project" && b.title.length).toBe(120);
    expect(b.type === "project" && b.highlights).toEqual(["Single highlight"]);
  });

  it("pads short comparison rows instead of dropping the table", () => {
    const ok = sanitizeBlocks([
      { type: "comparison", columns: ["Aspect", "A", "B"], rows: [{ label: "X", values: ["1"] }] },
    ]);
    expect(ok.blocks[0].type === "comparison" && ok.blocks[0].rows[0].values).toEqual(["1", "—"]);
  });

  it("drops dangling diagram edges but keeps the diagram", () => {
    const { blocks } = sanitizeBlocks([
      {
        type: "diagram",
        nodes: [{ id: "a", label: "A" }, { id: "b", label: "B" }],
        edges: [{ from: "a", to: "b" }, { from: "a", to: "ghost" }],
      },
    ]);
    expect(blocks[0].type === "diagram" && blocks[0].edges).toHaveLength(1);
  });
});

describe("link safety", () => {
  it("allows https and site-relative only", () => {
    expect(isSafeUrl("https://github.com/islamhafez0")).toBe(true);
    expect(isSafeUrl("/files/islam-hafez-frontend.pdf")).toBe(true);
    expect(isSafeUrl("http://example.com")).toBe(false);
    expect(isSafeUrl("github.com/x")).toBe(false);
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("//evil.com/x")).toBe(false);
    expect(isSafeUrl("https://localhost")).toBe(false);
  });
});

describe("history stripping", () => {
  it("sends prose plus a short visual note, never the fence", () => {
    const md = `I built two things.\n\`\`\`rich-ui\n${payload(proj(), proj({ title: "B" }), { type: "timeline", events: [{ title: "X" }] })}\n\`\`\``;
    const h = toHistoryContent(md);
    expect(h).toBe("I built two things.\n\n[visual: 2 project cards, 1 timeline]");
    expect(h).not.toContain("```");
  });

  it("caps long answers under the server limit", () => {
    const long = "word ".repeat(1000) + `\n\`\`\`rich-ui\n${payload(proj())}\n\`\`\``;
    const h = toHistoryContent(long);
    expect(h.length).toBeLessThanOrEqual(1800);
    expect(h).toContain("[visual: 1 project card]");
  });

  it("leaves plain answers alone", () => {
    expect(toHistoryContent("Just prose.")).toBe("Just prose.");
    expect(summarizeBlocks([])).toBe("");
  });
});

describe("request payload", () => {
  it("strips visuals from assistant turns and drops empty ones", () => {
    const fence = `\n\`\`\`rich-ui\n${payload(proj())}\n\`\`\``;
    const out = toRequestMessages([
      { role: "user", content: "Projects?" },
      { role: "assistant", content: `Here.${fence}` },
      { role: "user", content: "More?" },
      { role: "assistant", content: "" },
      { role: "user", content: "Again" },
    ]);
    expect(out).toEqual([
      { role: "user", content: "Projects?" },
      { role: "assistant", content: "Here.\n\n[visual: 1 project card]" },
      { role: "user", content: "More?" },
      { role: "user", content: "Again" },
    ]);
    expect(out.every((m) => m.content.length <= 2000)).toBe(true);
  });

  it("trims the oldest turns to fit count and size caps, opening on a user turn", () => {
    const msgs = Array.from({ length: 40 }, (_, i) => ({
      role: i % 2 ? "assistant" : "user",
      content: `${i} ${"x".repeat(900)}`,
    }));
    const out = toRequestMessages(msgs);
    expect(out.length).toBeLessThanOrEqual(24);
    expect(out.reduce((n, m) => n + m.content.length, 0)).toBeLessThanOrEqual(11000);
    expect(out[0].role).toBe("user");
    expect(out[out.length - 1].content.startsWith("39")).toBe(true);
  });
});

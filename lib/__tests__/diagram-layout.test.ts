import { describe, it, expect } from "vitest";
import { layoutDiagram, wrapLabel } from "../../components/chat/diagram-layout";
import { techColor } from "../../components/chat/tech-color";
import { projectLinks } from "../../components/chat/project-links";

const n = (id: string, label = id.toUpperCase()) => ({ id, label });

describe("layoutDiagram", () => {
  it("layers a DAG by longest path and keeps one path per real edge", () => {
    const L = layoutDiagram(
      [n("q", "User question"), n("embed", "Embed"), n("search", "Vector search"), n("kw", "Keyword"), n("llm", "LLM")],
      [
        { from: "q", to: "embed" },
        { from: "q", to: "kw" },
        { from: "embed", to: "search" },
        { from: "search", to: "llm", label: "top-k" },
        { from: "kw", to: "llm" },
      ],
    );
    const layer = Object.fromEntries(L.nodes.map((x) => [x.id, x.layer]));
    expect(layer).toEqual({ q: 0, embed: 1, kw: 1, search: 2, llm: 3 });
    expect(L.edges).toHaveLength(5);
    expect(L.edges.every((e) => !e.back)).toBe(true);
    expect(L.nodes.find((x) => x.id === "q")!.lines).toEqual(["User question"]);
    // Nodes in the same layer never overlap.
    const l1 = L.nodes.filter((x) => x.layer === 1).sort((a, b) => a.x - b.x);
    expect(l1[1].x).toBeGreaterThanOrEqual(l1[0].x + l1[0].w);
  });

  it("survives cycles by routing the back edge around the side", () => {
    const L = layoutDiagram([n("a"), n("b"), n("c")], [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
      { from: "c", to: "a" },
    ]);
    expect(L.layers).toBe(3);
    expect(L.edges.filter((e) => e.back)).toHaveLength(1);
  });

  it("puts edge-less nodes on one row and ignores dangling edges", () => {
    const L = layoutDiagram([n("a"), n("b")], [{ from: "a", to: "zzz" }]);
    expect(L.layers).toBe(1);
    expect(L.edges).toHaveLength(0);
  });

  it("wraps long labels to at most three lines", () => {
    const lines = wrapLabel("Hybrid retrieval with pgvector cosine similarity and keyword boosting for recall");
    expect(lines.length).toBe(3);
    expect(lines[2].endsWith("…")).toBe(true);
  });
});

describe("techColor", () => {
  it("does not colour by the 'ai' substring", () => {
    expect(techColor("Tailwind CSS")).toContain("violet");
    expect(techColor("Email")).toContain("bg-muted");
    expect(techColor("Storage")).toContain("bg-muted");
    expect(techColor("AI")).toContain("amber");
    expect(techColor("RAG")).toContain("amber");
    expect(techColor("Digital marketing")).toContain("bg-muted");
  });
});

describe("projectLinks", () => {
  it("types and dedupes links", () => {
    const links = projectLinks({
      url: "https://github.com/islamhafez0/rag",
      links: [
        { label: "Source", url: "https://github.com/islamhafez0/rag/" },
        { label: "Live", url: "https://islamhafez.vercel.app" },
        { label: "Odoo Apps", url: "https://apps.odoo.com/apps/x" },
        { label: "Google Play", url: "https://play.google.com/store/apps/details?id=x" },
      ],
    });
    expect(links.map((l) => l.kind)).toEqual(["github", "live", "live", "store"]);
  });
});

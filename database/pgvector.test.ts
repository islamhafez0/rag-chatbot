import { describe, it, expect, vi, beforeEach } from "vitest";

const mockQuery = vi.hoisted(() => vi.fn());

vi.mock("pg", () => ({
  Pool: class {
    query = mockQuery;
  },
}));

vi.mock("@langchain/google-genai", () => ({
  GoogleGenerativeAIEmbeddings: class {
    async embedQuery() {
      return [0.1, 0.2, 0.3];
    }
  },
}));

async function loadPgvector() {
  return await import("./pgvector");
}

function tableSetupRows() {
  return { rows: [{ cnt: "200" }] };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  // Default: table setup queries succeed; targeted per-test via mockImplementation.
  mockQuery.mockImplementation(async (sql: string) => {
    if (typeof sql === "string" && (sql.includes("CREATE") || sql.includes("count(*)"))) {
      return tableSetupRows();
    }
    return { rows: [] };
  });
});

describe("getContext (pgvector runtime)", () => {
  it("returns text and sources from vector search results", async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (typeof sql === "string" && (sql.includes("CREATE") || sql.includes("count(*)"))) {
        return tableSetupRows();
      }
      return {
        rows: [
          { text: "RAG chatbot chunk", source: "projects/rag-chatbot.yml" },
          { text: "Skills chunk", source: "facts/skills.yml" },
        ],
      };
    });

    const { getContext } = await loadPgvector();
    const result = await getContext("What projects has Islam built?");

    expect(result.text).toBe("RAG chatbot chunk\n\nSkills chunk");
    expect(result.sources).toEqual(["projects/rag-chatbot.yml", "facts/skills.yml"]);
  });

  it("deduplicates sources", async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (typeof sql === "string" && (sql.includes("CREATE") || sql.includes("count(*)"))) {
        return tableSetupRows();
      }
      return { rows: [{ text: "a", source: "x.yml" }, { text: "b", source: "x.yml" }] };
    });

    const { getContext } = await loadPgvector();
    const result = await getContext("query");
    expect(result.sources).toEqual(["x.yml"]);
  });

  it("applies the category filter", async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (typeof sql === "string" && (sql.includes("CREATE") || sql.includes("count(*)"))) {
        return tableSetupRows();
      }
      return { rows: [{ text: "a", source: "projects/a.yml" }, { text: "b", source: "projects/b.yml" }] };
    });

    const { getContext } = await loadPgvector();
    await getContext("query", { category: "projects", vector: [0.1, 0.2, 0.3] });

    const dataCall = mockQuery.mock.calls.find(([sql]) =>
      typeof sql === "string" && sql.includes("LIMIT $2")
    );
    expect(dataCall?.[0]).toContain("WHERE category");
    expect(dataCall?.[1]).toContain("projects");
  });

  it("retries without the category filter when it returns too few results", async () => {
    const dataCalls: unknown[][] = [];
    mockQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (typeof sql === "string" && (sql.includes("CREATE") || sql.includes("count(*)"))) {
        return tableSetupRows();
      }
      dataCalls.push([sql, params]);
      if (dataCalls.length === 1) {
        return { rows: [{ text: "only one", source: "roles/current.yml" }] };
      }
      return {
        rows: [
          { text: "only one", source: "roles/current.yml" },
          { text: "more context", source: "facts/profile.yml" },
        ],
      };
    });

    const { getContext } = await loadPgvector();
    const result = await getContext("What is his experience timeline?", { category: "roles" });

    expect(dataCalls.length).toBe(2);
    expect(result.sources).toEqual(["roles/current.yml", "facts/profile.yml"]);
  });
});

describe("getCategoryVectors", () => {
  it("groups documents by category", async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (typeof sql === "string" && sql.includes("SELECT category")) {
        return {
          rows: [
            { category: "roles", embedding: "[1,0]" },
            { category: "roles", embedding: "[0.9,0]" },
            { category: "projects", embedding: "[0,1]" },
          ],
        };
      }
      if (typeof sql === "string" && (sql.includes("CREATE") || sql.includes("count(*)"))) {
        return tableSetupRows();
      }
      return { rows: [] };
    });

    const { getCategoryVectors } = await loadPgvector();
    const result = await getCategoryVectors();

    expect(result).toEqual([
      { category: "roles", vectors: [[1, 0], [0.9, 0]] },
      { category: "projects", vectors: [[0, 1]] },
    ]);
  });
});

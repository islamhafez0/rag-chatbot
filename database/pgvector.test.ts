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
      if (typeof sql === "string" && sql.includes("pg_indexes")) {
        return { rows: [] };
      }
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
      if (typeof sql === "string" && sql.includes("pg_indexes")) {
        return { rows: [] };
      }
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
      if (typeof sql === "string" && sql.includes("pg_indexes")) {
        return { rows: [] };
      }
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
      if (typeof sql === "string" && sql.includes("pg_indexes")) {
        return { rows: [] };
      }
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

describe("ensureTable index handling (3072-dim)", () => {
  function baseMock(docRows: { text: string; source: string }[]) {
    return async (sql: string) => {
      if (typeof sql === "string" && sql.includes("pg_indexes")) {
        return { rows: [] };
      }
      if (typeof sql === "string" && sql.includes("CREATE")) {
        return tableSetupRows();
      }
      if (typeof sql === "string" && sql.includes("LIMIT $2")) {
        return { rows: docRows };
      }
      return { rows: [] };
    };
  }

  it("never creates an ANN index on the 3072-dim column", async () => {
    mockQuery.mockImplementation(
      baseMock([{ text: "a", source: "s.yml" }, { text: "b", source: "s.yml" }])
    );

    const { getContext } = await loadPgvector();
    await getContext("query", { vector: [0.1, 0.2, 0.3] });

    const indexCalls = mockQuery.mock.calls.filter(
      ([sql]) => typeof sql === "string" && /ivfflat|hnsw/i.test(sql)
    );
    expect(indexCalls).toEqual([]);
  });

  it("drops a legacy ivfflat index left by earlier revisions", async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (typeof sql === "string" && sql.includes("pg_indexes")) {
        return {
          rows: [{ indexdef: "CREATE INDEX idx_career_vectors_embedding ON career_vectors USING ivfflat (embedding vector_cosine_ops)" }],
        };
      }
      if (typeof sql === "string" && sql.includes("CREATE")) {
        return tableSetupRows();
      }
      if (typeof sql === "string" && sql.includes("LIMIT $2")) {
        return { rows: [{ text: "a", source: "s.yml" }, { text: "b", source: "s.yml" }] };
      }
      return { rows: [] };
    });

    const { getContext } = await loadPgvector();
    await getContext("query", { vector: [0.1, 0.2, 0.3] });

    const dropCalls = mockQuery.mock.calls.filter(
      ([sql]) => typeof sql === "string" && sql.includes("DROP INDEX")
    );
    expect(dropCalls.length).toBe(1);
    expect(dropCalls[0][0]).toContain("idx_career_vectors_embedding");
  });

  it("keeps a non-ivfflat index untouched", async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (typeof sql === "string" && sql.includes("pg_indexes")) {
        return {
          rows: [{ indexdef: "CREATE INDEX idx_career_vectors_embedding ON career_vectors USING hnsw (embedding vector_cosine_ops)" }],
        };
      }
      return baseMock([{ text: "a", source: "s.yml" }, { text: "b", source: "s.yml" }])(sql);
    });

    const { getContext } = await loadPgvector();
    await getContext("query", { vector: [0.1, 0.2, 0.3] });

    const dropCalls = mockQuery.mock.calls.filter(
      ([sql]) => typeof sql === "string" && sql.includes("DROP INDEX")
    );
    expect(dropCalls).toEqual([]);
  });
});
describe("per-source diversity cap", () => {
  it("caps chunks per source and backfills from lower ranks", async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (typeof sql === "string" && sql.includes("pg_indexes")) {
        return { rows: [] };
      }
      if (typeof sql === "string" && sql.includes("CREATE")) {
        return tableSetupRows();
      }
      return {
        rows: [
          { text: "p1", source: "photos.yml" },
          { text: "p2", source: "photos.yml" },
          { text: "p3", source: "photos.yml" },
          { text: "p4", source: "photos.yml" },
          { text: "role", source: "roles/previous.yml" },
          { text: "skill", source: "facts/skills.yml" },
        ],
      };
    });

    const { getContext } = await loadPgvector();
    const result = await getContext("query", { limit: 4, vector: [0.1, 0.2, 0.3] });

    // 3 photo chunks max, 4th slot backfilled with the roles chunk.
    expect(result.text).toBe("p1\n\np2\n\np3\n\nrole");
    expect(result.sources).toEqual(["photos.yml", "roles/previous.yml"]);
  });

  it("fetches extra candidates to allow backfill", async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (typeof sql === "string" && sql.includes("pg_indexes")) {
        return { rows: [] };
      }
      if (typeof sql === "string" && sql.includes("CREATE")) {
        return tableSetupRows();
      }
      return { rows: [] };
    });

    const { getContext } = await loadPgvector();
    await getContext("query", { limit: 4, vector: [0.1, 0.2, 0.3] });

    const dataCall = mockQuery.mock.calls.find(
      ([sql]) => typeof sql === "string" && sql.includes("LIMIT $2")
    );
    // fetchLimit = limit * 3
    expect(dataCall?.[1]).toContain(12);
  });
});

describe("hybrid SQL shape (no dupes, deterministic)", () => {
  it("fuses with FULL OUTER JOIN, single score, id tiebreak", async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (typeof sql === "string" && sql.includes("pg_indexes")) {
        return { rows: [] };
      }
      if (typeof sql === "string" && sql.includes("CREATE")) {
        return tableSetupRows();
      }
      return { rows: [{ text: "a", source: "s.yml" }, { text: "b", source: "s.yml" }] };
    });

    const { getContext } = await loadPgvector();
    await getContext("rag chatbot", {
      search: "hybrid",
      limit: 3,
      vector: [0.1, 0.2, 0.3],
    });

    const hybridCall = mockQuery.mock.calls.find(
      ([sql]) => typeof sql === "string" && sql.includes("combined")
    );
    const sql = String(hybridCall?.[0] ?? "");
    expect(sql).toContain("FULL OUTER JOIN");
    expect(sql).toContain("USING (id)");
    expect(sql).not.toContain("UNION ALL");
    expect(sql).toContain("combined.id ASC");
  });
});

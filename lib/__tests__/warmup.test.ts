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

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  mockQuery.mockImplementation(async (sql: string) => {
    if (typeof sql === "string" && sql.includes("pg_indexes")) return { rows: [] };
    return { rows: [] };
  });
});

describe("cold-start warmup (#35)", () => {
  it("reuses a single LLM client instead of constructing per request", async () => {
    const { getClient, __resetClientCacheForTests } = await import("../generate");
    __resetClientCacheForTests();
    const a = getClient();
    const b = getClient();
    expect(a).toBe(b);
    __resetClientCacheForTests();
    expect(getClient()).not.toBe(a);
  });

  it("warmupRetrieval runs DDL once then only pings on repeat calls", async () => {
    const { warmupRetrieval } = await import("../../database/pgvector");
    await warmupRetrieval();
    await warmupRetrieval();

    const ddlCalls = mockQuery.mock.calls.filter(([sql]) =>
      typeof sql === "string" && sql.includes("CREATE"),
    );
    const pingCalls = mockQuery.mock.calls.filter(([sql]) =>
      typeof sql === "string" && sql.includes("SELECT 1"),
    );
    // ensureTable gate: DDL runs on first warmup only.
    expect(ddlCalls.length).toBeGreaterThan(0);
    expect(pingCalls.length).toBe(2);
  });
});

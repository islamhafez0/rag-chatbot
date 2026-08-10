import { describe, it, expect, vi, beforeEach } from "vitest";

const fakeCollection = vi.hoisted(() => ({
  findAndRerank: vi.fn(),
  find: vi.fn(),
}));

const fakeDb = vi.hoisted(() => ({
  listCollections: vi.fn(),
}));

vi.mock("@datastax/astra-db-ts", () => ({
  DataAPIClient: class {
    db() {
      return {
        collection: () => fakeCollection,
        listCollections: fakeDb.listCollections,
      };
    }
  },
}));

vi.mock("@langchain/google-genai", () => ({
  GoogleGenerativeAIEmbeddings: class {
    async embedQuery() {
      return [0.1, 0.2, 0.3];
    }
  },
}));

process.env.ASTRA_DB_API_ENDPOINT = "https://example.apps.astra.datastax.com";
process.env.ASTRA_DB_APPLICATION_TOKEN = "token";
process.env.ASTRA_DB_NAMESPACE = "default_keyspace";
process.env.ASTRA_DB_COLLECTION = "career_vectors";
process.env.GOOGLE_API_KEY = "google-key";

const VECTOR = [0.1, 0.2, 0.3];

async function loadAstra() {
  return await import("../astra");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  fakeDb.listCollections.mockResolvedValue(["career_vectors"]);
});

describe("getContext", () => {
  it("returns text and sources from hybrid rerank results", async () => {
    fakeCollection.findAndRerank.mockReturnValue({
      toArray: async () => [
        { document: { text: "RAG chatbot chunk", source: "projects/rag-chatbot.yml" }, scores: {} },
        { document: { text: "Skills chunk", source: "facts/skills.yml" }, scores: {} },
      ],
    });

    const { getContext } = await loadAstra();
    const result = await getContext("What projects has Islam built?");

    expect(fakeCollection.findAndRerank).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        sort: { $hybrid: { $vector: VECTOR, $lexical: "What projects has Islam built?" } },
        limit: 5,
        includeScores: true,
        rerankOn: "$lexical",
        rerankQuery: "What projects has Islam built?",
      })
    );
    expect(fakeCollection.find).not.toHaveBeenCalled();
    expect(result.text).toBe("RAG chatbot chunk\n\nSkills chunk");
    expect(result.sources).toEqual(["projects/rag-chatbot.yml", "facts/skills.yml"]);
  });

  it("deduplicates sources", async () => {
    fakeCollection.findAndRerank.mockReturnValue({
      toArray: async () => [
        { document: { text: "a", source: "x.yml" }, scores: {} },
        { document: { text: "b", source: "x.yml" }, scores: {} },
      ],
    });

    const { getContext } = await loadAstra();
    const result = await getContext("query");
    expect(result.sources).toEqual(["x.yml"]);
  });

  it("applies the category filter", async () => {
    fakeCollection.findAndRerank.mockReturnValue({ toArray: async () => [] });

    const { getContext } = await loadAstra();
    await getContext("query", { category: "projects" });

    expect(fakeCollection.findAndRerank).toHaveBeenCalledWith(
      { category: "projects" },
      expect.anything()
    );
  });

  it("falls back to vector-only search when reranking is unavailable", async () => {
    fakeCollection.findAndRerank.mockImplementation(() => {
      throw new Error("reranking not configured");
    });
    fakeCollection.find.mockReturnValue({
      toArray: async () => [
        { _id: "1", text: "vector result", source: "facts/profile.yml" },
      ],
    });

    const { getContext } = await loadAstra();
    const result = await getContext("What skills?");

    expect(fakeCollection.find).toHaveBeenCalledWith(
      {},
      { sort: { $vector: VECTOR }, limit: 5, includeSimilarity: true }
    );
    expect(result.text).toBe("vector result");
    expect(result.sources).toEqual(["facts/profile.yml"]);
  });

  it("returns empty context when the collection does not exist", async () => {
    fakeDb.listCollections.mockResolvedValue([]);

    const { getContext } = await loadAstra();
    const result = await getContext("anything");

    expect(result).toEqual({ text: "", sources: [] });
    expect(fakeCollection.findAndRerank).not.toHaveBeenCalled();
  });
});

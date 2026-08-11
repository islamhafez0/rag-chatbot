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
  it("returns text and sources from vector search results", async () => {
    fakeCollection.find.mockReturnValue({
      toArray: async () => [
        { _id: "1", text: "RAG chatbot chunk", source: "projects/rag-chatbot.yml" },
        { _id: "2", text: "Skills chunk", source: "facts/skills.yml" },
      ],
    });

    const { getContext } = await loadAstra();
    const result = await getContext("What projects has Islam built?");

    expect(fakeCollection.find).toHaveBeenCalledWith(
      {},
      { sort: { $vector: VECTOR }, limit: 8, includeSimilarity: true }
    );
    expect(fakeCollection.findAndRerank).not.toHaveBeenCalled();
    expect(result.text).toBe("RAG chatbot chunk\n\nSkills chunk");
    expect(result.sources).toEqual(["projects/rag-chatbot.yml", "facts/skills.yml"]);
  });

  it("deduplicates sources", async () => {
    fakeCollection.find.mockReturnValue({
      toArray: async () => [
        { _id: "1", text: "a", source: "x.yml" },
        { _id: "2", text: "b", source: "x.yml" },
      ],
    });

    const { getContext } = await loadAstra();
    const result = await getContext("query");
    expect(result.sources).toEqual(["x.yml"]);
  });

  it("applies the category filter", async () => {
    fakeCollection.find.mockReturnValue({ toArray: async () => [] });

    const { getContext } = await loadAstra();
    await getContext("query", { category: "projects" });

    expect(fakeCollection.find).toHaveBeenCalledWith(
      { category: "projects" },
      expect.anything()
    );
  });

  it("uses hybrid+rerank when search is explicitly set to hybrid", async () => {
    fakeCollection.findAndRerank.mockReturnValue({
      toArray: async () => [
        { document: { text: "RAG chatbot chunk", source: "projects/rag-chatbot.yml" }, scores: {} },
        { document: { text: "Skills chunk", source: "facts/skills.yml" }, scores: {} },
      ],
    });

    const { getContext } = await loadAstra();
    const result = await getContext("What projects has Islam built?", { search: "hybrid" });

    expect(fakeCollection.findAndRerank).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        sort: { $hybrid: { $vector: VECTOR, $lexical: "What projects has Islam built?" } },
        limit: 8,
        includeScores: true,
        rerankOn: "$lexical",
        rerankQuery: "What projects has Islam built?",
      })
    );
    expect(fakeCollection.find).not.toHaveBeenCalled();
    expect(result.text).toBe("RAG chatbot chunk\n\nSkills chunk");
    expect(result.sources).toEqual(["projects/rag-chatbot.yml", "facts/skills.yml"]);
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
    const result = await getContext("What skills?", { search: "hybrid" });

    expect(fakeCollection.find).toHaveBeenCalledWith(
      {},
      { sort: { $vector: VECTOR }, limit: 8, includeSimilarity: true }
    );
    expect(result.text).toBe("vector result");
    expect(result.sources).toEqual(["facts/profile.yml"]);
  });

  it("retries without the category filter when it returns too few results", async () => {
    fakeCollection.find
      .mockReturnValueOnce({
        toArray: async () => [
          { _id: "1", text: "only one", source: "roles/current.yml" },
        ],
      })
      .mockReturnValueOnce({
        toArray: async () => [
          { _id: "1", text: "only one", source: "roles/current.yml" },
          { _id: "2", text: "more context", source: "facts/profile.yml" },
        ],
      });

    const { getContext } = await loadAstra();
    const result = await getContext("What is his experience timeline?", { category: "roles" });

    expect(fakeCollection.find).toHaveBeenCalledTimes(2);
    expect(fakeCollection.find).toHaveBeenLastCalledWith(
      {},
      expect.anything()
    );
    expect(result.sources).toEqual(["roles/current.yml", "facts/profile.yml"]);
  });

  it("returns empty context when the collection does not exist", async () => {
    fakeDb.listCollections.mockResolvedValue([]);

    const { getContext } = await loadAstra();
    const result = await getContext("anything");

    expect(result).toEqual({ text: "", sources: [] });
    expect(fakeCollection.find).not.toHaveBeenCalled();
  });
});

describe("getCategoryVectors", () => {
  it("groups documents by category and returns their vectors", async () => {
    fakeCollection.find.mockReturnValue({
      toArray: async () => [
        { _id: "1", category: "roles", $vector: [1, 0] },
        { _id: "2", category: "roles", $vector: [0.9, 0] },
        { _id: "3", category: "projects", $vector: [0, 1] },
        { _id: "4", category: "projects", $vector: [0.5, 0.5] },
      ],
    });

    const { getCategoryVectors } = await loadAstra();
    const result = await getCategoryVectors();

    expect(fakeCollection.find).toHaveBeenCalledWith(
      {},
      { projection: { category: 1, $vector: 1 } }
    );
    expect(result).toEqual([
      { category: "roles", vectors: [[1, 0], [0.9, 0]] },
      { category: "projects", vectors: [[0, 1], [0.5, 0.5]] },
    ]);
  });

  it("skips documents without a category or vector", async () => {
    fakeCollection.find.mockReturnValue({
      toArray: async () => [
        { _id: "1", category: "roles", $vector: [1] },
        { _id: "2", $vector: [1] },
        { _id: "3", category: "facts" },
      ],
    });

    const { getCategoryVectors } = await loadAstra();
    const result = await getCategoryVectors();
    expect(result).toEqual([{ category: "roles", vectors: [[1]] }]);
  });

  it("returns an empty array when the collection is empty", async () => {
    fakeCollection.find.mockReturnValue({ toArray: async () => [] });

    const { getCategoryVectors } = await loadAstra();
    expect(await getCategoryVectors()).toEqual([]);
  });
});

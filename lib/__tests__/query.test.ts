import { describe, it, expect } from "vitest";
import {
  buildRetrievalQuery,
  cosine,
  isDegenerateFollowUp,
  lastUserContent,
  routeByVectors,
  type CategoryVectors,
} from "../query";

describe("lastUserContent", () => {
  it("returns the last user message", () => {
    expect(
      lastUserContent([
        { role: "user", content: "hello" },
        { role: "assistant", content: "hi" },
        { role: "user", content: "tell me more" },
      ])
    ).toBe("tell me more");
  });

  it("returns empty string when no user message", () => {
    expect(lastUserContent([{ role: "assistant", content: "hi" }])).toBe("");
  });
});

describe("isDegenerateFollowUp", () => {
  it("flags bare particles and tiny follow-ups", () => {
    expect(isDegenerateFollowUp("and")).toBe(true);
    expect(isDegenerateFollowUp("tell me more")).toBe(true);
    expect(isDegenerateFollowUp("more")).toBe(true);
    expect(isDegenerateFollowUp("go on")).toBe(true);
  });

  it("flags referential noun phrases", () => {
    expect(isDegenerateFollowUp("what about the youtube one?")).toBe(true);
    expect(isDegenerateFollowUp("the tech stack one")).toBe(true);
  });

  it("does not flag self-contained questions", () => {
    expect(isDegenerateFollowUp("What is his full experience timeline?")).toBe(false);
    expect(isDegenerateFollowUp("does he has any internships?")).toBe(false);
    expect(isDegenerateFollowUp("What tech does he use?")).toBe(false);
  });
});

describe("buildRetrievalQuery", () => {
  it("passes a single message through unchanged", () => {
    const result = buildRetrievalQuery([{ role: "user", content: "What projects has Islam built?" }]);
    expect(result.query).toBe("What projects has Islam built?");
    expect(result.merged).toBe(false);
  });

  it("merges a degenerate follow-up with the previous question", () => {
    const result = buildRetrievalQuery([
      { role: "user", content: "Tell me about the RAG Career Chatbot project" },
      { role: "assistant", content: "It uses Astra DB." },
      { role: "user", content: "and" },
    ]);
    expect(result.query).toBe("Tell me about the RAG Career Chatbot project and");
    expect(result.merged).toBe(true);
    expect(result.routeText).toBe("and");
  });

  it("keeps self-contained follow-ups unchanged", () => {
    const result = buildRetrievalQuery([
      { role: "user", content: "What projects has Islam built?" },
      { role: "assistant", content: "A RAG chatbot and a portfolio." },
      { role: "user", content: "What is his full experience timeline?" },
    ]);
    expect(result.query).toBe("What is his full experience timeline?");
    expect(result.merged).toBe(false);
  });

  it("returns empty when there is no user message", () => {
    expect(buildRetrievalQuery([{ role: "assistant", content: "hi" }]).query).toBe("");
  });
});

describe("cosine", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosine([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("returns 0 for zero vectors", () => {
    expect(cosine([0, 0], [1, 1])).toBe(0);
  });
});

describe("routeByVectors", () => {
  const categories: CategoryVectors[] = [
    {
      category: "roles",
      vectors: [
        [1, 0, 0],
        [1, 0, 0],
      ],
    },
    {
      category: "projects",
      vectors: [
        [0, 1, 0],
        [0, 1, 0],
      ],
    },
  ];

  it("routes to the category with the highest mean similarity", () => {
    const result = routeByVectors([1, 0.1, 0], categories);
    expect(result.category).toBe("roles");
    expect(result.score).toBeCloseTo(1);
  });

  it("returns null when below threshold", () => {
    const result = routeByVectors([0.2, 0.2, 1], categories);
    expect(result.category).toBeNull();
  });

  it("returns null when the top two categories are too close", () => {
    const result = routeByVectors([0.5, 0.48, 0], categories, { margin: 0.1 });
    expect(result.category).toBeNull();
  });

  it("returns null when no categories are provided", () => {
    expect(routeByVectors([1, 0, 0], []).category).toBeNull();
  });
});

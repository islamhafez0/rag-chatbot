import { describe, it, expect } from "vitest";
import {
  buildRetrievalQuery,
  isDegenerateFollowUp,
  lastUserContent,
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

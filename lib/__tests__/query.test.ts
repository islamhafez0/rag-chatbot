import { describe, it, expect } from "vitest";
import {
  buildRetrievalQuery,
  followUpKind,
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
  it("flags bare particles", () => {
    expect(isDegenerateFollowUp("and")).toBe(true);
    expect(isDegenerateFollowUp("tell me more")).toBe(true);
    expect(isDegenerateFollowUp("more")).toBe(true);
    expect(isDegenerateFollowUp("go on")).toBe(true);
  });

  it("flags continuations", () => {
    expect(isDegenerateFollowUp("and his skills?")).toBe(true);
    expect(isDegenerateFollowUp("and what did he do before?")).toBe(true);
    expect(isDegenerateFollowUp("but what about Odoo?")).toBe(true);
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

  it("does not merge standalone short questions", () => {
    // The old token-count heuristic merged every <=2-token query.
    expect(isDegenerateFollowUp("Who is he?")).toBe(false);
    expect(isDegenerateFollowUp("What skills?")).toBe(false);
    expect(isDegenerateFollowUp("Which role?")).toBe(false);
    expect(isDegenerateFollowUp("Why Odoo?")).toBe(false);
  });

  it("detects topic changes as standalone", () => {
    expect(isDegenerateFollowUp("What is the capital of France?")).toBe(false);
    expect(isDegenerateFollowUp("tell me a joke")).toBe(false);
  });
});

describe("followUpKind", () => {
  it("classifies explicitly", () => {
    expect(followUpKind("and")).toBe("bare");
    expect(followUpKind("and his skills?")).toBe("continuation");
    expect(followUpKind("what about the youtube one?")).toBe("referential");
    expect(followUpKind("What skills?")).toBeNull();
    expect(followUpKind("  ")).toBeNull();
  });
});

describe("buildRetrievalQuery", () => {
  it("passes a single message through unchanged", () => {
    const result = buildRetrievalQuery([{ role: "user", content: "What projects has Islam built?" }]);
    expect(result.query).toBe("What projects has Islam built?");
    expect(result.merged).toBe(false);
  });

  it("re-asks the previous question for bare particles", () => {
    const result = buildRetrievalQuery([
      { role: "user", content: "Tell me about the RAG Career Chatbot project" },
      { role: "assistant", content: "It uses pgvector." },
      { role: "user", content: "and" },
    ]);
    expect(result.query).toBe("Tell me about the RAG Career Chatbot project");
    expect(result.merged).toBe(true);
    expect(result.routeText).toBe("and");
  });

  it("strips the opener from continuations", () => {
    const result = buildRetrievalQuery([
      { role: "user", content: "What is his experience timeline?" },
      { role: "assistant", content: "He interned at Code Alpha." },
      { role: "user", content: "and his skills?" },
    ]);
    expect(result.query).toBe("What is his experience timeline? his skills?");
    expect(result.merged).toBe(true);
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

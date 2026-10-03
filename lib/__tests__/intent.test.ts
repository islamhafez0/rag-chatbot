import { describe, it, expect } from "vitest";
import { classifyIntent } from "../intent";

describe("classifyIntent", () => {
  it("routes enumeration questions to complete mode with a category", () => {
    expect(classifyIntent("What is his full experience timeline?")).toEqual({
      mode: "complete",
      category: "roles",
      sources: null,
    });
    expect(classifyIntent("Which companies has Islam worked at?")).toMatchObject({
      mode: "complete",
      category: "roles",
    });
    expect(classifyIntent("List every role Islam has held")).toMatchObject({
      mode: "complete",
      category: "roles",
    });
    expect(classifyIntent("What projects has Islam built?")).toEqual({
      mode: "complete",
      category: "projects",
      sources: null,
    });
    expect(classifyIntent("List all of Islam's projects")).toMatchObject({
      mode: "complete",
      category: "projects",
    });
  });

  it("routes skills/education/certification listings to complete facts subsets", () => {
    expect(classifyIntent("What technologies does he know?")).toEqual({
      mode: "complete",
      category: "facts",
      sources: ["facts/skills.yml"],
    });
    expect(classifyIntent("What is his education background?")).toMatchObject({
      mode: "complete",
      category: "facts",
    });
    expect(classifyIntent("What certifications does Islam hold?")).toMatchObject({
      mode: "complete",
      category: "facts",
    });
  });

  it("treats first-job questions as complete enumeration", () => {
    expect(classifyIntent("What was Islam's first job?")).toMatchObject({
      mode: "complete",
      category: "roles",
    });
  });

  it("keeps specific questions focused (today's behavior)", () => {
    expect(classifyIntent("what is his current role?").mode).toBe("focused");
    expect(classifyIntent("what os his secound role?").mode).toBe("focused");
    expect(classifyIntent("Tell me about the RAG Career Chatbot").mode).toBe("focused");
    expect(classifyIntent("What is the youtube clone project about?").mode).toBe("focused");
    expect(classifyIntent("Who is Islam Hafez?").mode).toBe("focused");
    expect(classifyIntent("Hi there").mode).toBe("focused");
    expect(classifyIntent("").mode).toBe("focused");
    expect(classifyIntent("What was the revenue impact of the portfolio website?").mode).toBe(
      "focused",
    );
  });

  it("routes explanations to expanded mode", () => {
    expect(classifyIntent("How does retrieval work in this chatbot?").mode).toBe("expanded");
    expect(classifyIntent("Compare Next.js and Odoo in his work").mode).toBe("expanded");
    expect(classifyIntent("Why did he choose pgvector?").mode).toBe("expanded");
  });

  it("prefers complete over expanded when both match", () => {
    // "experience" (complete) + "architecture"? No architecture word here;
    // use a query with both listing and explanation markers.
    expect(
      classifyIntent("List all projects and explain the architecture decisions").mode,
    ).toBe("complete");
  });
});

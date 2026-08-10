import { describe, it, expect, vi } from "vitest";
import { lastUserContent, rewriteRetrievalQuery } from "../query-rewrite";

type RewriteArgs = {
  model: string;
  temperature: number;
  max_tokens: number;
  messages: { role: string; content: string }[];
};

function firstCallArgs(client: { create: ReturnType<typeof vi.fn> }): RewriteArgs {
  return (client.create.mock.calls[0] as [RewriteArgs])[0];
}

function stubClient(content: string | null | undefined, opts: { shouldThrow?: boolean } = {}) {
  const create = vi.fn(async () => {
    if (opts.shouldThrow) throw new Error("rate limited");
    return { choices: [{ message: { content: content ?? null } }] };
  });
  return {
    chat: { completions: { create } },
    create,
  };
}

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

describe("rewriteRetrievalQuery", () => {
  it("skips the rewrite call for a single message", async () => {
    const client = stubClient("rewritten");
    const result = await rewriteRetrievalQuery(
      [{ role: "user", content: "What projects has Islam built?" }],
      client
    );
    expect(result).toBe("What projects has Islam built?");
    expect(client.create).not.toHaveBeenCalled();
  });

  it("skips the call when there is no user content", async () => {
    const client = stubClient("rewritten");
    const result = await rewriteRetrievalQuery(
      [{ role: "assistant", content: "hi" }],
      client
    );
    expect(result).toBe("");
    expect(client.create).not.toHaveBeenCalled();
  });

  it("rewrites a follow-up into a standalone query", async () => {
    const client = stubClient("RAG Career Chatbot tech stack");
    const conversation = [
      { role: "user", content: "Tell me about the RAG Career Chatbot project" },
      { role: "assistant", content: "It is a RAG chatbot using Astra DB." },
      { role: "user", content: "tell me more about the tech stack" },
    ];
    const result = await rewriteRetrievalQuery(conversation, client);
    expect(result).toBe("RAG Career Chatbot tech stack");
    expect(client.create).toHaveBeenCalledTimes(1);

    const args = firstCallArgs(client);
    expect(args.temperature).toBe(0);
    expect(args.max_tokens).toBe(100);
    expect(args.messages[0].role).toBe("system");
    expect(args.messages).toHaveLength(1 + conversation.length);
  });

  it("only sends the last 6 messages to the model", async () => {
    const client = stubClient("x");
    const conversation = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `message ${i}`,
    }));
    await rewriteRetrievalQuery(conversation, client);
    const args = firstCallArgs(client);
    expect(args.messages).toHaveLength(1 + 6);
  });

  it("falls back to the last user message when the model returns nothing", async () => {
    const client = stubClient(null);
    const conversation = [
      { role: "user", content: "first" },
      { role: "user", content: "what about youtube clone?" },
    ];
    const result = await rewriteRetrievalQuery(conversation, client);
    expect(result).toBe("what about youtube clone?");
  });

  it("falls back to the last user message when the API throws", async () => {
    const client = stubClient("ignored", { shouldThrow: true });
    const conversation = [
      { role: "user", content: "first" },
      { role: "user", content: "what about youtube clone?" },
    ];
    const result = await rewriteRetrievalQuery(conversation, client);
    expect(result).toBe("what about youtube clone?");
  });
});

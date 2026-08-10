const REWRITE_PROMPT = `You are a query rewriter for a RAG system that answers questions about Islam Hafez's career, projects, skills, and experience.

Given the conversation, produce a single concise, self-contained search query capturing the user's current information need.
- Resolve pronouns and follow-ups ("it", "that project", "tell me more") using the conversation history.
- Use specific names and keywords (project names, skills, tech stacks) when they appear.
- Keep it under 40 words, as a plain search query (no question marks, no preamble).
Output ONLY the query.`;

interface ChatMessage {
  role?: string;
  content?: unknown;
}

interface RewriteClient {
  chat: {
    completions: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: (args: any) => Promise<{ choices?: { message?: { content?: string | null } }[] }>;
    };
  };
}
export function lastUserContent(messages: ChatMessage[]): string {
  return String(
    [...messages].reverse().find((m) => m.role === "user")?.content ?? ""
  ).trim();
}

export async function rewriteRetrievalQuery(
  messages: ChatMessage[],
  client: RewriteClient,
  model = "llama-3.1-8b-instant"
): Promise<string> {
  const fallback = lastUserContent(messages);

  if (messages.length <= 1 || !fallback) {
    return fallback;
  }

  try {
    const response = await client.chat.completions.create({
      model,
      temperature: 0,
      max_tokens: 100,
      messages: [
        { role: "system", content: REWRITE_PROMPT },
        ...messages.slice(-6).map((m) => ({
          role: (["user", "assistant", "system"] as const).includes(
            m.role as "user" | "assistant" | "system"
          )
            ? (m.role as "user" | "assistant" | "system")
            : "user",
          content: String(m.content ?? ""),
        })),
      ],
    });

    return response.choices?.[0]?.message?.content?.trim() || fallback;
  } catch (error) {
    console.warn(
      "Query rewrite failed, falling back to last user message:",
      error instanceof Error ? error.message : error
    );
    return fallback;
  }
}

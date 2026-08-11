import { StreamingTextResponse } from "ai";
import { runPipeline } from "@/lib/pipeline";
import { buildSystemPrompt, createAnswerStream } from "@/lib/generate";
import { envRouter } from "@/lib/env";

const ROUTER: "vector" | "none" = envRouter();

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    let body: { messages?: unknown; category?: unknown } = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const { messages, category: requestedCategory } = body;
    const conversation = Array.isArray(messages) ? messages : [];
    if (conversation.length === 0) {
      return new Response(JSON.stringify({ error: "No messages provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.log("#".repeat(20), "Conversation", "#".repeat(20));
    console.log("Conversation:", conversation);
    console.log("#".repeat(20), "Requested Category", "#".repeat(20));
    console.log("Requested Category:", requestedCategory);
    console.log("#".repeat(20), "Messages", "#".repeat(20));
    console.log("Messages:", messages);
    const pipeline = await runPipeline(conversation, {
      requestedCategory:
        typeof requestedCategory === "string" && requestedCategory ? requestedCategory : undefined,
      router: ROUTER,
    });

    const stream = await createAnswerStream({
      systemPrompt: buildSystemPrompt(pipeline.context.text),
      turns: conversation.map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: String(message.content ?? ""),
      })),
    });

    return new StreamingTextResponse(stream);
  } catch (error) {
    console.error("Error in chat route:", error);

    const err = error as { status?: number; message?: string };
    const status = err.status || (err.message?.includes("429") ? 429 : 500);
    const errorMessage =
      status === 429
        ? "AI Rate limit reached. Please wait a minute before trying again."
        : err.message || "Internal Server Error";

    return new Response(JSON.stringify({ error: errorMessage }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}

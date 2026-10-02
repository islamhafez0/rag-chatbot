import { StreamingTextResponse } from "ai";
import { runPipeline } from "@/lib/pipeline";
import { buildSystemPrompt, createAnswerStream } from "@/lib/generate";

export const dynamic = "force-dynamic";

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  magenta: "\x1b[35m",
};

export async function POST(req: Request) {
  const requestStart = performance.now();
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
    const pipeline = await runPipeline(conversation, {
      requestedCategory:
        typeof requestedCategory === "string" && requestedCategory ? requestedCategory : undefined,
    });

    let ttftMs = 0;
    const llmStart = performance.now();
    const stream = await createAnswerStream({
      systemPrompt: buildSystemPrompt(pipeline.context.text),
      turns: conversation.map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: String(message.content ?? ""),
      })),
      onFirstToken: (ms) => {
        ttftMs = ms;
      },
      onFinal: () => {
        const genMs = performance.now() - llmStart;
        const totalMs = performance.now() - requestStart;
        const historyChars = conversation.reduce(
          (sum, m) => sum + String(m.content ?? "").length,
          0,
        );
        console.log(`
${c.cyan}${c.bold}[timing]${c.reset}

${c.cyan}total:${c.reset}        ${c.yellow}${totalMs.toFixed(0)}ms${c.reset} ${c.dim}(request start to generation end)${c.reset}
${c.cyan}prep:${c.reset}         ${c.yellow}${pipeline.timings.prepMs.toFixed(0)}ms${c.reset} ${c.dim}(query build/rewrite)${c.reset}
${c.cyan}retrieve:${c.reset}     ${c.yellow}${pipeline.timings.retrieveMs.toFixed(0)}ms${c.reset} ${c.dim}(embedding + vector search)${c.reset}
${c.cyan}llmTTFT:${c.reset}      ${c.yellow}${ttftMs.toFixed(0)}ms${c.reset} ${c.dim}(time to first token)${c.reset}
${c.cyan}llmGen:${c.reset}       ${c.yellow}${genMs.toFixed(0)}ms${c.reset} ${c.dim}(total generation)${c.reset}
${c.cyan}turns:${c.reset}        ${c.green}${conversation.length}${c.reset} ${c.dim}(messages in conversation)${c.reset}
${c.cyan}historyChars:${c.reset} ${c.green}${historyChars}${c.reset} ${c.dim}(total history chars sent to LLM)${c.reset}
${c.cyan}contextChars:${c.reset} ${c.green}${pipeline.context.text.length}${c.reset} ${c.dim}(retrieved context chars)${c.reset}
${c.cyan}sources:${c.reset}      ${c.green}${pipeline.context.sources.length}${c.reset} ${c.dim}(retrieved chunks)${c.reset}
${c.cyan}category:${c.reset}     ${c.magenta}${pipeline.category ?? "none"}${c.reset} ${c.dim}(explicit category filter)${c.reset}
${c.cyan}model:${c.reset}        ${c.magenta}${process.env.LLM_MODEL ?? "unknown"}${c.reset} ${c.dim}(LLM model)${c.reset}
`);
      },
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

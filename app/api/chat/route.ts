import { StreamingTextResponse } from "ai";
import { runPipeline } from "@/lib/pipeline";
import { buildSystemPrompt, createAnswerStream } from "@/lib/generate";
import { buildCoverageNote, approxTokens } from "@/lib/coverage";
import { validateChatBody, createRateLimiter } from "@/lib/api-guard";
import { envOptionalNumber } from "@/lib/env";

export const dynamic = "force-dynamic";

const LIMITS = {
  maxMessageChars: envOptionalNumber("MAX_MESSAGE_CHARS", 2000),
  maxMessages: envOptionalNumber("MAX_MESSAGES", 30),
  maxHistoryChars: envOptionalNumber("MAX_HISTORY_CHARS", 12000),
};
const limiter = createRateLimiter(
  60_000,
  envOptionalNumber("RATE_LIMIT_PER_MIN", 20)
);

function jsonError(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  const requestStart = performance.now();
  try {
    // Cheap abuse protection first: reject before any embedding/LLM spend.
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!limiter.check(clientIp)) {
      return jsonError(
        "Rate limit reached. Please wait a minute before trying again.",
        429
      );
    }

    const raw = await req.text();
    let body: unknown = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return jsonError("Invalid JSON body.", 400);
    }
    const guarded = validateChatBody(body, LIMITS);
    if ("reject" in guarded) {
      return jsonError(guarded.reject.error, guarded.reject.status);
    }
    const { messages: conversation } = guarded;
    const requestedCategory =
      (body as { category?: unknown }).category as string | undefined;

    const pipeline = await runPipeline(conversation, {
      requestedCategory:
        typeof requestedCategory === "string" && requestedCategory ? requestedCategory : undefined,
    });

    let ttftMs = 0;
    const llmStart = performance.now();
    const coverageNote = buildCoverageNote(pipeline.context.coverage);
    const systemPrompt = buildSystemPrompt(pipeline.context.text, { coverageNote });
    const stream = await createAnswerStream({
      systemPrompt,
      turns: conversation.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      onFirstToken: (ms) => {
        ttftMs = ms;
      },
      onFinal: () => {
        const genMs = performance.now() - llmStart;
        const totalMs = performance.now() - requestStart;
        const historyChars = conversation.reduce(
          (sum, m) => sum + m.content.length,
          0,
        );
        // No credentials or message content logged, either way.
        const fields = {
          totalMs: Math.round(totalMs),
          prepMs: Math.round(pipeline.timings.prepMs),
          retrieveMs: Math.round(pipeline.timings.retrieveMs),
          assemblyMs: Math.round(pipeline.timings.assemblyMs * 100) / 100,
          llmTTFTMs: Math.round(ttftMs),
          llmGenMs: Math.round(genMs),
          turns: conversation.length,
          historyChars,
          contextChars: pipeline.context.text.length,
          promptTokens: approxTokens(systemPrompt.length),
          mode: pipeline.intent.mode,
          coverage:
            pipeline.context.coverage.coverage !== null
              ? `${pipeline.context.coverage.retrievedChunks}/${pipeline.context.coverage.expectedChunks}`
              : "n/a",
          truncated: pipeline.context.coverage.truncated,
          sources: pipeline.context.sources.length,
          category: pipeline.category ?? "none",
          model: process.env.LLM_MODEL ?? "unknown",
        };
        if (process.env.NODE_ENV === "production") {
          // Structured, machine-readable: safe for log collectors.
          console.log(JSON.stringify({ event: "chat_request", ...fields }));
        } else {
          const c = {
            reset: "\x1b[0m",
            bold: "\x1b[1m",
            dim: "\x1b[2m",
            cyan: "\x1b[36m",
            yellow: "\x1b[33m",
            green: "\x1b[32m",
            magenta: "\x1b[35m",
          };
          console.log(`
${c.cyan}${c.bold}[timing]${c.reset}

${c.cyan}total:${c.reset}        ${c.yellow}${fields.totalMs}ms${c.reset} ${c.dim}(request start to generation end)${c.reset}
${c.cyan}prep:${c.reset}         ${c.yellow}${fields.prepMs}ms${c.reset} ${c.dim}(query build/rewrite)${c.reset}
${c.cyan}retrieve:${c.reset}     ${c.yellow}${fields.retrieveMs}ms${c.reset} ${c.dim}(embedding + vector search)${c.reset}
${c.cyan}assembly:${c.reset}     ${c.yellow}${fields.assemblyMs}ms${c.reset} ${c.dim}(merge/dedupe/budget)${c.reset}
${c.cyan}llmTTFT:${c.reset}      ${c.yellow}${fields.llmTTFTMs}ms${c.reset} ${c.dim}(time to first token)${c.reset}
${c.cyan}llmGen:${c.reset}       ${c.yellow}${fields.llmGenMs}ms${c.reset} ${c.dim}(total generation)${c.reset}
${c.cyan}mode:${c.reset}         ${c.magenta}${fields.mode}${c.reset} ${c.dim}(focused/expanded/complete)${c.reset}
${c.cyan}coverage:${c.reset}     ${c.green}${fields.coverage}${c.reset} ${c.dim}(category records retrieved/expected)${c.reset}
${c.cyan}truncated:${c.reset}    ${c.green}${fields.truncated}${c.reset} ${c.dim}(context budget trim)${c.reset}
${c.cyan}promptTokens:${c.reset} ${c.green}${fields.promptTokens}${c.reset} ${c.dim}(~chars/4 incl. coverage note)${c.reset}
${c.cyan}turns:${c.reset}        ${c.green}${fields.turns}${c.reset} ${c.dim}(messages in conversation)${c.reset}
${c.cyan}historyChars:${c.reset} ${c.green}${fields.historyChars}${c.reset} ${c.dim}(total history chars sent to LLM)${c.reset}
${c.cyan}contextChars:${c.reset} ${c.green}${fields.contextChars}${c.reset} ${c.dim}(retrieved context chars)${c.reset}
${c.cyan}sources:${c.reset}      ${c.green}${fields.sources}${c.reset} ${c.dim}(retrieved chunks)${c.reset}
${c.cyan}category:${c.reset}     ${c.magenta}${fields.category}${c.reset} ${c.dim}(explicit category filter)${c.reset}
${c.cyan}model:${c.reset}        ${c.magenta}${fields.model}${c.reset} ${c.dim}(LLM model)${c.reset}
`);
        }
      },
    });

    return new StreamingTextResponse(stream);
  } catch (error) {
    // Never leak internals: log server-side, return a safe message.
    console.error("Error in chat route:", error);

    const message = error instanceof Error ? error.message : "";
    if (message.includes("429")) {
      return jsonError(
        "AI rate limit reached. Please wait a minute before trying again.",
        429
      );
    }
    return jsonError("Something went wrong. Please try again.", 500);
  }
}

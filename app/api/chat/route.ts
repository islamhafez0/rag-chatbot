import { StreamingTextResponse } from "ai";
import { runPipeline } from "@/lib/pipeline";
import { buildSystemPrompt, createAnswerStream } from "@/lib/generate";
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
    const stream = await createAnswerStream({
      systemPrompt: buildSystemPrompt(pipeline.context.text),
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
        // Structured, machine-readable log (no ANSI colors): safe for
        // production collectors. No credentials or message content logged.
        console.log(
          JSON.stringify({
            event: "chat_request",
            totalMs: Math.round(totalMs),
            prepMs: Math.round(pipeline.timings.prepMs),
            retrieveMs: Math.round(pipeline.timings.retrieveMs),
            llmTTFTMs: Math.round(ttftMs),
            llmGenMs: Math.round(genMs),
            turns: conversation.length,
            historyChars,
            contextChars: pipeline.context.text.length,
            sources: pipeline.context.sources.length,
            category: pipeline.category ?? "none",
            model: process.env.LLM_MODEL ?? "unknown",
          })
        );
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

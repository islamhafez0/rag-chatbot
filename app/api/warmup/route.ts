/**
 * GET /api/warmup — move first-request cold-start work off the chat path.
 * Runs DB ensureTable + pool connect (no embedding, no LLM cost).
 * Call after deploy or before first chat to avoid the slow first request (#35).
 */
import { warmupRetrieval } from "@/database/pgvector";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = performance.now();
  try {
    await warmupRetrieval();
  } catch (error) {
    console.error("Warmup failed:", error);
    return new Response(JSON.stringify({ ok: false }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  const ms = Math.round(performance.now() - start);
  if (process.env.NODE_ENV === "production") {
    console.log(JSON.stringify({ event: "warmup", ok: true, ms }));
  } else {
    console.log(`\x1b[36m\x1b[1m[warmup]\x1b[0m ok in \x1b[33m${ms}ms\x1b[0m`);
  }
  return new Response(JSON.stringify({ ok: true, ms }), {
    headers: { "Content-Type": "application/json" },
  });
}

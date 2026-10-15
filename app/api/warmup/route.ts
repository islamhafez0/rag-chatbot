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
  return new Response(
    JSON.stringify({ ok: true, ms: Math.round(performance.now() - start) }),
    { headers: { "Content-Type": "application/json" } },
  );
}

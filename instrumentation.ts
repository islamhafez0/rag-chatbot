/**
 * Next.js server boot hook: pre-warm the RAG retrieval path (Postgres pool
 * + ensureTable DDL) so the first POST /api/chat doesn't pay cold-start.
 * Fire-and-forget; never blocks boot, never throws. See issue #35.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { warmupRetrieval } = await import("./database/pgvector");
    await warmupRetrieval();
  } catch (error) {
    console.error("Warmup skipped:", error instanceof Error ? error.message : error);
  }
}

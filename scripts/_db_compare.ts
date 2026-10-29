import "dotenv/config";
import { readFileSync } from "node:fs";
import { Pool } from "pg";

const neonUrl =
  process.env.NEON_URL ??
  readFileSync(".env", "utf8")
    .split("\n")
    .map((l: string) => l.trim())
    .find((l: string) => l.startsWith("# DATABASE_URL=postgresql://neondb_owner"))
    ?.replace(/^#\s*/, "")
    ?.replace("DATABASE_URL=", "");

async function summarize(label: string, pool: Pool) {
  const { rows } = await pool.query<{ source: string; n: string }>(
    `SELECT source, count(*) AS n
     FROM me_vectors GROUP BY source ORDER BY source`
  );
  const total = rows.reduce((s, r) => s + Number(r.n), 0);
  console.log(`\n== ${label}: ${total} chunks, ${rows.length} sources`);
  for (const r of rows) console.log(`  ${r.n}> ${r.source}`);
  return rows.map((r) => `${r.source}:${r.n}`);
}

async function main() {
  const local = new Pool({ connectionString: process.env.DATABASE_URL });
  const localMap = await summarize("LOCAL", local);
  let ok = false;
  if (neonUrl) {
    const neon = new Pool({ connectionString: neonUrl, ssl: { rejectUnauthorized: false } });
    try {
      const neonMap = await summarize("NEON", neon);
      const same =
        localMap.length === neonMap.length && localMap.every((k, i) => neonMap[i] === k);
      console.log(`\nRESULT: ${same ? "NEON IS UP TO DATE" : "NEON IS STALE (re-ingest needed)"}`);
      ok = same;
    } finally {
      await neon.end();
    }
  } else {
    console.log("\nNo Neon URL found in .env");
  }
  await local.end();
  if (!ok) process.exit(2);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

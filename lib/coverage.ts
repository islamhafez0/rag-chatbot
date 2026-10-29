/**
 * Backend-derived completeness tracking for adaptive retrieval.
 *
 * All values here come from database metadata (row counts, char budgets),
 * never from the model — the LLM is therefore never allowed to invent its
 * own completeness claim; it only renders the provided coverage note.
 */
import type { ContextMode } from "./intent";

export interface CoverageInfo {
  mode: ContextMode;
  requestedCategory: string | null;
  /** Category records placed in context (pre-budget). */
  retrievedChunks: number;
  /** Total category records in the KB, null when not a category request. */
  expectedChunks: number | null;
  /** Distinct sources among retrieved category records, null/omitted when unknown. */
  recordCount?: number | null;
  /** retrievedChunks / expectedChunks, null when unknown. */
  coverage: number | null;
  /** True when the char budget cut records (category or semantic). */
  truncated: boolean;
  budgetChars: number;
  contextChars: number;
}

export interface ContextChunk {
  text: string;
  source: string;
}

const CHUNK_SEPARATOR = "\n\n";

function dedupeKey(text: string): string {
  return text.trim().slice(0, 120);
}

/**
 * Merge category records (stable storage order first) with semantic top-K,
 * dropping exact duplicates. Truncates at chunk boundaries to `budgetChars`.
 * Pure function — fully unit-testable without a database.
 */
export function assembleContext(
  categoryChunks: ContextChunk[],
  semanticChunks: ContextChunk[],
  budgetChars: number,
): {
  text: string;
  sources: string[];
  includedCategory: number;
  includedSemantic: number;
  truncated: boolean;
} {
  const seen = new Set<string>();
  const picked: ContextChunk[] = [];
  let truncated = false;

  const tryAdd = (chunk: ContextChunk): boolean => {
    const key = dedupeKey(chunk.text);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    picked.push(chunk);
    return true;
  };

  for (const c of categoryChunks) {
    tryAdd(c);
  }
  for (const c of semanticChunks) {
    tryAdd(c);
  }

  // Budget at chunk boundaries: keep whole records or nothing.
  let chars = 0;
  let kept = picked.length;
  for (let i = 0; i < picked.length; i++) {
    const add = (i === 0 ? 0 : CHUNK_SEPARATOR.length) + picked[i].text.length;
    if (chars + add > budgetChars) {
      kept = i;
      truncated = true;
      break;
    }
    chars += add;
  }
  const final = picked.slice(0, kept);
  // Post-budget counts: only kept records count toward coverage.
  const categoryKeys = new Set(categoryChunks.map((c) => dedupeKey(c.text)));
  const keptCategory = final.filter((c) => categoryKeys.has(dedupeKey(c.text))).length;
  return {
    text: final.map((c) => c.text).join(CHUNK_SEPARATOR),
    sources: Array.from(new Set(final.map((c) => c.source).filter(Boolean))),
    includedCategory: keptCategory,
    includedSemantic: final.length - keptCategory,
    truncated,
  };
}

export function coverageFromAssembly(
  mode: ContextMode,
  requestedCategory: string | null,
  categoryTotal: number | null,
  assembled: { text: string; includedCategory: number; truncated: boolean; sources?: string[] },
  budgetChars: number,
): CoverageInfo {
  const coverage =
    categoryTotal !== null && categoryTotal > 0
      ? Math.min(1, assembled.includedCategory / categoryTotal)
      : null;
  return {
    mode,
    requestedCategory,
    retrievedChunks: assembled.includedCategory,
    expectedChunks: categoryTotal,
    // Number of distinct files represented: the "record count" for the note.
    recordCount: assembled.sources && assembled.sources.length > 0 ? assembled.sources.length : null,
    coverage,
    truncated: assembled.truncated,
    budgetChars,
    contextChars: assembled.text.length,
  };
}

/** Prompt-safe rendering of backend coverage. No model input involved. */
export function buildCoverageNote(c: CoverageInfo): string {
  if (c.mode !== "complete" || c.requestedCategory === null) {
    return (
      `Mode: ${c.mode}. No exhaustive listing was requested. ` +
      `Answer the question from the provided context; never present a ` +
      `partial list as exhaustive ("all", "every", "full", "complete").`
    );
  }
  const records = c.recordCount ?? c.expectedChunks ?? c.retrievedChunks;
  const sections = c.expectedChunks ?? c.retrievedChunks;
  const sectionNote =
    sections !== records
      ? `document sections describing ${records} records`
      : `records`;
  if (!c.truncated && c.coverage !== null && c.coverage >= 1) {
    return (
      `Mode: complete. Category "${c.requestedCategory}": all ${sections} ` +
      `${sectionNote} are present in the context. ` +
      `Enumerate every record once, merging a record's sections ` +
      `(duration, tech stack, achievements, outcomes) into one entry. ` +
      `Do not list sections as separate records and do not call grouped ` +
      `content "duplicates". Complete coverage never authorizes inventing ` +
      `numbers, scores, or statistics.`
    );
  }
  return (
    `Mode: complete. Category "${c.requestedCategory}": PARTIAL coverage ` +
    `(${c.retrievedChunks}/${sections} sections${c.truncated ? ", context budget reached" : ""}; ` +
    `several sections may belong to the same record). List every record that is ` +
    `fully represented, but do NOT claim the list is exhaustive — say that ` +
    `only part of the available records are present.`
  );
}

/** Approximate prompt tokens for instrumentation (chars/4 heuristic). */
export function approxTokens(chars: number): number {
  return Math.ceil(chars / 4);
}

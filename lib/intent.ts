/**
 * Deterministic query-intent classification for adaptive context modes.
 *
 * No embeddings, no LLM calls: pure keyword rules over the prepared
 * retrieval query (sub-microsecond). Three modes:
 *
 * - focused:  ordinary factual questions → today's top-K behavior, unchanged.
 * - expanded: explanations / technical / comparative questions → wider top-K.
 * - complete: exhaustive listing questions → ALL records of a category, merged
 *   with semantic top-K. Never the whole KB: only the requested category.
 *
 * This is deliberately not the removed centroid router (issue #9): it costs
 * no model calls and only *adds* category records for explicit enumeration
 * intents instead of restricting retrieval.
 */

export type ContextMode = "focused" | "expanded" | "complete";

export interface QueryIntent {
  mode: ContextMode;
  /** DB category to exhaust in complete mode (e.g. "roles"). */
  category: string | null;
  /** Optional exact source filter within the category (e.g. skills file). */
  sources: string[] | null;
}

const EXHAUSTIVE = /\b(every|all|full|complete|entire|each|whole|list all|show all)\b/;

const ROLES_ENUM =
  /\b(timeline|experience|career history|work history|employment history|worked at|companies|employers)\b/;
const ROLES_WORD = /\b(jobs?|roles?|positions?|internships?|employment)\b/;

const SKILLS_WORD = /\b(skills?|technologies|tech stack|proficient|speciali[sz]e in)\b/;
const EDUCATION_WORD = /\b(education|educational|university|college|degree|studied|study)\b/;
const CERT_WORD = /\b(certifications?|certificates?|certified|credentials?)\b/;

const EXPANDED_WORD =
  /\b(how|why|explain|compare|comparison|versus|difference|architecture|detail|process|workflow|approach|decision)\b/;

export function classifyIntent(query: string): QueryIntent {
  const q = query.toLowerCase().trim();
  if (!q) return { mode: "focused", category: null, sources: null };

  // ---- complete: exhaustive enumeration of one category ----
  if (
    ROLES_ENUM.test(q) ||
    /\bfirst (job|role|position)\b/.test(q) ||
    (EXHAUSTIVE.test(q) && ROLES_WORD.test(q))
  ) {
    return { mode: "complete", category: "roles", sources: null };
  }
  if (/\bprojects\b/.test(q) || (EXHAUSTIVE.test(q) && /\bproject\b/.test(q))) {
    return { mode: "complete", category: "projects", sources: null };
  }
  if (SKILLS_WORD.test(q)) {
    return { mode: "complete", category: "facts", sources: ["facts/skills.yml"] };
  }
  if (EDUCATION_WORD.test(q)) {
    return { mode: "complete", category: "facts", sources: ["facts/profile.yml"] };
  }
  if (CERT_WORD.test(q)) {
    return { mode: "complete", category: "facts", sources: ["facts/certifications.yml"] };
  }

  // ---- expanded: explanations need surrounding context ----
  if (EXPANDED_WORD.test(q)) {
    return { mode: "expanded", category: null, sources: null };
  }

  // ---- focused: today's behavior, unchanged ----
  return { mode: "focused", category: null, sources: null };
}

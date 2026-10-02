export interface ChatMessage {
  role?: string;
  content?: unknown;
}

export function userContents(messages: ChatMessage[]): string[] {
  return messages
    .filter((m) => m.role === "user")
    .map((m) => String(m.content ?? "").trim())
    .filter(Boolean);
}

export function lastUserContent(messages: ChatMessage[]): string {
  return userContents(messages).at(-1) ?? "";
}

const BARE_FOLLOW_UPS = new Set([
  "and",
  "and then",
  "then",
  "so",
  "more",
  "tell me more",
  "what about it",
  "what else",
  "go on",
  "continue",
  "ok",
  "okay",
  "yes",
  "yeah",
  "again",
  "also",
  "hmm",
  "um",
]);

// Explicit continuation openers: the query continues the previous turn
// ("and his skills?", "but what about Odoo?"). Matched case-insensitively
// on the raw (unstripped) text so "And ..." still counts.
const CONTINUATION_PREFIX_RE =
  /^(and|but|also|then|so|plus|what about|how about|what of)\b/i;

// Referential noun phrases ("the youtube one", "what about the X one?").
const REFERENTIAL_RE =
  /^(?:the|what about the) .+\b(one|app|project|site|thing|role|company|job|skill)s?\b[?.!]*$/i;

export type FollowUpKind = "bare" | "continuation" | "referential" | null;

/** Classify a user message. Standalone short questions return null. */
export function followUpKind(content: string): FollowUpKind {
  const trimmed = content.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (BARE_FOLLOW_UPS.has(lower)) return "bare";
  // Referential first: "what about the X one" also opens with a
  // continuation word, but the specific pattern wins.
  if (REFERENTIAL_RE.test(lower)) return "referential";
  if (CONTINUATION_PREFIX_RE.test(trimmed)) return "continuation";
  return null;
}

export function isDegenerateFollowUp(content: string): boolean {
  return followUpKind(content) !== null;
}

export interface PreparedQuery {
  query: string;
  routeText: string;
  merged: boolean;
}

export function buildRetrievalQuery(messages: ChatMessage[]): PreparedQuery {
  const users = userContents(messages);
  const last = users.at(-1) ?? "";
  const prev = users.length >= 2 ? users[users.length - 2] : null;

  if (!last) return { query: "", routeText: "", merged: false };

  const kind = prev ? followUpKind(last) : null;
  if (prev && kind) {
    // Bare particles carry no content: re-ask the previous question as-is
    // instead of appending noise ("...chatbot and").
    if (kind === "bare") {
      return { query: prev, routeText: last, merged: true };
    }
    // Continuations drop the opener ("and his skills?" -> "prev his skills?")
    // so the retrieval query stays about the topic, not the conjunction.
    if (kind === "continuation") {
      const rest = last.trim().replace(CONTINUATION_PREFIX_RE, "").trim();
      return { query: rest ? `${prev} ${rest}` : prev, routeText: last, merged: true };
    }
    return { query: `${prev} ${last.trim()}`, routeText: last, merged: true };
  }

  return { query: last, routeText: last, merged: false };
}
// NOTE: centroid-based category routing was removed (see issue #9).
// Mean-cosine centroids scored ~65% routing accuracy on this corpus while
// adding an embedding + full-table scan per turn, and unfiltered top-k
// retrieval matched or beat it on answers. Retrieval runs unfiltered;
// callers may still pass an explicit category.

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

export function isDegenerateFollowUp(content: string): boolean {
  const trimmed = content.trim().toLowerCase();
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  if (tokens.length <= 2) return true;
  if (BARE_FOLLOW_UPS.has(trimmed)) return true;
  if (/^(?:the|what about the) .+\b(one|app|project|site|thing)\b[?.!]*$/i.test(trimmed))
    return true;
  return false;
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

  if (prev && isDegenerateFollowUp(last)) {
    return { query: `${prev} ${last}`, routeText: last, merged: true };
  }

  return { query: last, routeText: last, merged: false };
}
// NOTE: centroid-based category routing was removed (see issue #9).
// Mean-cosine centroids scored ~65% routing accuracy on this corpus while
// adding an embedding + full-table scan per turn, and unfiltered top-k
// retrieval matched or beat it on answers (23/23). Retrieval runs
// unfiltered; callers may still pass an explicit category.

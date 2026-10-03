/**
 * Rich adaptive response schema + streaming-safe parser.
 *
 * Wire format (single LLM generation, no second call):
 *   <markdown answer>
 *   ```rich-ui
 *   {"blocks":[...],"followUps":[...]}
 *   ```
 *
 * The markdown streams progressively; the fenced JSON is hidden from the
 * text view and rendered as components only after it parses + validates.
 * Malformed / partial / unknown blocks fall back to plain text.
 */
import { z } from "zod";

// ---------------------------------------------------------------- schemas

const MAX_SHORT = 120;
const MAX_MED = 500;
const MAX_LONG = 4000;

const shortText = (max = MAX_SHORT) =>
  z.string().trim().min(1).max(max);
const medText = (max = MAX_MED) => z.string().trim().min(1).max(max);
const longText = (max = MAX_LONG) => z.string().trim().min(1).max(max);

export const MetricStatusSchema = z.enum([
  "neutral",
  "info",
  "success",
  "warning",
  "highlight",
]);
export type MetricStatus = z.infer<typeof MetricStatusSchema>;

export const MetricItemSchema = z.object({
  label: shortText(),
  value: shortText(60),
  unit: z.string().trim().max(24).nullish(),
  description: z.string().trim().max(240).nullish(),
  status: MetricStatusSchema.nullish(),
});
export type MetricItem = z.infer<typeof MetricItemSchema>;

export const MetricsBlockSchema = z.object({
  type: z.literal("metrics"),
  title: shortText().nullish(),
  items: z.array(MetricItemSchema).min(1).max(6),
});
export type MetricsBlock = z.infer<typeof MetricsBlockSchema>;

export const ChartTypeSchema = z.enum(["bar", "line", "pie", "donut"]);
export type ChartType = z.infer<typeof ChartTypeSchema>;

export const ChartBlockSchema = z.object({
  type: z.literal("chart"),
  chartType: ChartTypeSchema,
  title: shortText(),
  labels: z.array(shortText(48)).min(2).max(12),
  values: z.array(z.number().finite().min(-1e12).max(1e12)).min(2).max(12),
  unit: z.string().trim().max(24).nullish(),
});
export type ChartBlock = z.infer<typeof ChartBlockSchema>;

export const ProjectBlockSchema = z.object({
  type: z.literal("project"),
  title: shortText(),
  description: medText(1200),
  technologies: z.array(shortText(48)).min(1).max(16),
  highlights: z.array(medText(300)).min(1).max(8),
  metrics: z.array(MetricItemSchema).min(1).max(6).nullish(),
  url: z.string().trim().url().max(300).nullish(),
});
export type ProjectBlock = z.infer<typeof ProjectBlockSchema>;

export const TimelineEventSchema = z.object({
  date: z.string().trim().max(48).nullish(),
  title: shortText(),
  description: z.string().trim().max(500).nullish(),
  tag: z.string().trim().max(40).nullish(),
});
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

export const TimelineBlockSchema = z.object({
  type: z.literal("timeline"),
  title: shortText().nullish(),
  events: z.array(TimelineEventSchema).min(1).max(16),
});
export type TimelineBlock = z.infer<typeof TimelineBlockSchema>;

export const ComparisonRowSchema = z.object({
  label: shortText(80),
  values: z.array(medText(240)).min(1).max(6),
});
export type ComparisonRow = z.infer<typeof ComparisonRowSchema>;

export const ComparisonBlockSchema = z.object({
  type: z.literal("comparison"),
  title: shortText().nullish(),
  columns: z.array(shortText(64)).min(2).max(6),
  rows: z.array(ComparisonRowSchema).min(1).max(16),
});
export type ComparisonBlock = z.infer<typeof ComparisonBlockSchema>;

const SAFE_LANGUAGE_RE = /^[a-z0-9+#-]{1,24}$/i;
const SAFE_FILENAME_RE = /^[a-zA-Z0-9._\-/]{1,120}$/;

export const CodeBlockSchema = z.object({
  type: z.literal("code"),
  language: z
    .string()
    .trim()
    .min(1)
    .max(24)
    .refine((s) => SAFE_LANGUAGE_RE.test(s), { message: "unsafe language" }),
  filename: z
    .string()
    .trim()
    .max(120)
    .refine((s) => s === "" || SAFE_FILENAME_RE.test(s), {
      message: "unsafe filename",
    })
    .nullish(),
  code: longText(12000),
});
export type CodeBlock = z.infer<typeof CodeBlockSchema>;

const SAFE_NODE_ID_RE = /^[a-zA-Z0-9_-]{1,48}$/;

export const DiagramNodeSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(48)
    .refine((s) => SAFE_NODE_ID_RE.test(s), { message: "unsafe node id" }),
  label: shortText(80),
  detail: z.string().trim().max(200).nullish(),
});
export type DiagramNode = z.infer<typeof DiagramNodeSchema>;

export const DiagramEdgeSchema = z.object({
  from: z.string().trim().min(1).max(48),
  to: z.string().trim().min(1).max(48),
  label: z.string().trim().max(64).nullish(),
});
export type DiagramEdge = z.infer<typeof DiagramEdgeSchema>;

export const DiagramBlockSchema = z.object({
  type: z.literal("diagram"),
  title: shortText().nullish(),
  nodes: z.array(DiagramNodeSchema).min(2).max(12),
  edges: z.array(DiagramEdgeSchema).max(24).nullish(),
});
export type DiagramBlock = z.infer<typeof DiagramBlockSchema>;

export const TechBlockSchema = z.object({
  type: z.literal("tech"),
  title: shortText().nullish(),
  technologies: z.array(shortText(48)).min(1).max(24),
});
export type TechBlock = z.infer<typeof TechBlockSchema>;

export const DetailsBlockSchema = z.object({
  type: z.literal("details"),
  title: shortText(),
  content: longText(8000),
});
export type DetailsBlock = z.infer<typeof DetailsBlockSchema>;

export const FollowUpsBlockSchema = z.object({
  type: z.literal("followups"),
  questions: z.array(shortText(160)).min(1).max(5),
});
export type FollowUpsBlock = z.infer<typeof FollowUpsBlockSchema>;

/** Discriminated union — unknown block types are rejected, never executed. */
const ResponseBlockBase = z.discriminatedUnion("type", [
  MetricsBlockSchema,
  ChartBlockSchema,
  ProjectBlockSchema,
  TimelineBlockSchema,
  ComparisonBlockSchema,
  CodeBlockSchema,
  DiagramBlockSchema,
  TechBlockSchema,
  DetailsBlockSchema,
  FollowUpsBlockSchema,
]);

/**
 * Cross-field guards live here (not on the member schemas) because
 * discriminatedUnion members must be plain ZodObject literals — a .refine()
 * wrapper would break the union. Covers: chart label/value parity,
 * comparison row widths, diagram edge references.
 */
export const ResponseBlockSchema = ResponseBlockBase.superRefine((block, ctx) => {
  if (block.type === "chart" && block.labels.length !== block.values.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "chart labels and values must have equal length",
    });
  }
  if (
    block.type === "comparison" &&
    !block.rows.every((r) => r.values.length === block.columns.length - 1)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "each row must have columns.length - 1 values (first column is the label)",
    });
  }
  if (block.type === "diagram") {
    const ids = new Set(block.nodes.map((n) => n.id));
    if (!(block.edges ?? []).every((e) => ids.has(e.from) && ids.has(e.to))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "diagram edges must reference known node ids",
      });
    }
  }
});
export type ResponseBlock = z.infer<typeof ResponseBlockBase>;

export const RichPayloadSchema = z.object({
  version: z.literal(1).nullish(),
  blocks: z.array(z.unknown()).max(24).nullish().default([]),
  followUps: z.array(shortText(160)).max(5).nullish().default([]),
});
export type RichPayloadRaw = z.infer<typeof RichPayloadSchema>;

export interface ParsedRichResponse {
  /** Markdown answer with the rich-ui fence stripped. */
  text: string;
  /** Individually validated blocks (invalid ones dropped). */
  blocks: ResponseBlock[];
  /** Top-level follow-ups + any followups blocks, deduplicated. */
  followUps: string[];
  /** True when a fence was present but JSON was malformed/partial. */
  hadMalformed: boolean;
  /** Validation issues for observability (never shown raw to users). */
  errors: string[];
}

// ------------------------------------------------------------ wire parsing

/** Matches a closed ```rich-ui fence (case-insensitive tag variants). */
const RICH_FENCE_RE =
  /```\s*(?:rich-ui|richui|rich_ui)\s*\n([\s\S]*?)\n?\s*```/i;

/** Matches the *start* of a rich-ui fence, closed or not (streaming). */
const RICH_FENCE_START_RE = /```\s*(?:rich-ui|richui|rich_ui)\b/i;

function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/**
 * Forgiving pre-trim: oversized (but otherwise valid) blocks are trimmed to
 * schema caps instead of dropped, so a 27-technology skills answer still
 * renders badges. Only excess is ever removed — never padded or reshaped —
 * so genuinely malformed data (wrong types, missing fields, mismatched
 * chart parity) is still rejected by validation below.
 */
function preTrimBlock(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const b = { ...(raw as Record<string, unknown>) };
  const sliceArr = (k: string, n: number) => {
    if (Array.isArray(b[k])) b[k] = (b[k] as unknown[]).slice(0, n);
  };
  const sliceStr = (k: string, n: number) => {
    if (typeof b[k] === "string" && (b[k] as string).length > n)
      b[k] = (b[k] as string).slice(0, n);
  };
  switch (b.type) {
    case "metrics":
      sliceArr("items", 6);
      break;
    case "chart": {
      const labels = asArr(b.labels);
      const values = asArr(b.values);
      if (labels.length === values.length) {
        b.labels = labels.slice(0, 12);
        b.values = values.slice(0, 12);
      }
      break;
    }
    case "project":
      sliceArr("technologies", 16);
      sliceArr("highlights", 8);
      sliceArr("metrics", 6);
      sliceStr("description", 1200);
      break;
    case "timeline":
      sliceArr("events", 16);
      break;
    case "comparison": {
      const cols = asArr(b.columns).slice(0, 6);
      b.columns = cols;
      if (Array.isArray(b.rows)) {
        b.rows = (b.rows as unknown[]).slice(0, 16).map((r) => {
          if (!r || typeof r !== "object" || Array.isArray(r)) return r;
          const row = { ...(r as Record<string, unknown>) };
          if (Array.isArray(row.values) && row.values.length > Math.max(0, cols.length - 1))
            row.values = row.values.slice(0, Math.max(0, cols.length - 1));
          return row;
        });
      }
      break;
    }
    case "code":
      sliceStr("code", 12000);
      break;
    case "diagram": {
      const nodes = asArr(b.nodes).slice(0, 12);
      b.nodes = nodes;
      const ids = new Set(
        nodes.map((n) => (n as { id?: unknown } | null)?.id),
      );
      if (Array.isArray(b.edges)) {
        b.edges = (b.edges as unknown[])
          .filter(
            (e) =>
              e !== null &&
              typeof e === "object" &&
              ids.has((e as { from?: unknown }).from) &&
              ids.has((e as { to?: unknown }).to),
          )
          .slice(0, 24);
      }
      break;
    }
    case "tech":
      sliceArr("technologies", 24);
      break;
    case "details":
      sliceStr("content", 8000);
      break;
    case "followups":
      sliceArr("questions", 5);
      break;
    default:
      break;
  }
  return b;
}

function dedupeFollowUps(lists: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of lists.flat()) {
    const t = q.trim();
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
    if (out.length >= 5) break;
  }
  return out;
}

/**
 * Validate blocks individually so one bad block never kills the good ones.
 * Unknown `type` values are dropped (discriminated-union safety).
 */
export function sanitizeBlocks(input: unknown[]): {
  blocks: ResponseBlock[];
  errors: string[];
} {
  const blocks: ResponseBlock[] = [];
  const errors: string[] = [];
  for (const [i, raw] of input.entries()) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      errors.push(`block[${i}]: not an object`);
      continue;
    }
    const parsed = ResponseBlockSchema.safeParse(preTrimBlock(raw));
    if (parsed.success) {
      blocks.push(parsed.data);
    } else {
      errors.push(`block[${i}]: ${parsed.error.issues[0]?.message ?? "invalid"}`);
    }
  }
  return { blocks, errors };
}

function validateFollowUps(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((q): q is string => typeof q === "string")
    .map((q) => q.trim())
    .filter(Boolean)
    .slice(0, 5);
}

export function parseRichContent(content: string): ParsedRichResponse {
  const empty: ParsedRichResponse = {
    text: content,
    blocks: [],
    followUps: [],
    hadMalformed: false,
    errors: [],
  };
  if (!content || !RICH_FENCE_START_RE.test(content)) return empty;

  const match = RICH_FENCE_RE.exec(content);
  // Fence opened but not closed yet (streaming partial): hide the partial
  // fence + everything after it so users never see raw partial JSON.
  if (!match) {
    const idx = content.search(RICH_FENCE_START_RE);
    return {
      ...empty,
      text: content.slice(0, idx).trimEnd(),
      hadMalformed: false, // not malformed — just incomplete
    };
  }

  const text = (content.slice(0, match.index) + content.slice(match.index + match[0].length)).trim();
  const rawJson = match[1].trim();
  if (!rawJson) return { ...empty, text, hadMalformed: true, errors: ["empty rich-ui payload"] };

  let raw: unknown;
  try {
    raw = JSON.parse(rawJson);
  } catch {
    return { ...empty, text, hadMalformed: true, errors: ["rich-ui JSON parse error"] };
  }

  // Accept {blocks,followUps}, a bare array of blocks, or a bare single
  // block object (models sometimes emit the block directly). The `block`
  // singular key is accepted as well.
  const normalized = Array.isArray(raw)
    ? { blocks: raw }
    : raw !== null && typeof raw === "object" && "type" in raw && !("blocks" in raw)
      ? { blocks: [raw] }
      : (raw as Record<string, unknown>);
  if (
    normalized !== null &&
    typeof normalized === "object" &&
    !Array.isArray(normalized.blocks) &&
    normalized.blocks !== undefined &&
    typeof normalized.blocks === "object" &&
    normalized.blocks !== null &&
    "type" in (normalized.blocks as Record<string, unknown>)
  ) {
    normalized.blocks = [normalized.blocks];
  }
  if (
    normalized !== null &&
    typeof normalized === "object" &&
    "block" in normalized &&
    !("blocks" in normalized)
  ) {
    normalized.blocks = [normalized.block];
  }
  const top = RichPayloadSchema.safeParse(normalized);
  if (!top.success) {
    return { ...empty, text, hadMalformed: true, errors: ["rich-ui envelope invalid"] };
  }

  const { blocks: validBlocks, errors } = sanitizeBlocks(top.data.blocks ?? []);
  const blockFollowUps = validBlocks.flatMap((b) =>
    b.type === "followups" ? b.questions : [],
  );
  const blocks = validBlocks.filter((b) => b.type !== "followups");
  // Grounding guard: cap total visual blocks so a runaway generation cannot
  // flood the UI; text fallback always preserved. Sized for full project
  // listings (15 projects + supporting blocks).
  const capped = blocks.slice(0, 16);
  if (blocks.length > capped.length) errors.push("too many blocks; truncated");

  return {
    text,
    blocks: capped,
    followUps: dedupeFollowUps([validateFollowUps(top.data.followUps), blockFollowUps]),
    hadMalformed: errors.length > 0 && capped.length === 0,
    errors,
  };
}

/** Strip any (open or closed) rich-ui fence for the streaming text view. */
export function stripRichFenceForDisplay(content: string): string {
  if (!RICH_FENCE_START_RE.test(content)) return content;
  const closed = RICH_FENCE_RE.exec(content);
  if (closed) {
    return (content.slice(0, closed.index) + content.slice(closed.index + closed[0].length)).trim();
  }
  const idx = content.search(RICH_FENCE_START_RE);
  return content.slice(0, idx).trimEnd();
}

// ------------------------------------------------------- grounding helpers

/**
 * Heuristic grounding check used in tests/eval: reject numeric visualizations
 * whose values cannot be traced to the retrieved context. Client code passes
 * the retrieval context text; blocks with no numeric trace are dropped so
 * the UI falls back to plain text instead of rendering fabricated charts.
 */
export function dropUngroundedBlocks(
  blocks: ResponseBlock[],
  contextText: string | null | undefined,
): { blocks: ResponseBlock[]; dropped: number } {
  if (!contextText || !contextText.trim()) {
    // No context available client-side (sources are server-only): keep text
    // blocks' siblings but drop numeric visualizations to avoid fabrication.
    const kept = blocks.filter(
      (b) => b.type !== "chart" && b.type !== "metrics",
    );
    return { blocks: kept, dropped: blocks.length - kept.length };
  }
  const ctx = contextText.toLowerCase();
  const kept: ResponseBlock[] = [];
  let dropped = 0;
  for (const b of blocks) {
    if (b.type === "chart") {
      // Every label should appear (fuzzy: token overlap) in the context.
      const traced = b.labels.every((l) =>
        l
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter((t) => t.length > 2)
          .some((tok) => ctx.includes(tok)),
      );
      if (!traced) {
        dropped += 1;
        continue;
      }
    }
    if (b.type === "metrics") {
      const traced = b.items.every((m) =>
        ctx.includes(m.label.toLowerCase().slice(0, Math.min(8, m.label.length))),
      );
      if (!traced) {
        dropped += 1;
        continue;
      }
    }
    kept.push(b);
  }
  return { blocks: kept, dropped };
}

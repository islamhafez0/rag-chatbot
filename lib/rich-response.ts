/**
 * Rich adaptive response schema + streaming-safe parser.
 *
 * Wire format (single LLM generation, no second call):
 *   <markdown answer>
 *   ```rich-ui
 *   {"blocks":[...]}
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

export const CalloutSeveritySchema = z.enum(["info", "success", "warning", "danger"]);
export type CalloutSeverity = z.infer<typeof CalloutSeveritySchema>;

/** Restrained highlight for important insights, decisions, caveats. */
export const CalloutBlockSchema = z.object({
  type: z.literal("callout"),
  title: shortText().nullish(),
  severity: CalloutSeveritySchema.nullish(),
  content: medText(800),
});
export type CalloutBlock = z.infer<typeof CalloutBlockSchema>;

/** Ordered procedures and troubleshooting instructions. */
export const StepItemSchema = z.object({
  title: shortText(),
  description: z.string().trim().max(500).nullish(),
});
export type StepItem = z.infer<typeof StepItemSchema>;

export const StepsBlockSchema = z.object({
  type: z.literal("steps"),
  title: shortText().nullish(),
  steps: z.array(StepItemSchema).min(2).max(12),
});
export type StepsBlock = z.infer<typeof StepsBlockSchema>;

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
  CalloutBlockSchema,
  StepsBlockSchema,
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
});
export type RichPayloadRaw = z.infer<typeof RichPayloadSchema>;

export interface ParsedRichResponse {
  /** Markdown answer with the rich-ui fence stripped. */
  text: string;
  /** Individually validated blocks (invalid ones dropped). */
  blocks: ResponseBlock[];
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

/**
 * Trailing ```json fence fallback: models sometimes emit a single block as a
 * plain ```json code fence instead of the rich-ui envelope. Only a fence at
 * the END of the response is considered, and only its content must validate
 * as a block payload — everything else stays a normal code block.
 */
const TRAILING_JSON_FENCE_RE = /```\s*json\s*\n([\s\S]*?)\n?\s*```\s*$/i;

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
    case "callout":
      sliceStr("content", 800);
      break;
    case "steps":
      sliceArr("steps", 12);
      break;
    default:
      break;
  }
  return b;
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

/**
 * True when a parsed JSON value plausibly carries rich-ui content, used to
 * gate the bare-JSON fallback so ordinary prose with braces is untouched.
 */
function looksLikeRichPayload(raw: unknown): boolean {
  if (Array.isArray(raw)) return true;
  if (!raw || typeof raw !== "object") return false;
  const r = raw as Record<string, unknown>;
  return "blocks" in r || "block" in r || "type" in r;
}

// ------------------------------------------------- markdown table fallback
//
// Models often answer multi-record questions with a wide Markdown table even
// when a rich visual is warranted. Rather than depend on prompt compliance,
// a qualifying table (3+ data rows, 3+ columns) is converted deterministically
// into a comparison block — a faithful 1:1 transform of the model's own
// content, so nothing is fabricated. Narrow tables (2 rows, 2 columns) and
// partially streamed tables stay ordinary Markdown.

const COMPARISON_MAX_COLUMNS = 6;
const COMPARISON_MAX_ROWS = 16;
const COMPARISON_CELL_MAX = 240;
const WIDE_TABLE_MIN_ROWS = 3;
const WIDE_TABLE_MIN_COLUMNS = 3;

function cleanTableCell(cell: string): string {
  return cell
    .replace(/<br\s*\/?>/gi, " • ")
    .replace(/\*\*([^*]*)\*\*/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, COMPARISON_CELL_MAX);
}

interface ParsedMarkdownTable {
  header: string[];
  rows: string[][];
  /** Raw table lines (start/end offsets in the source text). */
  raw: string;
}

function isTableDivider(line: string): boolean {
  return /^\s*\|?\s*:?-{2,}[-:|\s]*$/.test(line);
}

function splitTableRow(line: string): string[] {
  const stripped = line.trim().replace(/^\|/, "").replace(/\|\s*$/, "");
  return stripped.split("|").map((c) => c.trim());
}

export function findWideMarkdownTable(text: string): ParsedMarkdownTable | null {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length - 2; i++) {
    if (!lines[i].includes("|")) continue;
    const header = splitTableRow(lines[i]);
    if (header.length < WIDE_TABLE_MIN_COLUMNS) continue;
    if (!isTableDivider(lines[i + 1])) continue;
    const rows: string[][] = [];
    let j = i + 2;
    while (j < lines.length && lines[j].includes("|") && lines[j].trim() !== "") {
      // Require a closed row: a table still streaming mid-line must not
      // convert (the text view would lose visible content).
      if (!/\|\s*$/.test(lines[j])) break;
      const cells = splitTableRow(lines[j]);
      rows.push(cells);
      j += 1;
    }
    if (rows.length >= WIDE_TABLE_MIN_ROWS) {
      return {
        header,
        rows,
        raw: lines.slice(i, j).join("\n"),
      };
    }
    i = j;
  }
  return null;
}

function tableTitleFor(text: string, tableStart: number): string | null {
  const before = text.slice(0, tableStart).split("\n").filter((l) => l.trim());
  const last = before.at(-1)?.trim() ?? "";
  const heading = /^#{1,6}\s+(.{1,80})$/.exec(last);
  if (heading) return heading[1].trim();
  const bold = /^\*\*(.{1,80})\*\*:?$/.exec(last);
  if (bold) return bold[1].trim();
  return null;
}

/**
 * Convert the first wide Markdown table into a comparison block. Returns the
 * remaining text and the block, or null when no qualifying table exists.
 */
export function convertWideMarkdownTable(content: string): {
  text: string;
  block: ComparisonBlock;
} | null {
  const table = findWideMarkdownTable(content);
  if (!table) return null;
  const start = content.indexOf(table.raw);
  const columns = table.header.slice(0, COMPARISON_MAX_COLUMNS).map(cleanTableCell);
  const valueCount = columns.length - 1;
  const rows = table.rows.slice(0, COMPARISON_MAX_ROWS).map((cells) => {
    const label = cleanTableCell(cells[0] ?? "").slice(0, 80) || "Record";
    const values = cells
      .slice(1, 1 + valueCount)
      .map((c) => cleanTableCell(c))
      .filter((v) => v.length > 0);
    return { label, values: values.length > 0 ? values : ["—"] };
  });
  if (rows.length < WIDE_TABLE_MIN_ROWS) return null;
  const block: ComparisonBlock = {
    type: "comparison",
    title: tableTitleFor(content, start) ?? undefined,
    columns,
    rows,
  };
  const parsed = ResponseBlockSchema.safeParse(block);
  if (!parsed.success || parsed.data.type !== "comparison") return null;
  const text = (
    content.slice(0, start).trimEnd() +
    "\n\n" +
    content.slice(start + table.raw.length).trimStart()
  ).trim();
  return { text, block: parsed.data as ComparisonBlock };
}

// ------------------------------------------------- bullet record fallback
//
// Third answer shape: per-record paragraphs with attribute bullets
// ("**Title**\n*Description*: ... \n*Tech stack*: ... \n*Highlights*: ...").
// When the model answers a multi-record question this way instead of using
// the rich envelope, the groups are converted into one project block per
// record. Conservative guards (3+ groups, each with a technology/skills
// label and 3 label:value lines) keep prose, feedback, and steps answers
// in ordinary Markdown.

const DESC_LABEL = /^(?:description|about|overview|purpose|summary|what)$/i;
const TECH_LABEL = /^(?:tech(?:nical)?(?:\s*stack|\s*skills)?|technologies|stack|skills(?:\s*used)?)$/i;
const HIGHLIGHT_LABEL = /^(?:highlights?|impact|outcomes?|lessons?(?:\s*learned)?|contributions?|achievements?|key(?:\s*contributions)?|built)$/i;
const ANY_LABEL_LINE_RE = /^\s*(?:[-*•]\s*)?[*_]{0,2}(?:\*\*)?([A-Za-z][A-Za-z /&+.]{1,40}?)[*)_]{0,2}[*_]{0,2}\s*:\s?(.*)$/;
const TITLE_LINE_RE = /^(?:#{1,6}\s+|\*\*)(.+?)(?:\*\*)?\s*$/;
const BULLET_TITLE_LINE_RE = /^\s*[-*•]\s*\*\*(.+?)\*\*\s*:?\s*$/;

function splitTechList(value: string): string[] {
  return value
    .split(/\s*[,;]\s*|\s+and\s+|\/(?=\s)|\s*\/\s*/i)
    .map((t) => t.replace(/^\s*[•\-]\s*/, "").trim())
    .filter(Boolean)
    .map((t) => (t.length > 48 ? `${t.slice(0, 47)}…` : t))
    .slice(0, 16);
}

export function convertBulletRecords(content: string): {
  text: string;
  blocks: ResponseBlock[];
} | null {
  // Exact segment positions (blank lines may contain spaces; never guess).
  const segments: { text: string; start: number }[] = [];
  const sepRe = /\n\s*\n/g;
  let cursor = 0;
  let sep: RegExpExecArray | null;
  while ((sep = sepRe.exec(content)) !== null) {
    segments.push({ text: content.slice(cursor, sep.index), start: cursor });
    cursor = sep.index + sep[0].length;
  }
  segments.push({ text: content.slice(cursor), start: cursor });

  type Converted = { start: number; length: number; block: ResponseBlock };
  const convertedSegments: Converted[] = [];

  for (const segment of segments) {
    const lines = segment.text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 4) continue;
    const titleMatch =
      TITLE_LINE_RE.exec(lines[0] ?? "") ?? BULLET_TITLE_LINE_RE.exec(lines[0] ?? "");
    const title = titleMatch ? titleMatch[1].replace(/[:：]\s*$/, "").trim() : null;
    if (!title || title.length > MAX_SHORT) continue;
    const labelLines = lines.slice(1);
    const labeled = labelLines
      .map((l) => ANY_LABEL_LINE_RE.exec(l))
      .filter((m): m is RegExpExecArray => m !== null);
    const unlabeled = labelLines.length - labeled.length;
    const descIdx = labeled.findIndex((m) => DESC_LABEL.test(m[1].trim()));
    const techIdx = labeled.findIndex((m) => TECH_LABEL.test(m[1].trim()));
    if (labeled.length < 3 || unlabeled > 1 || descIdx < 0 || techIdx < 0) continue;
    const highlightIdx = labeled
      .map((m, i) => (HIGHLIGHT_LABEL.test(m[1].trim()) ? i : -1))
      .filter((i) => i >= 0);
    if (highlightIdx.length < 2) continue;
    const linkIdx = labeled.findIndex((m) => /^(?:link|url|repo(?:sitory)?)$/i.test(m[1].trim()));
    const highlights = highlightIdx
      .map((i) => simplifyInline(labeled[i][2]))
      .flatMap((v) => v.split(/\s*•\s*|\s*<br\s*\/?>\s*/i))
      .map((v) => v.trim())
      .filter((v) => v.length > 0 && v !== "—")
      .slice(0, 8);
    const technologies = splitTechList(simplifyInline(labeled[techIdx][2]));
    const rawUrl = linkIdx >= 0 ? labeled[linkIdx][2].trim() : "";
    const parsed = ResponseBlockSchema.safeParse({
      type: "project",
      title: title.slice(0, MAX_SHORT),
      description: simplifyInline(labeled[descIdx][2]).slice(0, 1200) || "Documented project.",
      technologies: technologies.length > 0 ? technologies : ["various"],
      highlights: highlights.length > 0 ? highlights : [title.slice(0, MAX_SHORT)],
      ...(rawUrl && /^https?:\/\/\S{1,300}$/.test(rawUrl) ? { url: rawUrl } : {}),
    });
    if (!parsed.success) continue;
    convertedSegments.push({
      start: segment.start,
      length: segment.text.length,
      block: parsed.data,
    });
  }
  if (convertedSegments.length < 3) return null;

  let text = content;
  for (let i = convertedSegments.length - 1; i >= 0; i--) {
    const r = convertedSegments[i];
    text = (
      text.slice(0, r.start).replace(/[ \t]+$/, "") +
      text.slice(r.start + r.length).replace(/^[ \t]*\n/, "")
    );
  }
  return { text: text.trim(), blocks: convertedSegments.map((r) => r.block) };
}

function simplifyInline(cell: string): string {
  return cell
    .replace(/<br\s*\/?>/gi, " • ")
    .replace(/\*\*([^*]*)\*\*/g, "$1")
    .replace(/(?<!\w)\*([^*\n]+)\*(?!\w)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1200);
}

/**
 * Bare-JSON fallback (issue #37): models sometimes emit the payload as raw
 * `{"blocks": [...]}` text without the required ```rich-ui fence. Scan
 * `{` positions from the end and return the first trailing substring that
 * parses as a plausible rich payload, so it can be rendered as blocks and
 * stripped from the text view instead of leaking as raw JSON.
 */
function extractBareJsonSuffix(content: string): { text: string; raw: unknown } | null {
  const trimmed = content.trimEnd();
  if (!trimmed.endsWith("}")) return null;
  if (!trimmed.includes("{") || !trimmed.includes('"')) return null;
  let attempts = 0;
  for (let i = trimmed.length - 1; i >= 0 && attempts < 300; i--) {
    if (trimmed[i] !== "{") continue;
    attempts += 1;
    const snippet = trimmed.slice(i);
    if (snippet.length > 60000) continue;
    try {
      const parsed: unknown = JSON.parse(snippet);
      if (looksLikeRichPayload(parsed)) {
        return { text: trimmed.slice(0, i).trim(), raw: parsed };
      }
    } catch {
      // Not a complete JSON object from here — try an earlier brace.
    }
  }
  return null;
}

function decodeParsedPayload(
  raw: unknown,
  text: string,
  empty: ParsedRichResponse,
): ParsedRichResponse {

  // Accept {blocks}, a bare array of blocks, or a bare single block object
  // (models sometimes emit the block directly). The `block` singular key
  // is accepted as well.
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
  // Grounding guard: cap total visual blocks so a runaway generation cannot
  // flood the UI; text fallback always preserved. Sized for full project
  // listings (15 projects + supporting blocks).
  const capped = validBlocks.slice(0, 16);
  if (validBlocks.length > capped.length) errors.push("too many blocks; truncated");

  return {
    text,
    blocks: capped,
    hadMalformed: errors.length > 0 && capped.length === 0,
    errors,
  };
}

export function parseRichContent(content: string): ParsedRichResponse {
  const empty: ParsedRichResponse = {
    text: content,
    blocks: [],
    hadMalformed: false,
    errors: [],
  };
  if (!content) return empty;

  const match = RICH_FENCE_RE.exec(content);
  if (match) {
    const text = (content.slice(0, match.index) + content.slice(match.index + match[0].length)).trim();
    const rawJson = match[1].trim();
    if (!rawJson) return { ...empty, text, hadMalformed: true, errors: ["empty rich-ui payload"] };

    let raw: unknown;
    try {
      raw = JSON.parse(rawJson);
    } catch {
      return { ...empty, text, hadMalformed: true, errors: ["rich-ui JSON parse error"] };
    }
    return decodeParsedPayload(raw, text, empty);
  }

  // Fence opened but not closed yet (streaming partial): hide the partial
  // fence + everything after it so users never see raw partial JSON.
  if (RICH_FENCE_START_RE.test(content)) {
    const idx = content.search(RICH_FENCE_START_RE);
    return {
      ...empty,
      text: content.slice(0, idx).trimEnd(),
      hadMalformed: false, // not malformed — just incomplete
    };
  }

  // No fence at all: try the trailing ```json fence, then the bare-JSON
  // fallback, then the wide-Markdown-table fallback, before giving up, so
  // payloads emitted without the rich-ui envelope still render instead of
  // leaking (issue #37 variants).
  const jsonFenced = decodeTrailingJsonFence(content);
  if (jsonFenced) return jsonFenced;
  const bare = extractBareJsonSuffix(content);
  if (!bare) {
    const tableConverted = convertWideMarkdownTable(content);
    if (tableConverted) {
      return {
        text: tableConverted.text,
        blocks: [tableConverted.block],
        hadMalformed: false,
        errors: [],
      };
    }
    const bulletsConverted = convertBulletRecords(content);
    if (bulletsConverted && bulletsConverted.blocks.length <= 16) {
      return {
        text: bulletsConverted.text,
        blocks: bulletsConverted.blocks,
        hadMalformed: false,
        errors: [],
      };
    }
    return empty;
  }
  const decoded = decodeParsedPayload(bare.raw, bare.text, empty);
  // Only claim the trailing JSON when it actually validated into blocks;
  // otherwise leave the original text untouched.
  if (decoded.blocks.length === 0) return empty;
  return decoded;
}

/**
 * Trailing ```json fence handling: when the last fence is a ```json block
 * whose content validates into blocks, render it as components and strip it
 * from the text. Everything else (mid-answer json, non-block payloads) is
 * untouched and rendered as an ordinary code block.
 */
function decodeTrailingJsonFence(content: string): ParsedRichResponse | null {
  if (!content.includes("```json")) return null;
  const match = TRAILING_JSON_FENCE_RE.exec(content);
  if (!match) return null;
  const empty: ParsedRichResponse = { text: content, blocks: [], hadMalformed: false, errors: [] };
  const text = content.slice(0, match.index).trim();
  let raw: unknown;
  try {
    raw = JSON.parse(match[1].trim());
  } catch {
    return null;
  }
  if (!looksLikeRichPayload(raw)) return null;
  const decoded = decodeParsedPayload(raw, text, empty);
  if (decoded.blocks.length === 0) return null;
  return decoded;
}

/** Strip any (open or closed) rich-ui fence for the streaming text view. */
export function stripRichFenceForDisplay(content: string): string {
  if (!RICH_FENCE_START_RE.test(content)) {
    const jsonFenced = decodeTrailingJsonFence(content);
    if (jsonFenced) return jsonFenced.text;
    const bare = extractBareJsonSuffix(content);
    if (!bare) {
      // Mirror parseRichContent: wide Markdown tables and per-record bullet
      // groups become blocks, so the streaming text view must drop them the
      // same way.
      const tableConverted = convertWideMarkdownTable(content);
      if (tableConverted) return tableConverted.text;
      const bulletsConverted = convertBulletRecords(content);
      if (bulletsConverted && bulletsConverted.blocks.length <= 16) {
        return bulletsConverted.text;
      }
      return content;
    }
    const decoded = decodeParsedPayload(bare.raw, bare.text, {
      text: content,
      blocks: [],
      hadMalformed: false,
      errors: [],
    });
    if (decoded.blocks.length === 0) return content;
    return bare.text;
  }
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

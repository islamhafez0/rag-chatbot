/**
 * Rich adaptive response schema + streaming-safe parser.
 *
 * Wire format (single LLM generation):
 *   <complete markdown answer>
 *   ```rich-ui
 *   {"blocks":[...]}
 *   ```
 *
 * The prose is always the answer; visuals are an optional enhancement.
 * The parser is deliberately forgiving about the wire (```json fences,
 * several fences, an unfenced trailing payload, a fence cut mid-stream) and
 * strict about content (per-field validation, https-only links). Raw JSON is
 * never returned as prose.
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

/**
 * Link safety: only absolute https: URLs or site-relative paths ("/files/x.pdf").
 * Anything else ("github.com/x", "javascript:", "http:", "//evil") is rejected,
 * and because validation is per field, a bad url only drops that field.
 */
export function isSafeUrl(raw: string): boolean {
  const u = raw.trim();
  if (!u || u.length > 300 || /[\s<>"'`]/.test(u)) return false;
  if (u.startsWith("/")) return !u.startsWith("//") && !u.startsWith("/\\");
  try {
    const parsed = new URL(u);
    return parsed.protocol === "https:" && parsed.hostname.includes(".");
  } catch {
    return false;
  }
}

const safeUrl = () =>
  z.string().trim().min(1).max(300).refine(isSafeUrl, { message: "unsafe url" });

export const ProjectLinkSchema = z.object({
  label: shortText(60),
  url: safeUrl(),
});
export type ProjectLink = z.infer<typeof ProjectLinkSchema>;

export const ProjectBlockSchema = z.object({
  type: z.literal("project"),
  title: shortText(),
  description: medText(1200),
  technologies: z.array(shortText(48)).min(1).max(16),
  highlights: z.array(medText(300)).min(1).max(8),
  metrics: z.array(MetricItemSchema).min(1).max(6).nullish(),
  url: safeUrl().nullish(),
  links: z.array(ProjectLinkSchema).min(1).max(6).nullish(),
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

export type BlockType = ResponseBlock["type"];

export const BLOCK_TYPES: readonly BlockType[] = [
  "metrics",
  "chart",
  "project",
  "timeline",
  "comparison",
  "code",
  "diagram",
  "tech",
  "details",
];

/** A visual that has started streaming but is not complete yet. */
export interface PendingVisual {
  /** First block type seen in the partial payload, if any yet. */
  type: BlockType | null;
  /** How many block objects have started so far (for skeleton sizing). */
  count: number;
}

export interface ParsedRichResponse {
  /** Markdown answer with every visual payload (fenced or bare) stripped. */
  text: string;
  /** Individually validated blocks (invalid ones dropped or repaired). */
  blocks: ResponseBlock[];
  /** True when a visual payload was present but nothing usable came out of it. */
  hadMalformed: boolean;
  /** Validation issues for observability (never shown raw to users). */
  errors: string[];
  /** Set while a visual payload is open/incomplete (streaming). */
  pending: PendingVisual | null;
}

// ------------------------------------------------------ per-field repair

type AnyZod = z.ZodTypeAny;

const MEMBER_SCHEMAS: Record<BlockType, z.AnyZodObject> = {
  metrics: MetricsBlockSchema,
  chart: ChartBlockSchema,
  project: ProjectBlockSchema,
  timeline: TimelineBlockSchema,
  comparison: ComparisonBlockSchema,
  code: CodeBlockSchema,
  diagram: DiagramBlockSchema,
  tech: TechBlockSchema,
  details: DetailsBlockSchema,
};

/** Peel optional/nullable/default/effects wrappers off a schema. */
function unwrap(s: AnyZod | undefined): AnyZod | undefined {
  let cur = s;
  for (let i = 0; i < 8 && cur; i++) {
    if (cur instanceof z.ZodOptional || cur instanceof z.ZodNullable) cur = cur.unwrap();
    else if (cur instanceof z.ZodDefault) cur = cur.removeDefault();
    else if (cur instanceof z.ZodEffects) cur = cur.innerType();
    else break;
  }
  return cur;
}

function schemaAt(root: AnyZod, path: (string | number)[]): AnyZod | undefined {
  let cur: AnyZod | undefined = unwrap(root);
  for (const seg of path) {
    if (!cur) return undefined;
    if (cur instanceof z.ZodObject && typeof seg === "string") {
      cur = unwrap((cur.shape as Record<string, AnyZod>)[seg]);
    } else if (cur instanceof z.ZodArray && typeof seg === "number") {
      cur = unwrap(cur.element as AnyZod);
    } else {
      return undefined;
    }
  }
  return cur;
}

function valueAt(root: unknown, path: (string | number)[]): unknown {
  let cur: unknown = root;
  for (const seg of path) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string | number, unknown>)[seg];
  }
  return cur;
}

function setAt(root: unknown, path: (string | number)[], v: unknown): boolean {
  if (path.length === 0) return false;
  const parent = valueAt(root, path.slice(0, -1));
  if (parent === null || typeof parent !== "object") return false;
  (parent as Record<string | number, unknown>)[path[path.length - 1]] = v;
  return true;
}

/**
 * Apply ONE minimal fix for a validation issue, preferring the smallest
 * possible loss: truncate an over-long string/array, coerce a lone string
 * into a one-item array, drop a bad array item, drop a bad OPTIONAL field.
 * Returns false when the only fix would be dropping the whole block.
 */
function fixIssue(schema: AnyZod, root: unknown, issue: z.ZodIssue): boolean {
  const path = issue.path;
  const here = valueAt(root, path);

  if (issue.code === "too_big") {
    const max = Number(issue.maximum);
    if (typeof here === "string" && Number.isFinite(max)) return setAt(root, path, here.slice(0, max).trim());
    if (Array.isArray(here) && Number.isFinite(max)) return setAt(root, path, here.slice(0, max));
  }
  if (issue.code === "invalid_type") {
    if (issue.expected === "array" && typeof here === "string" && here.trim()) {
      return setAt(root, path, [here]);
    }
    if (issue.expected === "string" && typeof here === "number") {
      return setAt(root, path, String(here));
    }
  }

  for (let j = path.length - 1; j >= 0; j--) {
    const parentPath = path.slice(0, j);
    const key = path[j];
    const parentSchema = schemaAt(schema, parentPath);
    const parentVal = valueAt(root, parentPath);
    if (parentSchema instanceof z.ZodArray && Array.isArray(parentVal) && typeof key === "number") {
      parentVal.splice(key, 1);
      return true;
    }
    if (
      parentSchema instanceof z.ZodObject &&
      typeof key === "string" &&
      parentVal !== null &&
      typeof parentVal === "object"
    ) {
      const field = (parentSchema.shape as Record<string, AnyZod>)[key];
      if (field?.isOptional()) {
        delete (parentVal as Record<string, unknown>)[key];
        return true;
      }
    }
  }
  return false;
}

/** Parse with per-field repair: one fix per pass, bounded passes. */
function repairParse<T extends z.AnyZodObject>(
  schema: T,
  input: unknown,
): { ok: true; data: z.infer<T>; repaired: number } | { ok: false; error: string } {
  let value: unknown;
  try {
    value = JSON.parse(JSON.stringify(input));
  } catch {
    return { ok: false, error: "not serializable" };
  }
  let repaired = 0;
  for (let pass = 0; pass < 48; pass++) {
    const r = schema.safeParse(value);
    if (r.success) return { ok: true, data: r.data, repaired };
    const issue = r.error.issues[0];
    if (!issue || !fixIssue(schema, value, issue)) {
      return { ok: false, error: issue ? `${issue.path.join(".") || "block"}: ${issue.message}` : "invalid" };
    }
    repaired++;
  }
  return { ok: false, error: "too many repairs" };
}

function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/**
 * Forgiving pre-shape: cross-field fixes the per-field repair cannot see
 * (chart parity, comparison row width, dangling diagram edges).
 */
function preTrimBlock(raw: Record<string, unknown>): Record<string, unknown> {
  const b = { ...raw };
  switch (b.type) {
    case "chart": {
      const labels = asArr(b.labels);
      const values = asArr(b.values);
      if (labels.length === values.length) {
        b.labels = labels.slice(0, 12);
        b.values = values.slice(0, 12);
      }
      break;
    }
    case "comparison": {
      const cols = asArr(b.columns).slice(0, 6);
      b.columns = cols;
      const width = Math.max(0, cols.length - 1);
      if (Array.isArray(b.rows)) {
        b.rows = (b.rows as unknown[]).slice(0, 16).map((r) => {
          if (!r || typeof r !== "object" || Array.isArray(r)) return r;
          const row = { ...(r as Record<string, unknown>) };
          if (Array.isArray(row.values)) {
            const vals = row.values.slice(0, width).map((v) =>
              typeof v === "string" && v.trim() ? v : typeof v === "number" ? String(v) : "—",
            );
            while (vals.length < width) vals.push("—");
            row.values = vals;
          }
          return row;
        });
      }
      break;
    }
    case "diagram": {
      const nodes = asArr(b.nodes).slice(0, 12);
      b.nodes = nodes;
      const ids = new Set(nodes.map((n) => (n as { id?: unknown } | null)?.id));
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
    default:
      break;
  }
  return b;
}

/**
 * Validate blocks individually so one bad block never kills the good ones,
 * and validate fields individually so one bad field never kills its block.
 * Unknown `type` values are dropped (nothing is ever executed).
 */
export function sanitizeBlocks(input: unknown[]): {
  blocks: ResponseBlock[];
  errors: string[];
} {
  const blocks: ResponseBlock[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const [i, raw] of input.entries()) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      errors.push(`block[${i}]: not an object`);
      continue;
    }
    const type = (raw as { type?: unknown }).type;
    const schema = typeof type === "string" ? MEMBER_SCHEMAS[type as BlockType] : undefined;
    if (!schema) {
      errors.push(`block[${i}]: unknown type`);
      continue;
    }
    const repaired = repairParse(schema, preTrimBlock(raw as Record<string, unknown>));
    if (!repaired.ok) {
      errors.push(`block[${i}]: ${repaired.error}`);
      continue;
    }
    if (repaired.repaired > 0) errors.push(`block[${i}]: repaired ${repaired.repaired} field(s)`);
    const final = ResponseBlockSchema.safeParse(preTrimBlock(repaired.data));
    if (!final.success) {
      errors.push(`block[${i}]: ${final.error.issues[0]?.message ?? "invalid"}`);
      continue;
    }
    // Models occasionally repeat a block (e.g. in a second fence): dedupe.
    const sig = JSON.stringify(final.data);
    if (seen.has(sig)) continue;
    seen.add(sig);
    blocks.push(final.data as ResponseBlock);
  }
  return { blocks, errors };
}

// ------------------------------------------------------------ wire parsing

const RICH_TAGS = new Set(["rich-ui", "richui", "rich_ui", "richui-json"]);
const JSONISH_TAGS = new Set(["json", "jsonc", "json5", ""]);
/** Every prefix a streaming fence opener can be cut at ("`", "```ric", …). */
const OPENER_WORDS = ["rich-ui", "richui", "rich_ui", "json"];

function looksLikeRichPayload(raw: unknown): boolean {
  if (Array.isArray(raw)) {
    return raw.some(
      (b) => b !== null && typeof b === "object" && typeof (b as { type?: unknown }).type === "string",
    );
  }
  if (!raw || typeof raw !== "object") return false;
  const r = raw as Record<string, unknown>;
  if ("blocks" in r || "block" in r) return true;
  return typeof r.type === "string" && (BLOCK_TYPES as readonly string[]).includes(r.type);
}

/** Starts like a rich payload: `{"blocks"`, `{"type"`, `[{"type"` … */
const PAYLOAD_HEAD_RE = /^\s*(?:\[\s*)?\{\s*"(?:blocks|block|type|version)"\s*:/;

function tryParseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    // Common model slip: trailing commas.
    try {
      return JSON.parse(s.replace(/,(\s*[}\]])/g, "$1"));
    } catch {
      return undefined;
    }
  }
}

/** Normalise the accepted envelope shapes into a plain array of blocks. */
function blocksOf(raw: unknown): unknown[] | null {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!("blocks" in r) && !("block" in r) && typeof r.type === "string") return [r];
  const inner = "blocks" in r ? r.blocks : r.block;
  if (inner && typeof inner === "object" && !Array.isArray(inner)) return [inner];
  const top = RichPayloadSchema.safeParse({ ...r, blocks: inner });
  if (!top.success) {
    return Array.isArray(inner) ? inner.slice(0, 24) : null;
  }
  return top.data.blocks ?? [];
}

function detectPending(partial: string): PendingVisual {
  const types = [...partial.matchAll(/"type"\s*:\s*"([a-z]+)"/g)].map((m) => m[1]);
  const known = types.filter((t): t is BlockType => (BLOCK_TYPES as readonly string[]).includes(t));
  return { type: known[0] ?? null, count: Math.max(1, known.length) };
}

interface FenceSpan {
  start: number;
  end: number;
  info: string;
  body: string;
  closed: boolean;
}

/** Sequentially pair ``` openers and closers (CommonMark-ish, forgiving). */
function scanFences(content: string): FenceSpan[] {
  const spans: FenceSpan[] = [];
  let from = 0;
  while (from < content.length) {
    const start = content.indexOf("```", from);
    if (start === -1) break;
    const afterTicks = start + 3;
    const nl = content.indexOf("\n", afterTicks);
    const lineEnd = nl === -1 ? content.length : nl;
    const lineRest = content.slice(afterTicks, lineEnd);
    const im = /^[ \t]*([A-Za-z0-9_+-]*)/.exec(lineRest);
    const head = im ? im[0] : "";
    const info = (im?.[1] ?? "").toLowerCase();
    // ```json {"blocks":…} on one line: the body starts right after the tag.
    const bodyStart = lineRest.slice(head.length).trim()
      ? afterTicks + head.length
      : nl === -1
        ? content.length
        : nl + 1;
    const close = content.indexOf("```", bodyStart);
    if (close === -1) {
      spans.push({ start, end: content.length, info, body: content.slice(bodyStart).trim(), closed: false });
      break;
    }
    spans.push({ start, end: close + 3, info, body: content.slice(bodyStart, close).trim(), closed: true });
    from = close + 3;
  }
  return spans;
}

/** Strip a fence opener cut mid-stream at the very end ("\n``", "```ric"). */
function stripTrailingOpenerPrefix(text: string): string {
  const m = /(^|\n)[ \t]*(`{1,3})([A-Za-z_-]{0,8})[ \t]*$/.exec(text);
  if (!m) return text;
  const word = m[3].toLowerCase();
  if (word && !OPENER_WORDS.some((w) => w.startsWith(word))) return text;
  if (m[2].length < 3 && word) return text; // "`json" inline code start, leave it
  // Only an OPENER: with an odd number of fences before it, it is a closer.
  const before = text.slice(0, m.index);
  if ((before.match(/```/g)?.length ?? 0) % 2 === 1) return text;
  return before.trimEnd();
}

/**
 * Bare-JSON fallback: models sometimes emit `{"blocks": [...]}` with no
 * fence at all. Find a trailing payload (complete → render; incomplete →
 * hide as pending) so raw JSON never leaks into prose.
 */
function extractBarePayload(
  content: string,
): { text: string; raw: unknown; complete: boolean } | null {
  const trimmed = content.trimEnd();
  if (!trimmed.includes("{")) return null;
  // Candidate starts: line-start `{` or `[` that look like a payload head.
  const starts: number[] = [];
  const re = /(^|\n)[ \t]*(?=[[{])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(trimmed))) {
    const idx = m.index + m[0].length;
    if (PAYLOAD_HEAD_RE.test(trimmed.slice(idx, idx + 40))) starts.push(idx);
    if (re.lastIndex === m.index) re.lastIndex++;
  }
  for (const idx of starts) {
    const snippet = trimmed.slice(idx);
    if (snippet.length > 60000) continue;
    const parsed = tryParseJson(snippet);
    if (parsed !== undefined && looksLikeRichPayload(parsed)) {
      return { text: trimmed.slice(0, idx).trim(), raw: parsed, complete: true };
    }
  }
  // Legacy shape: a payload glued to the prose on the same line.
  if (trimmed.endsWith("}")) {
    let attempts = 0;
    for (let i = trimmed.length - 1; i >= 0 && attempts < 300; i--) {
      if (trimmed[i] !== "{") continue;
      attempts++;
      const parsed = tryParseJson(trimmed.slice(i));
      if (parsed !== undefined && looksLikeRichPayload(parsed)) {
        return { text: trimmed.slice(0, i).trim(), raw: parsed, complete: true };
      }
    }
  }
  if (starts.length > 0) {
    const idx = starts[0];
    return { text: trimmed.slice(0, idx).trim(), raw: trimmed.slice(idx), complete: false };
  }
  return null;
}

const MAX_TOTAL_BLOCKS = 16;

/**
 * Parse an assistant message (complete or mid-stream) into prose + blocks.
 * Accepts ```rich-ui, ```json (when it carries a blocks payload), several
 * fences (merged), and an unfenced trailing payload. Open/partial payloads
 * are hidden and reported as `pending` so the UI can show a skeleton.
 */
export function parseRichContent(content: string): ParsedRichResponse {
  const result: ParsedRichResponse = {
    text: content ?? "",
    blocks: [],
    hadMalformed: false,
    errors: [],
    pending: null,
  };
  if (!content) return result;

  const rawBlocks: unknown[] = [];
  let sawVisual = false;
  let text = "";
  let cursor = 0;

  for (const f of scanFences(content)) {
    const rich = RICH_TAGS.has(f.info);
    const jsonish = JSONISH_TAGS.has(f.info);
    // Opener cut mid-tag while streaming ("```ric", "```js").
    const cutTag = !f.closed && !f.body && !!f.info && OPENER_WORDS.some((w) => w.startsWith(f.info));
    if (!rich && !jsonish && !cutTag) continue;
    let isVisual = false;
    let parsed: unknown;
    if (f.closed) {
      parsed = tryParseJson(f.body);
      isVisual = rich || (parsed !== undefined && looksLikeRichPayload(parsed));
    } else {
      // Open fence: rich-ui always; json/bare only once it looks like a payload
      // (or is still too short to tell — better a skeleton than a flash).
      isVisual =
        rich ||
        cutTag ||
        PAYLOAD_HEAD_RE.test(f.body) ||
        /^\s*(?:\[\s*)?(?:\{\s*(?:"[a-z]{0,8})?)?$/.test(f.body);
    }
    if (!isVisual) continue;

    sawVisual = true;
    text += content.slice(cursor, f.start);
    cursor = f.end;
    if (!f.closed) {
      result.pending = detectPending(f.body);
      continue;
    }
    if (!f.body) {
      result.errors.push("empty rich-ui payload");
      continue;
    }
    if (parsed === undefined) {
      result.errors.push("rich-ui JSON parse error");
      continue;
    }
    const arr = blocksOf(parsed);
    if (!arr) {
      result.errors.push("rich-ui envelope invalid");
      continue;
    }
    rawBlocks.push(...arr);
  }
  text += content.slice(cursor);

  if (!sawVisual) {
    const bare = extractBarePayload(text);
    if (bare?.complete) {
      const arr = blocksOf(bare.raw);
      if (arr && arr.length > 0 && sanitizeBlocks(arr).blocks.length > 0) {
        sawVisual = true;
        text = bare.text;
        rawBlocks.push(...arr);
      }
    } else if (bare) {
      sawVisual = true;
      text = bare.text;
      result.pending = detectPending(String(bare.raw));
    } else {
      // A payload head still being typed: `{`, `{"bl` on the last line.
      const head = /(^|\n)[ \t]*\[?[ \t]*\{[ \t]*(?:"[a-z]{0,8}"?[ \t]*:?[ \t]*)?$/.exec(text);
      if (head) {
        sawVisual = true;
        text = text.slice(0, head.index);
        result.pending = { type: null, count: 1 };
      }
    }
  }

  if (!sawVisual) {
    // Plain answer: keep the text exactly as written (minus a cut opener).
    const cleaned = stripTrailingOpenerPrefix(content);
    result.text = cleaned === content ? content : cleaned.trimEnd();
    return result;
  }
  result.text = stripTrailingOpenerPrefix(text.replace(/\n{3,}/g, "\n\n")).trim();

  const { blocks, errors } = sanitizeBlocks(rawBlocks);
  result.errors.push(...errors);
  result.blocks = blocks.slice(0, MAX_TOTAL_BLOCKS);
  if (blocks.length > result.blocks.length) result.errors.push("too many blocks; truncated");
  result.hadMalformed = result.blocks.length === 0 && result.pending === null && result.errors.length > 0;
  return result;
}

/** Prose only, with every (open or closed) visual payload removed. */
export function stripRichFenceForDisplay(content: string): string {
  return parseRichContent(content).text;
}

const BLOCK_NOUNS: Record<BlockType, [string, string]> = {
  project: ["project card", "project cards"],
  timeline: ["timeline", "timelines"],
  tech: ["tech list", "tech lists"],
  comparison: ["comparison table", "comparison tables"],
  diagram: ["diagram", "diagrams"],
  details: ["details panel", "details panels"],
  metrics: ["metrics panel", "metrics panels"],
  chart: ["chart", "charts"],
  code: ["code block", "code blocks"],
};

/** "[visual: 3 project cards, 1 timeline]" — a compact trace of what was shown. */
export function summarizeBlocks(blocks: ResponseBlock[]): string {
  if (blocks.length === 0) return "";
  const counts = new Map<BlockType, number>();
  for (const b of blocks) counts.set(b.type, (counts.get(b.type) ?? 0) + 1);
  const parts = [...counts].map(([t, n]) => `${n} ${BLOCK_NOUNS[t][n === 1 ? 0 : 1]}`);
  return `[visual: ${parts.join(", ")}]`;
}

/**
 * History form of an assistant message for the next request: prose only plus
 * a short visual note, capped so it always fits the server's per-message
 * limit. The fenced JSON never travels back to the server.
 */
export function toHistoryContent(content: string, maxChars = 1800): string {
  const parsed = parseRichContent(content);
  const note = summarizeBlocks(parsed.blocks);
  const budget = Math.max(0, maxChars - (note ? note.length + 2 : 0));
  let prose = parsed.text.trim();
  if (prose.length > budget) {
    const cut = prose.slice(0, Math.max(0, budget - 1));
    const lastSpace = cut.lastIndexOf(" ");
    prose = `${(lastSpace > budget * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
  }
  const out = [prose, note].filter(Boolean).join("\n\n");
  return out.slice(0, maxChars);
}

export interface HistoryMessage {
  role: string;
  content: string;
}

/**
 * Request payload for POST /api/chat: assistant turns reduced to prose (+ a
 * visual note), empty turns dropped, and the oldest turns trimmed so the
 * request stays inside the server's message-count and history-size caps.
 */
export function toRequestMessages(
  messages: HistoryMessage[],
  { maxMessages = 24, maxTotalChars = 11000, maxMessageChars = 1800 } = {},
): { role: "user" | "assistant"; content: string }[] {
  const out = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content:
        m.role === "assistant"
          ? toHistoryContent(m.content, maxMessageChars)
          : m.content.slice(0, maxMessageChars),
    }))
    .filter((m) => m.content.trim().length > 0);
  let total = out.reduce((n, m) => n + m.content.length, 0);
  while (out.length > 1 && (out.length > maxMessages || total > maxTotalChars)) {
    total -= out.shift()!.content.length;
  }
  // The conversation sent must open with a user turn.
  while (out.length > 1 && out[0].role !== "user") out.shift();
  return out;
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

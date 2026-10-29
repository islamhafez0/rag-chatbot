/**
 * Entry-preserving YAML chunking for ingestion.
 *
 * Each YAML file yields one chunk per logical entry (a role, a project, a
 * photo, an interview answer, ...) instead of one JSON blob that is then
 * split mid-field by a character splitter. Every chunk keeps its field
 * labels ("Company: TaqaTechno") so embeddings carry semantic structure.
 */

export interface YamlDocMeta {
  source: string;
  category: string;
  type: string;
  title: string;
}

export interface EntryChunk {
  text: string;
  source: string;
  category: string;
  type: string;
  title: string;
  entryIndex: number;
  entryTotal: number;
}

/** Split a parsed YAML document into logical entries. */
export function splitYamlEntries(content: unknown): { entries: unknown[]; parentKey?: string } {
  if (Array.isArray(content)) {
    return { entries: content };
  }
  if (content && typeof content === "object") {
    const obj = content as Record<string, unknown>;
    const keys = Object.keys(obj);
    // Collection file: single key holding a list (roles: [...], photos: [...]).
    if (keys.length === 1 && Array.isArray(obj[keys[0]])) {
      return { entries: obj[keys[0]] as unknown[], parentKey: keys[0] };
    }
    // Single entity file: the whole document is one entry.
    return { entries: [content] };
  }
  return { entries: [] };
}

export function isEmptyEntry(entry: unknown): boolean {
  if (entry === null || entry === undefined) return true;
  if (typeof entry === "string") return entry.trim() === "";
  if (typeof entry === "number" || typeof entry === "boolean") return false;
  if (Array.isArray(entry)) {
    return entry.length === 0 || entry.every(isEmptyEntry);
  }
  if (typeof entry === "object") {
    const values = Object.values(entry as Record<string, unknown>);
    return values.length === 0 || values.every(isEmptyEntry);
  }
  return false;
}

export function humanizeKey(key: string): string {
  const words = key.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function singular(key: string): string {
  return key.endsWith("s") && key.length > 1 ? key.slice(0, -1) : key;
}

/** Render one entry as labeled lines, preserving field names. */
export function flattenEntry(entry: unknown, prefix = ""): string[] {
  if (entry === null || entry === undefined) return [];
  if (
    typeof entry === "string" ||
    typeof entry === "number" ||
    typeof entry === "boolean"
  ) {
    const text = String(entry).trim();
    return text ? [`${prefix}${text}`] : [];
  }
  if (Array.isArray(entry)) {
    const lines: string[] = [];
    for (const item of entry) {
      if (item && typeof item === "object") {
        lines.push(...flattenEntry(item, prefix));
      } else {
        const text = String(item ?? "").trim();
        if (text) lines.push(`${prefix}- ${text}`);
      }
    }
    return lines;
  }
  const lines: string[] = [];
  for (const [key, value] of Object.entries(entry as Record<string, unknown>)) {
    const label = prefix ? `${prefix}${humanizeKey(key)}` : `${humanizeKey(key)}`;
    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value) && value.every((v) => v === null || v === undefined || v === "")) continue;
    if (typeof value === "object") {
      if (Array.isArray(value) && value.some((v) => v && typeof v === "object")) {
        lines.push(...flattenEntry(value, ""));
      } else if (Array.isArray(value)) {
        lines.push(`${label}:`);
        for (const item of value) {
          const text = String(item ?? "").trim();
          if (text) lines.push(`- ${text}`);
        }
      } else {
        lines.push(...flattenEntry(value, `${label} `));
      }
    } else {
      const text = String(value).trim();
      if (text) lines.push(`${label}: ${text}`);
    }
  }
  return lines;
}

function entryName(entry: unknown): string {
  if (entry && typeof entry === "object" && !Array.isArray(entry)) {
    const obj = entry as Record<string, unknown>;
    const parts = [obj.name, obj.title, obj.company, obj.question, obj.src]
      .filter((v) => typeof v === "string" && (v as string).trim() !== "")
      .map((v) => (v as string).trim());
    if (parts.length > 0) return parts.slice(0, 2).join(" — ");
  }
  if (typeof entry === "string" && entry.trim()) return entry.trim().slice(0, 80);
  return "";
}

export function entryLabel(
  meta: YamlDocMeta,
  parentKey: string | undefined,
  index: number,
  total: number,
  entry: unknown
): string {
  if (total <= 1) return humanizeKey(meta.title);
  const kind = parentKey ? humanizeKey(singular(parentKey)) : "Entry";
  const name = entryName(entry);
  return name ? `${kind} ${index + 1}: ${name}` : `${kind} ${index + 1}`;
}

/** Build labeled entry chunks for one YAML file. Skips empty entries.
 *
 *  Tiny collection entries (photos, small links) are batched into grouped
 *  chunks instead of one chunk each: ten near-identical "Photo N" chunks
 *  otherwise crowd top-K results and push genuinely relevant records out of
 *  the context window on every other question.
 */
const TINY_ENTRY_CHARS = 160;
const GROUP_MAX_CHARS = 500;
/** Asset-reference lists (images) carry no per-entry question identity of
 *  their own; their tiny entries may batch. Names lists (roles, projects,
 *  testimonials) always stay entry-per-chunk so "Role 2" keeps its records. */
const PACKABLE_PARENT_KEYS = new Set(["photos", "images", "assets", "gallery", "media"]);

export function chunkYamlDoc(
  content: unknown,
  meta: YamlDocMeta
): EntryChunk[] {
  const { entries, parentKey } = splitYamlEntries(content);
  const chunks: EntryChunk[] = [];
  // Collections (arrays, or a named list under one key) keep entry-level
  // chunks. Single-entity objects take the topical path below.
  const isCollection = Array.isArray(content) || parentKey !== undefined;

  if (isCollection) {
    // Pre-render each entry; keep per-entry labels for individual identity.
    type Rendered = { label: string; text: string };
    const rendered: Rendered[] = [];
    entries.forEach((entry, index) => {
      if (isEmptyEntry(entry)) return;
      const lines = flattenEntry(entry);
      if (lines.length === 0) return;
      const base =
        parentKey !== undefined
          ? entryLabel(meta, parentKey, index, entries.length, entry)
          : humanizeKey(meta.title);
      const label = `${base} (${meta.category})`;
      rendered.push({ label, text: lines.join("\n") });
    });

    const tiny =
      parentKey !== undefined &&
      PACKABLE_PARENT_KEYS.has(parentKey) &&
      rendered.length > 2 &&
      rendered.every((r) => r.text.length <= TINY_ENTRY_CHARS);

    if (tiny) {
      // Batch consecutive tiny entries until the group budget is exhausted.
      let group: Rendered[] = [];
      const flush = () => {
        if (group.length === 0) return;
        const first = group[0].label.match(/^(.*?)(\d+)(:.*)?$/);
        const last = group[group.length - 1].label.match(/^(.*?)(\d+)(:.*)?$/);
        const kind = first?.[1] ?? humanizeKey(meta.title);
        const start = Number(first?.[2] ?? 1);
        const end = Number(last?.[2] ?? start);
        const label =
          start !== end ? `${kind}${start}–${end} (${meta.category})` : group[0].label;
        chunks.push({
          text: `${label}\n${group.map((r) => `${r.label}\n${r.text}`).join("\n\n")}`,
          source: meta.source,
          category: meta.category,
          type: meta.type,
          title: meta.title,
          entryIndex: chunks.length,
          entryTotal: 0, // filled below
        });
        group = [];
      };
      let budget = 0;
      for (const r of rendered) {
        if (
          group.length > 0 &&
          (budget + r.text.length > GROUP_MAX_CHARS || group.length >= 5)
        ) {
          flush();
          budget = 0;
        }
        group.push(r);
        budget += r.text.length;
      }
      flush();
    } else {
      rendered.forEach((r) => {
        chunks.push({
          text: `${r.label}\n${r.text}`,
          source: meta.source,
          category: meta.category,
          type: meta.type,
          title: meta.title,
          entryIndex: chunks.length,
          entryTotal: 0, // filled below
        });
      });
    }
  } else if (content && typeof content === "object" && !Array.isArray(content)) {
    // Multi-topic single-entity file: split so each top-level sub-object /
    // sub-list becomes its own short, semantically concentrated chunk
    // ("Profile Personal details" with only age/birthdate/hobbies), while
    // flat scalar fields (name, title, summary, ...) group into one base
    // chunk. A one-blob chunk dilutes embedding similarity for questions
    // about any single sub-topic; topical chunks fix that for ANY phrasing,
    // no keyword routing needed.
    const obj = content as Record<string, unknown>;
    const topicKeys = Object.entries(obj)
      .filter(([, v]) => typeof v === "object" && v !== null && !isEmptyEntry(v))
      .map(([k]) => k);
    for (const key of topicKeys) {
      const value = obj[key];
      const lines = flattenEntry(value);
      if (lines.length === 0) continue;
      const topicLabel = `${humanizeKey(meta.title)} ${humanizeKey(key)} (${meta.category})`;
      chunks.push({
        text: `${topicLabel}\n${lines.join("\n")}`,
        source: meta.source,
        category: meta.category,
        type: meta.type,
        title: meta.title,
        entryIndex: chunks.length,
        entryTotal: 0,
      });
    }
    const parts: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
      if (topicKeys.includes(key)) continue;
      if (value === null || value === undefined || value === "") continue;
      parts.push(...flattenEntry({ [key]: value }));
    }
    if (parts.length > 0) {
      const baseLabel = `${humanizeKey(meta.title)} (${meta.category})`;
      chunks.push({
        text: `${baseLabel}\n${parts.join("\n")}`,
        source: meta.source,
        category: meta.category,
        type: meta.type,
        title: meta.title,
        entryIndex: chunks.length,
        entryTotal: 0,
      });
    }
  }

  for (const chunk of chunks) chunk.entryTotal = chunks.length;
  return chunks;
}

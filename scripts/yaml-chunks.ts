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

/** Build labeled entry chunks for one YAML file. Skips empty entries. */
export function chunkYamlDoc(
  content: unknown,
  meta: YamlDocMeta
): EntryChunk[] {
  const { entries, parentKey } = splitYamlEntries(content);
  const chunks: EntryChunk[] = [];
  entries.forEach((entry, index) => {
    if (isEmptyEntry(entry)) return;
    const lines = flattenEntry(entry);
    if (lines.length === 0) return;
    // Indexed labels ("Role 2: ...") only for collection files; single
    // entities are labeled by file title. Numbering follows file order so
    // "second role" keeps matching the source order. The category tag keeps
    // broad listing queries ("what projects...") matched to the right files.
    const base =
      parentKey !== undefined
        ? entryLabel(meta, parentKey, index, entries.length, entry)
        : humanizeKey(meta.title);
    const label = `${base} (${meta.category})`;
    chunks.push({
      text: `${label}\n${lines.join("\n")}`,
      source: meta.source,
      category: meta.category,
      type: meta.type,
      title: meta.title,
      entryIndex: chunks.length,
      entryTotal: 0, // filled below
    });
  });
  for (const chunk of chunks) chunk.entryTotal = chunks.length;
  return chunks;
}

/**
 * Knowledge-base loading for ingestion: read, decode, parse and chunk every
 * career_brain YAML file BEFORE the database is touched.
 *
 * Any problem (bad encoding, YAML error, empty corpus) is collected and
 * reported as a whole, so ingestion can refuse to run instead of dropping the
 * live table and dying half-way (the UTF-16 taqat file did exactly that).
 */
import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { chunkYamlDoc, type EntryChunk } from "./yaml-chunks";

export interface KbFile {
  source: string;
  category: string;
  type: string;
  title: string;
  raw: string;
}

export interface KbLoadResult {
  files: KbFile[];
  chunks: EntryChunk[];
  errors: string[];
}

/** Decode a file buffer: UTF-8 (BOM stripped) or UTF-16 LE/BE with BOM. */
export function decodeKbBuffer(buf: Buffer): { text: string; encoding: string } {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return { text: buf.subarray(2).toString("utf16le"), encoding: "utf-16le" };
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    const swapped = Buffer.from(buf.subarray(2));
    swapped.swap16();
    return { text: swapped.toString("utf16le"), encoding: "utf-16be" };
  }
  const text = buf.toString("utf8");
  return { text: text.charCodeAt(0) === 0xfeff ? text.slice(1) : text, encoding: "utf-8" };
}

/** Normalise line endings; reject text that still carries NUL bytes. */
export function normaliseKbText(text: string): string {
  if (text.includes("\u0000")) {
    throw new Error("contains NUL bytes (unsupported encoding; save the file as UTF-8)");
  }
  return text.replace(/\r\n?/g, "\n");
}

function listYamlFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) out.push(...listYamlFiles(full));
    else if (name.endsWith(".yml") || name.endsWith(".yaml")) out.push(full);
  }
  return out;
}

/**
 * Load the whole knowledge base. Never throws for per-file problems: every
 * problem lands in `errors` so the caller can abort before any DB write.
 */
export function loadKnowledgeBase(rootDir: string, opts: { minChunks?: number } = {}): KbLoadResult {
  const files: KbFile[] = [];
  const chunks: EntryChunk[] = [];
  const errors: string[] = [];

  for (const full of listYamlFiles(rootDir)) {
    // POSIX separators: source paths must compare equal across OSes
    // (eval expected-sets, category derivation, UI display).
    const source = path.relative(rootDir, full).split(path.sep).join("/");
    const file: KbFile = {
      source,
      category: source.split("/")[0],
      type: path.extname(full) === ".yaml" ? "yaml" : "text",
      title: path.basename(full, path.extname(full)),
      raw: "",
    };
    try {
      file.raw = normaliseKbText(decodeKbBuffer(fs.readFileSync(full)).text);
      const content = yaml.load(file.raw);
      if (file.raw.trim() !== "" && content === undefined) {
        throw new Error("parsed to nothing");
      }
      chunks.push(...chunkYamlDoc(content, file));
      files.push(file);
    } catch (err) {
      errors.push(`${source}: ${(err as Error).message.split("\n")[0]}`);
    }
  }

  const minChunks = opts.minChunks ?? 1;
  if (errors.length === 0 && chunks.length < minChunks) {
    errors.push(`only ${chunks.length} chunks produced (minimum ${minChunks}); refusing to replace the table`);
  }
  return { files, chunks, errors };
}

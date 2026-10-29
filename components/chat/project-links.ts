import type { ProjectBlock } from "../../lib/rich-response";

export interface CardLink {
  label: string;
  url: string;
  kind: "github" | "store" | "doc" | "live";
}

function kindOf(url: string, label: string): CardLink["kind"] {
  const u = url.toLowerCase();
  const l = label.toLowerCase();
  if (u.includes("github.com") || u.includes("gitlab.com") || /\b(source|repo|code|github)\b/.test(l)) return "github";
  if (u.includes("play.google.com") || u.includes("apps.apple.com") || /\b(store|play|app store)\b/.test(l)) return "store";
  if (u.endsWith(".pdf") || u.startsWith("/files/")) return "doc";
  return "live";
}

const DEFAULT_LABEL: Record<CardLink["kind"], string> = {
  github: "GitHub",
  store: "App store",
  doc: "Document",
  live: "Live site",
};

/** Merge `url` + `links[]` into deduped, typed buttons (already validated). */
export function projectLinks(block: Pick<ProjectBlock, "url" | "links">): CardLink[] {
  const raw: { label: string; url: string }[] = [
    ...(block.links ?? []),
    ...(block.url ? [{ label: "", url: block.url }] : []),
  ];
  const seen = new Set<string>();
  const out: CardLink[] = [];
  for (const r of raw) {
    const norm = r.url.replace(/\/+$/, "").toLowerCase();
    if (seen.has(norm)) continue;
    seen.add(norm);
    const kind = kindOf(r.url, r.label);
    out.push({ url: r.url, kind, label: r.label.trim() || DEFAULT_LABEL[kind] });
  }
  return out.slice(0, 4);
}

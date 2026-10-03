"use client";

import { memo } from "react";

const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/g;
const TRAILING_PUNCT = /[.,!?;:)\]]+$/;

export interface LinkPart {
  key: string;
  text: string;
  url: string | null;
}

/** Split plain text into text/link parts. Pure — unit-tested. */
export function splitLinks(text: string): LinkPart[] {
  const parts: LinkPart[] = [];
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(URL_PATTERN)) {
    const raw = m[0];
    const clean = raw.replace(TRAILING_PUNCT, "");
    if (m.index === undefined || !clean) continue;
    if (m.index > last) {
      parts.push({ key: `t${n++}`, text: text.slice(last, m.index), url: null });
    }
    parts.push({ key: `l${n++}`, text: clean, url: clean });
    last = m.index + raw.length;
    // Re-attach stripped punctuation as plain text.
    if (clean.length < raw.length) {
      parts.push({ key: `t${n++}`, text: raw.slice(clean.length), url: null });
      last = m.index + raw.length;
    }
  }
  if (last < text.length || parts.length === 0) {
    parts.push({ key: `t${n++}`, text: text.slice(last), url: null });
  }
  return parts;
}

/**
 * Renders plain text with bare URLs turned into styled links sharing the
 * single `.rich-link` style with Markdown links, so a URL looks identical
 * whether it appears in chat Markdown or inside a card body.
 */
export const AutolinkedText = memo(function AutolinkedText({ text }: { text: string }) {
  return (
    <>
      {splitLinks(text).map((p) =>
        p.url ? (
          <a
            key={p.key}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rich-link"
          >
            {p.text}
          </a>
        ) : (
          <span key={p.key}>{p.text}</span>
        ),
      )}
    </>
  );
});

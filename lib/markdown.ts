/**
 * The markdown renderer has no HTML pipeline (remark-gfm only), so a stray
 * <br> from the model would print as literal text. Collapse it to a space —
 * cell items already carry their own bullets, so nothing is lost.
 */
export function replaceBreakTags(content: string): string {
  return content.replace(/<br\s*\/?>/gi, " ");
}

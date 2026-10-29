/**
 * Semantic tech colours, stable per technology. Short tokens (ai, rag, git,
 * aws, …) match whole words only, so "Tailwind", "Storage" or "Digital"
 * never pick up the wrong family by substring.
 */
const FAMILIES: { re: RegExp; cls: string }[] = [
  {
    re: /(react|next\.?js|\bnext\b|typescript|javascript|\bts\b|\bjs\b|redux|vite|html)/,
    cls: "bg-sky-500/10 text-sky-700 border-sky-500/25 dark:text-sky-300",
  },
  {
    re: /(tailwind|\bcss\b|scss|sass|framer|motion|shadcn|radix|figma)/,
    cls: "bg-violet-500/10 text-violet-700 border-violet-500/25 dark:text-violet-300",
  },
  {
    re: /(odoo|python|node|express|fastapi|django|flask|\bqweb\b|\bowl\b)/,
    cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-300",
  },
  {
    re: /(postgres|pgvector|redis|mongo|\bsql\b|mysql|sqlite|prisma|drizzle|supabase|firebase)/,
    cls: "bg-indigo-500/10 text-indigo-700 border-indigo-500/25 dark:text-indigo-300",
  },
  {
    re: /(openai|gemini|gemma|ollama|langchain|\brag\b|\bai\b|\bllm\b|embedding|vector)/,
    cls: "bg-amber-500/10 text-amber-800 border-amber-500/30 dark:text-amber-300",
  },
  {
    re: /(docker|vercel|\baws\b|\bgit\b|github|stripe|telegram|netlify|linux|\bci\b)/,
    cls: "bg-rose-500/10 text-rose-700 border-rose-500/25 dark:text-rose-300",
  },
];

export function techColor(name: string): string {
  const t = name.toLowerCase();
  return FAMILIES.find((f) => f.re.test(t))?.cls ?? "bg-muted text-muted-foreground border-border";
}

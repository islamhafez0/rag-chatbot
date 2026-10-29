"use client";

import { memo, useEffect, useState } from "react";

/** After this long with no first token, say so honestly (free-tier model). */
export const SLOW_AFTER_MS = 9000;

export function loaderLabel(slow: boolean): string {
  return slow ? "Still thinking — the model is warming up" : "Thinking";
}

/**
 * Pre-first-token state: a CSS-animated orb + shimmering label. One timer
 * total (the "slow" hint) instead of a 16ms re-render loop, honest copy
 * instead of fake pipeline stages, full-contrast text.
 */
export const ThinkingLoader = memo(function ThinkingLoader() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="inline-flex items-center gap-3 py-1">
      <span aria-hidden className="relative flex h-5 w-5 items-center justify-center">
        <span
          className="absolute inset-0 animate-orbit rounded-full"
          style={{
            background: "conic-gradient(from 0deg, var(--brand-1), var(--brand-2), var(--brand-3), var(--brand-1))",
            mask: "radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2px))",
            WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2px))",
          }}
        />
        <span className="h-1.5 w-1.5 animate-breathe rounded-full bg-primary" />
      </span>
      <span className="text-sm font-medium text-muted-foreground">
        {loaderLabel(slow)}
        <span aria-hidden className="inline-flex w-5 gap-0.5 pl-0.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="inline-block h-1 w-1 translate-y-[-1px] animate-breathe rounded-full bg-current"
              style={{ animationDelay: `${i * 160}ms` }}
            />
          ))}
        </span>
      </span>
    </div>
  );
});

"use client";

import { memo, useEffect, useState } from "react";

/** After this long with no first token, say so honestly. */
export const SLOW_AFTER_MS = 9000;

export function loaderLabel(slow: boolean): string {
  return slow ? "Still thinking — the model is warming up" : "Thinking";
}

/**
 * Three gently pulsing dots that stagger in a wave, with a "Thinking" label.
 * Pure CSS — no JS animation loop, monochrome, reduced-motion safe.
 */
export const ThinkingLoader = memo(function ThinkingLoader() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="inline-flex items-center gap-3 py-1">
      {/* Pulsing dots */}
      <span aria-hidden className="inline-flex items-center gap-[5px]">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block h-[5px] w-[5px] rounded-full bg-muted-foreground"
            style={{
              animation: "dotPulse 1.4s ease-in-out infinite",
              animationDelay: `${i * 180}ms`,
            }}
          />
        ))}
      </span>
      <span className="text-sm font-medium text-muted-foreground">
        {loaderLabel(slow)}
      </span>

      {/* Scoped keyframes — no global CSS needed */}
      <style>{`
        @keyframes dotPulse {
          0%, 80%, 100% {
            opacity: 0.25;
            transform: scale(0.75);
          }
          40% {
            opacity: 1;
            transform: scale(1.1);
          }
        }
      `}</style>
    </div>
  );
});

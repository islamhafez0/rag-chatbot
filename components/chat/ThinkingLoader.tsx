"use client";

import { memo, useEffect, useState } from "react";

/**
 * Pipeline beats narrated while the assistant response streams, ordered by
 * typical cost (prep <1ms, embedding ~380ms, search ~2ms, LLM first token
 * 1–3s+). The loader advances by elapsed time so the text tracks what the
 * server is most likely doing behind the scenes.
 */
export const THINKING_STAGES = [
  "Understanding your question",
  "Searching the knowledge base",
  "Gathering the right context",
  "Writing the answer",
] as const;

/** Elapsed-time thresholds (ms) at which the loader advances one stage. */
const STAGE_AT_MS = [0, 1500, 4500, 10000];

export function stageForElapsed(ms: number): number {
  let stage = 0;
  for (let i = 0; i < STAGE_AT_MS.length; i++) {
    if (ms >= STAGE_AT_MS[i]) stage = i;
  }
  return Math.min(stage, THINKING_STAGES.length - 1);
}

/** Elapsed time (ms) at which the given stage begins. */
export function stageStartMs(stage: number): number {
  const clamped = Math.min(Math.max(stage, 0), STAGE_AT_MS.length - 1);
  return STAGE_AT_MS[clamped];
}

const TYPE_MS = 16; // per-character typing speed
const HOLD_MS = 1100; // pause on the final stage before looping the beat

export const ThinkingLoader = memo(function ThinkingLoader() {
  const [ticks, setTicks] = useState(0);
  const [reducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
  );

  useEffect(() => {
    if (reducedMotion) return;
    const t = window.setInterval(() => setTicks((n) => n + 1), TYPE_MS);
    return () => window.clearInterval(t);
  }, [reducedMotion]);

  // Everything below derives from the tick clock: no cascading setState,
  // and the text retypes from zero whenever the stage advances.
  const elapsed = ticks * TYPE_MS;
  const stage = stageForElapsed(elapsed);
  const full = THINKING_STAGES[stage];
  const chars = reducedMotion
    ? full.length
    : Math.min(
        full.length,
        Math.max(0, Math.floor((elapsed - stageStartMs(stage)) / TYPE_MS)),
      );
  const done = chars >= full.length;

  // On the final stage the beat loops so long generations never go static.
  useEffect(() => {
    if (stage !== THINKING_STAGES.length - 1 || !done || reducedMotion) return;
    const t = window.setTimeout(() => setTicks(0), HOLD_MS);
    return () => window.clearTimeout(t);
  }, [stage, done, reducedMotion]);

  return (
    <span
      className="inline-flex min-w-0 items-center text-sm text-[#aaaaaa9e]"
      aria-live="polite"
      aria-label="Working on your answer"
    >
      <span className="truncate">
        {full.slice(0, chars)}
        {done ? "…" : ""}
      </span>
      <span
        aria-hidden
        className="ml-1 inline-block h-4 w-[2px] shrink-0 animate-pulse bg-primary/50"
      />
    </span>
  );
});

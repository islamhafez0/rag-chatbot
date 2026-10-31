"use client";

import { Github, Globe, Linkedin } from "lucide-react";
import { PROFILE, SUGGESTIONS } from "./profile";
import { Logo } from "./Logo";

const SOCIAL_ICON = {
  github: Github,
  linkedin: Linkedin,
  web: Globe,
} as const;

/**
 * Minimal home screen — name, tagline, seamless infinite question suggestions,
 * and icon-only social links. The Composer is rendered by page.tsx at the
 * bottom of the viewport.
 */
export function Hero({
  onPick,
  disabled,
}: {
  onPick: (q: string) => void;
  disabled: boolean;
}) {
  return (
    <section
      aria-labelledby="hero-name"
      className="flex w-full flex-col items-center text-center"
    >
      <h1
        id="hero-name"
        className="flex items-center animate-rise font-display text-5xl leading-[1.05] tracking-tight text-foreground sm:text-6xl"
      >
        <span>{PROFILE.name}</span>
      </h1>
      <p
        className="mt-4 animate-rise text-sm text-muted-foreground"
        style={{ animationDelay: "120ms" }}
      >
        A RAG assistant grounded in my CV, projects, and code.
      </p>

      {/* Infinite scrolling question suggestions row */}
      <div
        className="relative mt-8 w-full max-w-3xl overflow-hidden py-1 animate-rise [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] [-webkit-mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
        style={{ animationDelay: "200ms" }}
      >
        <div className="marquee-belt flex w-max select-none">
          {/* Primary Group */}
          <div className="flex shrink-0 items-center gap-2.5 pr-2.5">
            {SUGGESTIONS.map((s, idx) => (
              <button
                key={`primary-${idx}`}
                type="button"
                disabled={disabled}
                onClick={() => onPick(s.label)}
                className="rounded-full border border-border bg-card/75 px-3.5 py-1.5 text-xs text-muted-foreground whitespace-nowrap transition-[background-color,color,border-color] duration-150 hover:border-foreground/30 hover:bg-accent hover:text-foreground active:scale-95 disabled:pointer-events-none disabled:opacity-50"
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Duplicate Group (seamless continuation) */}
          <div className="flex shrink-0 items-center gap-2.5 pr-2.5" aria-hidden="true">
            {SUGGESTIONS.map((s, idx) => (
              <button
                key={`clone-${idx}`}
                type="button"
                tabIndex={-1}
                disabled={disabled}
                onClick={() => onPick(s.label)}
                className="rounded-full border border-border bg-card/75 px-3.5 py-1.5 text-xs text-muted-foreground whitespace-nowrap transition-[background-color,color,border-color] duration-150 hover:border-foreground/30 hover:bg-accent hover:text-foreground active:scale-95 disabled:pointer-events-none disabled:opacity-50"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scoped CSS guaranteeing exact, flawless infinite loop */}
        <style>{`
          .marquee-belt {
            animation: marqueeBeltLoop 35s linear infinite;
            will-change: transform;
          }
          .marquee-belt:hover,
          .marquee-belt:focus-within {
            animation-play-state: paused;
          }
          @keyframes marqueeBeltLoop {
            0% {
              transform: translate3d(0, 0, 0);
            }
            100% {
              transform: translate3d(-50%, 0, 0);
            }
          }
          @media (prefers-reduced-motion: reduce) {
            .marquee-belt {
              animation: none;
            }
          }
        `}</style>
      </div>

      {/* Icon-only social links */}
      <nav
        aria-label="Links"
        className="mt-6 flex animate-rise items-center gap-1"
        style={{ animationDelay: "280ms" }}
      >
        {PROFILE.socials.map((s) => {
          const Icon = SOCIAL_ICON[s.kind];
          return (
            <a
              key={s.href}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              title={s.label}
              aria-label={`${s.label} (opens in a new tab)`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-[background-color,color] duration-150 hover:bg-accent hover:text-foreground"
            >
              <Icon className="h-4 w-4" aria-hidden />
            </a>
          );
        })}
      </nav>
    </section>
  );
}

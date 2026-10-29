"use client";

import Image from "next/image";
import {
  ArrowRight,
  Briefcase,
  Cpu,
  Download,
  FileText,
  Github,
  Globe,
  Linkedin,
  MapPin,
  Sparkles,
  Split,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PROFILE, SUGGESTIONS } from "./profile";
import { useRipple } from "./Ripple";

const CHIP_ICON = {
  briefcase: Briefcase,
  sparkles: Sparkles,
  cpu: Cpu,
  split: Split,
  file: FileText,
} as const;

const SOCIAL_ICON = { github: Github, linkedin: Linkedin, web: Globe } as const;

function SuggestionChip({
  label,
  icon,
  index,
  disabled,
  onPick,
}: {
  label: string;
  icon: keyof typeof CHIP_ICON;
  index: number;
  disabled: boolean;
  onPick: (q: string) => void;
}) {
  const { ref, onPointerDown } = useRipple<HTMLButtonElement>();
  const Icon = CHIP_ICON[icon];
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      onPointerDown={onPointerDown}
      onClick={() => onPick(label)}
      className="group relative flex min-h-12 w-full animate-rise items-center gap-3 overflow-hidden rounded-2xl border border-border bg-card/80 px-4 py-3 text-left text-sm font-medium text-foreground shadow-soft backdrop-blur transition-[translate,scale,box-shadow,border-color,background-color] duration-300 ease-out-expo hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lift active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
      style={{ animationDelay: `${420 + index * 60}ms` }}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">{label}</span>
      <ArrowRight
        aria-hidden
        className="h-4 w-4 shrink-0 -translate-x-1 text-muted-foreground opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
      />
    </button>
  );
}

export function Hero({ onPick, disabled }: { onPick: (q: string) => void; disabled: boolean }) {
  return (
    <section
      aria-labelledby="hero-name"
      className="mx-auto flex w-full max-w-3xl flex-col items-center px-1 pt-6 pb-4 text-center sm:pt-12"
    >
      <div className="relative animate-pop">
        <span
          aria-hidden
          className="absolute -inset-[3px] animate-[orbit_9s_linear_infinite] rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, var(--brand-1), var(--brand-2), var(--brand-3), var(--brand-1))",
          }}
        />
        <Image
          src={PROFILE.avatar}
          alt={`Portrait of ${PROFILE.name}`}
          width={112}
          height={112}
          priority
          className="relative h-24 w-24 rounded-full border-4 border-background object-cover sm:h-28 sm:w-28"
        />
      </div>

      <p
        className="mt-5 inline-flex animate-rise items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur"
        style={{ animationDelay: "80ms" }}
      >
        <span className="relative flex h-2 w-2" aria-hidden>
          <span className="absolute inset-0 animate-ping rounded-full bg-success/60" />
          <span className="relative h-2 w-2 rounded-full bg-success" />
        </span>
        AI portfolio · grounded in my CV &amp; projects
      </p>

      <h1
        id="hero-name"
        className="mt-4 animate-rise font-display text-[2.9rem] leading-[1.02] tracking-tight text-foreground sm:text-7xl"
        style={{ animationDelay: "140ms" }}
      >
        {PROFILE.firstName} <span className="text-gradient italic">{PROFILE.lastName}</span>
      </h1>
      <p
        className="mt-3 animate-rise text-base font-semibold text-foreground/90 sm:text-lg"
        style={{ animationDelay: "200ms" }}
      >
        {PROFILE.role}
      </p>
      <p
        className="mt-1.5 inline-flex animate-rise items-center gap-1 text-xs text-muted-foreground"
        style={{ animationDelay: "230ms" }}
      >
        <MapPin className="h-3.5 w-3.5" aria-hidden /> {PROFILE.location}
      </p>
      <p
        className="mt-4 max-w-xl animate-rise text-[0.95rem] leading-relaxed text-muted-foreground"
        style={{ animationDelay: "260ms" }}
      >
        {PROFILE.pitch}
      </p>

      <div
        className="mt-6 flex w-full animate-rise flex-col items-stretch justify-center gap-2.5 sm:w-auto sm:flex-row sm:items-center"
        style={{ animationDelay: "320ms" }}
      >
        {PROFILE.cvs.map((cv, i) => (
          <a
            key={cv.href}
            href={cv.href}
            download
            className={cn(
              "group inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-[translate,scale,box-shadow,background-color] duration-300 ease-out-expo hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97]",
              i === 0
                ? "bg-foreground text-background shadow-lift"
                : "border border-border bg-card/80 text-foreground shadow-soft backdrop-blur hover:bg-accent",
            )}
          >
            <Download
              className="h-4 w-4 transition-transform duration-300 group-hover:translate-y-0.5"
              aria-hidden
            />
            {cv.label}
            <span className="sr-only">(PDF download)</span>
          </a>
        ))}
        <ul className="flex items-center justify-center gap-1.5 sm:ml-1" aria-label="Profiles">
          {PROFILE.socials.map((s) => {
            const Icon = SOCIAL_ICON[s.kind];
            return (
              <li key={s.href}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${s.label} (opens in a new tab)`}
                  title={s.label}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card/80 text-muted-foreground shadow-soft backdrop-blur transition-[translate,scale,color,background-color] duration-300 ease-out-expo hover:-translate-y-0.5 hover:bg-accent hover:text-foreground active:scale-95"
                >
                  <Icon className="h-[1.1rem] w-[1.1rem]" aria-hidden />
                </a>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-10 w-full">
        <p
          className="mb-3 animate-fade text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase"
          style={{ animationDelay: "380ms" }}
        >
          Start with a question
        </p>
        <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
          {SUGGESTIONS.map((s, i) => (
            <SuggestionChip
              key={s.label}
              label={s.label}
              icon={s.icon}
              index={i}
              disabled={disabled}
              onPick={onPick}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

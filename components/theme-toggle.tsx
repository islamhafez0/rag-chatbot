"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const subscribe = () => () => {};

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  // Hydration-safe "mounted" flag without a setState-in-effect.
  const mounted = React.useSyncExternalStore(subscribe, () => true, () => false);
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={mounted ? `Switch to ${isDark ? "light" : "dark"} theme` : "Toggle theme"}
      title={mounted ? `Switch to ${isDark ? "light" : "dark"} theme` : undefined}
      className={cn(
        "relative inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-md text-muted-foreground transition-[background-color,color,scale] duration-200 hover:bg-accent hover:text-foreground active:scale-90",
        className,
      )}
    >
      <Sun
        aria-hidden
        className={cn(
          "absolute h-[1rem] w-[1rem] transition-all duration-400",
          isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0",
        )}
      />
      <Moon
        aria-hidden
        className={cn(
          "absolute h-[1rem] w-[1rem] transition-all duration-400",
          isDark ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100",
        )}
      />
    </button>
  );
}

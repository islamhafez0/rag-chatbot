"use client";

import { useCallback, useRef } from "react";

/**
 * Press ripple for chips/buttons: spawns one transform/opacity-only span at
 * the pointer and removes it on animationend. No re-renders, no layout work.
 * Under prefers-reduced-motion the global CSS collapses it to nothing.
 */
export function useRipple<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const onPointerDown = useCallback((e: React.PointerEvent<T>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2.2;
    const ink = document.createElement("span");
    ink.className = "ripple-ink";
    ink.setAttribute("aria-hidden", "true");
    ink.style.width = ink.style.height = `${size}px`;
    ink.style.left = `${e.clientX - rect.left}px`;
    ink.style.top = `${e.clientY - rect.top}px`;
    ink.addEventListener("animationend", () => ink.remove(), { once: true });
    el.appendChild(ink);
    window.setTimeout(() => ink.remove(), 800);
  }, []);
  return { ref, onPointerDown };
}

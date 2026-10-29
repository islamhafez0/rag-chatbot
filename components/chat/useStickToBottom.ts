"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const THRESHOLD_PX = 72;

/**
 * Stick-to-bottom that respects the reader: while the user is at the bottom
 * new content keeps them pinned; the moment they scroll up (wheel, touch,
 * keys, scrollbar) we stop following and expose `atBottom=false` so the UI
 * can offer "jump to latest". Content growth is observed with a
 * ResizeObserver, so streaming tokens cost one scrollTop write per frame.
 */
export function useStickToBottom(active = true) {
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stuck = useRef(true);
  const [atBottom, setAtBottom] = useState(true);

  const distance = () => {
    const el = scrollRef.current;
    return el ? el.scrollHeight - el.scrollTop - el.clientHeight : 0;
  };

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = scrollRef.current;
    if (!el) return;
    stuck.current = true;
    setAtBottom(true);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : behavior });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el || !content) return;

    let lastTop = el.scrollTop;
    const onScroll = () => {
      const d = distance();
      const goingUp = el.scrollTop < lastTop - 1;
      lastTop = el.scrollTop;
      if (goingUp && d > 4) stuck.current = false;
      else if (d <= THRESHOLD_PX) stuck.current = true;
      setAtBottom(d <= THRESHOLD_PX);
    };
    const release = (e: WheelEvent) => {
      if (e.deltaY < 0) stuck.current = false;
    };
    let touchY = 0;
    const touchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? 0;
    };
    const touchMove = (e: TouchEvent) => {
      if ((e.touches[0]?.clientY ?? 0) > touchY + 4) stuck.current = false;
    };

    let raf = 0;
    const ro = new ResizeObserver(() => {
      if (!activeRef.current) return; // landing page: never auto-scroll
      if (!stuck.current) {
        setAtBottom(distance() <= THRESHOLD_PX);
        return;
      }
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
        lastTop = el.scrollTop;
      });
    });
    ro.observe(content);
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("wheel", release, { passive: true });
    el.addEventListener("touchstart", touchStart, { passive: true });
    el.addEventListener("touchmove", touchMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", release);
      el.removeEventListener("touchstart", touchStart);
      el.removeEventListener("touchmove", touchMove);
    };
  }, []);

  return { scrollRef, contentRef, atBottom, scrollToBottom };
}

"use client";

import { memo, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Photo tile: fixed aspect frame (no layout shift), shimmer until decoded,
 * soft zoom on hover. Opens the full image in a new tab.
 */
export const GalleryImage = memo(function GalleryImage({
  src,
  alt,
  className
}: {
  src: string;
  alt?: string;
  className?: string
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group/img relative block overflow-hidden rounded-2xl border border-border bg-muted shadow-soft",
        className
      )}
    >
      {!loaded && <span aria-hidden className="absolute inset-0 skeleton" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt ?? ""}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={cn(
          "h-full w-full object-cover transition-[opacity,scale] duration-700 ease-out-expo group-hover/img:scale-[1.04]",
          loaded ? "opacity-100" : "opacity-0",
        )}
      />
      {alt && (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pt-8 pb-2 text-xs font-medium text-white opacity-0 transition-opacity duration-300 group-hover/img:opacity-100 group-focus-visible/img:opacity-100">
          {alt}
        </span>
      )}
    </a>
  );
});

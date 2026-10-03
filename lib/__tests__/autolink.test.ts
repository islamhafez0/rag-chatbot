import { describe, it, expect } from "vitest";
import { splitLinks } from "../../components/chat/Autolink";

describe("splitLinks", () => {
  it("leaves plain text untouched", () => {
    expect(splitLinks("Just some words")).toEqual([
      { key: "t0", text: "Just some words", url: null },
    ]);
  });

  it("extracts bare URLs as links", () => {
    const parts = splitLinks("Live site: https://islamhafez.vercel.app enjoy");
    expect(parts).toEqual([
      { key: "t0", text: "Live site: ", url: null },
      { key: "l1", text: "https://islamhafez.vercel.app", url: "https://islamhafez.vercel.app" },
      { key: "t2", text: " enjoy", url: null },
    ]);
  });

  it("strips trailing punctuation from the link", () => {
    const parts = splitLinks("See https://example.com/a, and more.");
    const link = parts.find((p) => p.url);
    expect(link?.url).toBe("https://example.com/a");
  });

  it("handles multiple URLs", () => {
    const parts = splitLinks("A https://a.dev B https://b.dev C");
    expect(parts.filter((p) => p.url !== null)).toHaveLength(2);
  });
});

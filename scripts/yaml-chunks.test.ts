import { describe, it, expect } from "vitest";
import {
  splitYamlEntries,
  isEmptyEntry,
  flattenEntry,
  entryLabel,
  chunkYamlDoc,
  type YamlDocMeta,
} from "./yaml-chunks";

const meta = (title: string, source = `${title}.yml`): YamlDocMeta => ({
  source,
  category: source.split("/")[0],
  type: "text",
  title,
});

describe("splitYamlEntries", () => {
  it("splits a single-key list file into one entry per item", () => {
    const { entries, parentKey } = splitYamlEntries({
      roles: [{ company: "A" }, { company: "B" }, { company: "C" }],
    });
    expect(entries).toHaveLength(3);
    expect(parentKey).toBe("roles");
  });

  it("keeps a single-entity mapping as one entry", () => {
    const { entries, parentKey } = splitYamlEntries({
      company: "TaqaTechno",
      title: "Odoo Frontend Developer",
    });
    expect(entries).toHaveLength(1);
    expect(parentKey).toBeUndefined();
  });

  it("keeps a Q&A mapping as one entry", () => {
    const { entries } = splitYamlEntries({
      biggest_strength: "adapting fast",
      tell_me_about_yourself: "I am Islam",
    });
    expect(entries).toHaveLength(1);
  });

  it("returns no entries for empty/scalar content", () => {
    expect(splitYamlEntries(null).entries).toEqual([]);
    expect(splitYamlEntries(undefined).entries).toEqual([]);
    expect(splitYamlEntries("just a string").entries).toEqual([]);
  });
});

describe("isEmptyEntry", () => {
  it("treats null placeholders as empty", () => {
    expect(isEmptyEntry(null)).toBe(true);
    expect(isEmptyEntry([null])).toBe(true);
    expect(
      isEmptyEntry({ from_managers: [null], from_colleagues: [null] })
    ).toBe(true);
  });

  it("treats real content as non-empty", () => {
    expect(isEmptyEntry({ company: "A", title: "B" })).toBe(false);
    expect(isEmptyEntry("hello")).toBe(false);
    expect(isEmptyEntry(0)).toBe(false);
  });
});

describe("flattenEntry", () => {
  it("preserves field labels on scalars and lists", () => {
    const lines = flattenEntry({
      company: "TaqaTechno",
      title: "Odoo Frontend Developer",
      tech_stack: ["Odoo", "Python"],
    });
    expect(lines).toContain("Company: TaqaTechno");
    expect(lines).toContain("Title: Odoo Frontend Developer");
    expect(lines).toContain("Tech stack:");
    expect(lines).toContain("- Odoo");
    expect(lines).toContain("- Python");
  });

  it("flattens nested mappings without splitting fields", () => {
    const lines = flattenEntry({
      pipeline: { ingestion: "yaml chunked", retrieval: "top 8" },
    });
    expect(lines).toContain("Pipeline Ingestion: yaml chunked");
    expect(lines).toContain("Pipeline Retrieval: top 8");
  });
});

describe("chunkYamlDoc", () => {
  const rolesDoc = {
    roles: [
      { company: "TaqaTechno", title: "Frontend Angular Developer" },
      { company: "Self-Employed", title: "Frontend Developer Freelancer" },
      { company: "Code Alpha", title: "Frontend React Developer Intern" },
    ],
  };

  it("creates one labeled chunk per role, never mixing companies", () => {
    const chunks = chunkYamlDoc(rolesDoc, meta("previous", "roles/previous.yml"));
    expect(chunks).toHaveLength(3);
    expect(chunks[0].text.startsWith("Role 1:")).toBe(true);
    expect(chunks[0].text).toContain("(roles)");
    expect(chunks[0].text).toContain("TaqaTechno");
    expect(chunks[0].text).not.toContain("Code Alpha");
    expect(chunks[1].text).toContain("Self-Employed");
    expect(chunks[2].text).toContain("Code Alpha");
    expect(chunks[0].category).toBe("roles");
    expect(chunks.map((c) => c.entryTotal)).toEqual([3, 3, 3]);
  });

  it("labels single entities by file title", () => {
    const chunks = chunkYamlDoc({ company: "TaqaTechno" }, meta("current"));
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text.startsWith("Current (")).toBe(true);
  });

  it("skips empty files entirely", () => {
    const chunks = chunkYamlDoc(
      { from_managers: [null], from_colleagues: [null] },
      meta("testimonials")
    );
    expect(chunks).toHaveLength(0);
  });

  it("creates one chunk per photo with indexed labels", () => {
    const chunks = chunkYamlDoc(
      { photos: [{ src: "/a.png", alt: "A" }, { src: "/b.png", alt: "B" }] },
      meta("photos")
    );
    expect(chunks).toHaveLength(2);
    expect(chunks[0].text.startsWith("Photo 1:")).toBe(true);
    expect(chunks[1].text).toContain("/b.png");
  });

  it("entryLabel numbers by file order", () => {
    expect(
      entryLabel(meta("previous"), "roles", 1, 3, { company: "X", title: "Dev" })
    ).toBe("Role 2: Dev — X");
  });
});

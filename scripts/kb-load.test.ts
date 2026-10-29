import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { decodeKbBuffer, normaliseKbText, loadKnowledgeBase } from "./kb-load";

let dir: string;
const write = (rel: string, data: string | Buffer) => {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, data);
};

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "kb-load-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("decodeKbBuffer", () => {
  it("decodes UTF-16 LE with BOM (the file that used to crash ingestion)", () => {
    const buf = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("company: TaqaTechno\r\n", "utf16le")]);
    const { text, encoding } = decodeKbBuffer(buf);
    expect(encoding).toBe("utf-16le");
    expect(normaliseKbText(text)).toBe("company: TaqaTechno\n");
  });

  it("decodes UTF-16 BE with BOM", () => {
    const le = Buffer.from("name: X", "utf16le");
    le.swap16();
    const { text } = decodeKbBuffer(Buffer.concat([Buffer.from([0xfe, 0xff]), le]));
    expect(text).toBe("name: X");
  });

  it("strips a UTF-8 BOM", () => {
    const { text } = decodeKbBuffer(Buffer.from("﻿- name: A", "utf8"));
    expect(text).toBe("- name: A");
  });

  it("rejects text that still contains NUL bytes", () => {
    expect(() => normaliseKbText("a\u0000b")).toThrow(/NUL/);
  });
});

describe("loadKnowledgeBase", () => {
  it("loads UTF-16 and UTF-8 files into labelled chunks", () => {
    write("roles/a.yml", Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("company: TaqaTechno\ntitle: Dev\n", "utf16le")]));
    write("facts/b.yml", "name: Islam\n");
    const kb = loadKnowledgeBase(dir);
    expect(kb.errors).toEqual([]);
    expect(kb.chunks.map((c) => c.source)).toEqual(["facts/b.yml", "roles/a.yml"]);
    expect(kb.chunks[1].text).toContain("Company: TaqaTechno");
  });

  it("collects YAML errors instead of throwing, so nothing is written", () => {
    write("facts/ok.yml", "name: Islam\n");
    write("facts/bad.yml", "key: [unclosed\n");
    const kb = loadKnowledgeBase(dir);
    expect(kb.errors).toHaveLength(1);
    expect(kb.errors[0]).toMatch(/^facts\/bad\.yml:/);
  });

  it("refuses a corpus smaller than the minimum", () => {
    write("facts/a.yml", "name: Islam\n");
    const kb = loadKnowledgeBase(dir, { minChunks: 5 });
    expect(kb.errors[0]).toMatch(/only 1 chunks/);
  });

  it("treats an empty file as zero chunks, not an error", () => {
    write("facts/a.yml", "name: Islam\n");
    write("feedback/empty.yml", "");
    const kb = loadKnowledgeBase(dir);
    expect(kb.errors).toEqual([]);
    expect(kb.chunks).toHaveLength(1);
  });
});

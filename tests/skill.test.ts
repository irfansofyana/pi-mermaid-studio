import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const skillRoot = join(process.cwd(), "skills", "mermaid");

describe("bundled engineering skill", () => {
  it("ships the focused router and every deep engineering guide", async () => {
    const skill = await readFile(join(skillRoot, "SKILL.md"), "utf8");
    const references = await readdir(join(skillRoot, "references"));

    expect(skill).toContain('name: "pi-mermaid-studio"');
    expect(skill).toContain('action: "validate"');
    expect(skill).toContain("raw Mermaid");
    expect(references.sort()).toEqual([
      "architecture.md",
      "c4.md",
      "choosing-the-right-diagram.md",
      "class.md",
      "er.md",
      "flowchart.md",
      "gantt.md",
      "sequence.md",
      "state.md",
      "syntax-safety.md",
      "visual-quality.md",
    ]);
  });

  it("keeps every guide auditable against the pinned Mermaid documentation", async () => {
    const references = await readdir(join(skillRoot, "references"));
    for (const reference of references) {
      const content = await readFile(join(skillRoot, "references", reference), "utf8");
      expect(content).toContain("Pinned documentation baseline: Mermaid 11.16.1");
      expect(content).toContain("Official source: https://mermaid.js.org/");
    }
  });
});

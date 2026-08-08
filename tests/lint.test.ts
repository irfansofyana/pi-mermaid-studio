import { describe, expect, it } from "vitest";
import { lintMermaid } from "../src/lint.js";

describe("lintMermaid", () => {
  it("returns focused quality guidance for overloaded engineering diagrams", () => {
    const source = [
      "sequenceDiagram",
      "participant A",
      "participant B",
      "participant C",
      "participant D",
      "participant E",
      "participant F",
      "participant G",
      "participant H",
      "participant I",
      "A->>B: Request",
    ].join("\n");

    expect(lintMermaid(source)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "sequence-cast", severity: "warning" })]),
    );
  });

  it("keeps ordinary diagrams quiet", () => {
    expect(lintMermaid("flowchart TD\nClient --> API\nAPI --> Database")).toEqual([]);
  });

  it("does not reject or attempt to parse unknown future syntax", () => {
    expect(() => lintMermaid("futureDiagram\nnew-feature: enabled")).not.toThrow();
  });
});

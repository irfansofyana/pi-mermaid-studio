import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DiagramConflictError, DiagramStore, slugify } from "../src/store.js";

describe("DiagramStore", () => {
  it("creates Git-friendly source and version metadata", async () => {
    const root = await mkdtemp(join(tmpdir(), "pi-mermaid-"));
    const store = new DiagramStore(root);
    const record = await store.create({ title: "Login & MFA", source: "flowchart LR\nA-->B" });

    expect(record.id).toBe("login-mfa");
    expect(record.version).toBe(1);
    expect(await readFile(join(root, ".pi/diagrams/login-mfa.mmd"), "utf8")).toBe("flowchart LR\nA-->B");
  });

  it("keeps history and rejects stale updates", async () => {
    const root = await mkdtemp(join(tmpdir(), "pi-mermaid-"));
    const store = new DiagramStore(root);
    await store.create({ id: "auth", title: "Auth", source: "flowchart LR\nA-->B" });
    const updated = await store.update("auth", { source: "flowchart LR\nA-->C", expectedVersion: 1, summary: "Change target" });

    expect(updated.version).toBe(2);
    expect(updated.versions).toHaveLength(2);
    await expect(store.update("auth", { source: "flowchart LR\nA-->D", expectedVersion: 1 })).rejects.toBeInstanceOf(
      DiagramConflictError,
    );
  });

  it("creates unique ids", async () => {
    const root = await mkdtemp(join(tmpdir(), "pi-mermaid-"));
    const store = new DiagramStore(root);
    await store.create({ title: "System Map", source: "flowchart LR\nA-->B" });
    const second = await store.create({ title: "System Map", source: "flowchart LR\nA-->C" });
    expect(second.id).toBe("system-map-2");
  });
});

describe("slugify", () => {
  it("normalizes unsafe titles", () => expect(slugify("  API / Gateway ✨ ")).toBe("api-gateway"));
});

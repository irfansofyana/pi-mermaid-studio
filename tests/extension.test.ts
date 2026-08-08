import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import mermaidStudioExtension from "../extensions/index.js";

describe("Pi extension vertical slice", () => {
  const shutdownHandlers: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await Promise.all(shutdownHandlers.splice(0).map((handler) => handler()));
  });

  it("registers the tool, persists a diagram, and serves the workbench", async () => {
    const tools = new Map<string, any>();
    const commands = new Map<string, any>();
    const pi = {
      registerTool(tool: any) { tools.set(tool.name, tool); },
      registerCommand(name: string, command: any) { commands.set(name, command); },
      on(event: string, handler: any) {
        if (event === "session_shutdown") shutdownHandlers.push(() => handler({}, {}));
      },
    };
    mermaidStudioExtension(pi as any);

    expect(commands.has("mermaid")).toBe(true);
    const tool = tools.get("mermaid_diagram");
    expect(tool).toBeDefined();

    const validation = await tool.execute(
      "validate-1",
      {
        action: "validate",
        source: "sequenceDiagram\nparticipant A\nparticipant B\nparticipant C\nparticipant D\nparticipant E\nparticipant F\nparticipant G\nparticipant H\nparticipant I\nA->>B: Request",
      },
      undefined,
      undefined,
      { cwd: process.cwd() },
    );
    expect(validation.isError).not.toBe(true);
    expect(validation.details.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ code: "sequence-cast" })]));

    const root = await mkdtemp(join(tmpdir(), "pi-mermaid-extension-"));
    const ctx = { cwd: root };
    const created = await tool.execute(
      "call-1",
      { action: "create", id: "request-flow", title: "Request flow", source: "sequenceDiagram\nClient->>API: Request" },
      undefined,
      undefined,
      ctx,
    );
    expect(created.isError).not.toBe(true);
    expect(created.details.version).toBe(1);

    const page = await fetch(created.details.url);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("Mermaid Studio");
    expect(html).toContain("Copy PNG");
    expect(html).toContain('id="history-picker"');

    const validationUrl = new URL("api/validate", created.details.url);
    const browserValidation = await fetch(validationUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: 'flowchart LR\nA["This label is intentionally made far too long for a compact engineering diagram and should trigger guidance"]-->B' }),
    });
    expect(browserValidation.status).toBe(200);
    expect((await browserValidation.json()).warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "long-labels" })]),
    );

    const moduleUrl = new URL("vendor/mermaid/mermaid.esm.min.mjs", created.details.url);
    const mermaidModule = await fetch(moduleUrl);
    expect(mermaidModule.status).toBe(200);
    expect(mermaidModule.headers.get("content-type")).toContain("text/javascript");

    const chunkName = (await mermaidModule.text()).match(/\.\/chunks\/mermaid\.esm\.min\/[a-zA-Z0-9_.-]+\.mjs/)?.[0];
    expect(chunkName).toBeDefined();
    const chunk = await fetch(new URL(chunkName!, moduleUrl));
    expect(chunk.status).toBe(200);

    const updated = await tool.execute(
      "call-2",
      {
        action: "update",
        id: "request-flow",
        expectedVersion: 1,
        source: "sequenceDiagram\nClient->>API: Request\nAPI-->>Client: Response",
      },
      undefined,
      undefined,
      ctx,
    );
    expect(updated.details.version).toBe(2);

    const invalid = await tool.execute(
      "call-3",
      { action: "update", id: "request-flow", expectedVersion: 2, source: "this is not Mermaid" },
      undefined,
      undefined,
      ctx,
    );
    expect(invalid.isError).toBe(true);
    expect(invalid.content[0].text).toContain("invalid_mermaid");
  });
});

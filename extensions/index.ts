import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { openBrowser } from "../src/open.js";
import { DiagramConflictError, DiagramNotFoundError, DiagramStore } from "../src/store.js";
import { WorkbenchServer } from "../src/server.js";
import { MermaidSyntaxError, validateMermaid } from "../src/validate.js";

const Parameters = Type.Object({
  action: Type.Union([
    Type.Literal("create"),
    Type.Literal("update"),
    Type.Literal("get"),
    Type.Literal("list"),
    Type.Literal("open"),
  ]),
  id: Type.Optional(Type.String({ description: "Stable diagram id. Required for update/get/open." })),
  title: Type.Optional(Type.String({ description: "Human-readable diagram title." })),
  source: Type.Optional(Type.String({ description: "Complete Mermaid source. Required for create/update." })),
  expectedVersion: Type.Optional(Type.Number({ description: "Current version when updating; prevents overwriting newer edits." })),
  summary: Type.Optional(Type.String({ description: "Short description of what changed." })),
});

interface ToolDetails {
  ok: boolean;
  action: string;
  id?: string;
  title?: string;
  version?: number;
  source?: string;
  url?: string;
  error?: string;
}

export default function mermaidStudioExtension(pi: ExtensionAPI): void {
  const stores = new Map<string, DiagramStore>();
  const servers = new Map<string, WorkbenchServer>();

  const storeFor = (root: string): DiagramStore => {
    let store = stores.get(root);
    if (!store) {
      store = new DiagramStore(root);
      stores.set(root, store);
    }
    return store;
  };

  const serverFor = async (root: string): Promise<WorkbenchServer> => {
    let server = servers.get(root);
    if (!server) {
      server = new WorkbenchServer(storeFor(root));
      servers.set(root, server);
    }
    await server.start();
    return server;
  };

  pi.registerTool({
    name: "mermaid_diagram",
    label: "Mermaid",
    description:
      "Create, update, retrieve, list, or open persistent Mermaid diagrams. Use complete valid Mermaid source for create/update. Diagrams are saved under .pi/diagrams in the current project.",
    promptSnippet: "Create and revise persistent Mermaid diagrams with a live browser workbench.",
    promptGuidelines: [
      "Use mermaid_diagram when a diagram would explain structure or sequence better than prose.",
      "When updating, retrieve the current diagram first and pass expectedVersion to avoid overwriting human edits.",
      "Keep the source syntactically valid and use stable diagram ids from tool results.",
    ],
    parameters: Parameters,
    executionMode: "sequential",
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const root = ctx.cwd || process.cwd();
      const store = storeFor(root);
      try {
        if (params.action === "list") {
          const diagrams = await store.list();
          const text = diagrams.length
            ? diagrams.map((item) => `${item.id} · v${item.version} · ${item.title}`).join("\n")
            : "No Mermaid diagrams exist in this project yet.";
          return { content: [{ type: "text" as const, text }], details: { ok: true, action: "list" } satisfies ToolDetails };
        }

        if (params.action === "create") {
          if (!params.source?.trim()) throw new Error("create requires complete Mermaid source.");
          await validateMermaid(params.source);
          const record = await store.create({ id: params.id, title: params.title || params.id || "Untitled diagram", source: params.source });
          const server = await serverFor(root);
          server.broadcast(record);
          const url = server.url(record.id);
          return {
            content: [{ type: "text" as const, text: `Created '${record.id}' v${record.version}.\nWorkbench: ${url}\nSource: .pi/diagrams/${record.id}.mmd` }],
            details: { ok: true, action: "create", id: record.id, title: record.title, version: record.version, source: record.source, url } satisfies ToolDetails,
          };
        }

        if (!params.id) throw new Error(`${params.action} requires a diagram id.`);
        if (params.action === "update") {
          if (!params.source?.trim()) throw new Error("update requires complete Mermaid source.");
          await validateMermaid(params.source);
          const record = await store.update(params.id, {
            source: params.source,
            title: params.title,
            expectedVersion: params.expectedVersion,
            summary: params.summary,
            actor: "agent",
          });
          const server = await serverFor(root);
          server.broadcast(record);
          const url = server.url(record.id);
          return {
            content: [{ type: "text" as const, text: `Updated '${record.id}' to v${record.version}.\nWorkbench: ${url}` }],
            details: { ok: true, action: "update", id: record.id, title: record.title, version: record.version, source: record.source, url } satisfies ToolDetails,
          };
        }

        const record = await store.get(params.id);
        if (params.action === "open") {
          const server = await serverFor(root);
          const url = server.url(record.id);
          openBrowser(url);
          return {
            content: [{ type: "text" as const, text: `Opened '${record.id}' v${record.version}.\n${url}` }],
            details: { ok: true, action: "open", id: record.id, title: record.title, version: record.version, url } satisfies ToolDetails,
          };
        }
        return {
          content: [{ type: "text" as const, text: `${record.id} · v${record.version} · ${record.title}\n\n${record.source}` }],
          details: { ok: true, action: "get", id: record.id, title: record.title, version: record.version, source: record.source } satisfies ToolDetails,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected Mermaid Studio error.";
        const kind = error instanceof DiagramConflictError
          ? "conflict"
          : error instanceof DiagramNotFoundError
            ? "not_found"
            : error instanceof MermaidSyntaxError
              ? "invalid_mermaid"
              : "invalid_request";
        return {
          content: [{ type: "text" as const, text: `${kind}: ${message}` }],
          details: { ok: false, action: params.action, id: params.id, error: message } satisfies ToolDetails,
          isError: true,
        };
      }
    },
    renderCall(args, theme) {
      const target = args.title || args.id || "diagram";
      return new Text(`${theme.fg("accent", theme.bold("Mermaid"))} ${theme.fg("muted", `· ${args.action} · ${target}`)}`, 0, 0);
    },
    renderResult(result, _options, theme) {
      const details = result.details as ToolDetails | undefined;
      if (!details?.ok) return new Text(theme.fg("error", `Mermaid · ${details?.error || "failed"}`), 0, 0);
      if (details.action === "list") return new Text(theme.fg("success", "Mermaid · diagrams listed"), 0, 0);
      return new Text(
        `${theme.fg("success", "◆")} ${theme.bold(details.title || details.id || "Mermaid")} ${theme.fg("muted", details.version ? `· v${details.version}` : "")}`,
        0,
        0,
      );
    },
  });

  pi.registerCommand("mermaid", {
    description: "Open the Mermaid workbench, optionally for a diagram id",
    handler: async (args, ctx) => {
      const root = ctx.cwd || process.cwd();
      const store = storeFor(root);
      let id = args.trim();
      if (!id) id = (await store.list())[0]?.id || "";
      if (!id) {
        ctx.ui.notify("No diagrams yet. Ask Pi to create one first.", "info");
        return;
      }
      try {
        await store.get(id);
        const server = await serverFor(root);
        const url = server.url(id);
        openBrowser(url);
        ctx.ui.notify(`Opened Mermaid workbench for ${id}`, "info");
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : "Could not open Mermaid workbench.", "error");
      }
    },
  });

  pi.on("session_shutdown", async () => {
    await Promise.all([...servers.values()].map((server) => server.close()));
    servers.clear();
  });
}

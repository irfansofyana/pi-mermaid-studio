import { randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer, type Server, type ServerResponse } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DiagramConflictError, DiagramNotFoundError, DiagramStore } from "./store.js";
import type { DiagramRecord } from "./types.js";
import { MermaidSyntaxError, validateMermaid } from "./validate.js";

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WEB_ROOT = join(PACKAGE_ROOT, "web");
const MERMAID_ROOT = join(PACKAGE_ROOT, "node_modules", "mermaid", "dist");

type EventClient = ServerResponse;

export class WorkbenchServer {
  private server?: Server;
  private port?: number;
  private readonly token = randomBytes(18).toString("base64url");
  private readonly clients = new Set<EventClient>();

  constructor(private readonly store: DiagramStore) {}

  async start(): Promise<void> {
    if (this.server) return;
    this.server = createServer((request, response) => void this.handle(request.url || "/", request.method || "GET", request, response));
    await new Promise<void>((resolve, reject) => {
      this.server!.once("error", reject);
      this.server!.listen(0, "127.0.0.1", () => {
        const address = this.server!.address();
        if (!address || typeof address === "string") return reject(new Error("Workbench failed to bind to localhost."));
        this.port = address.port;
        resolve();
      });
    });
  }

  url(diagramId?: string): string {
    if (!this.port) throw new Error("Workbench server is not running.");
    const query = diagramId ? `?id=${encodeURIComponent(diagramId)}` : "";
    return `http://127.0.0.1:${this.port}/t/${this.token}/${query}`;
  }

  broadcast(record: DiagramRecord): void {
    const payload = `event: diagram\ndata: ${JSON.stringify({ id: record.id, version: record.version })}\n\n`;
    for (const client of this.clients) client.write(payload);
  }

  async close(): Promise<void> {
    for (const client of this.clients) client.end();
    this.clients.clear();
    if (!this.server) return;
    const server = this.server;
    this.server = undefined;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  private async handle(rawUrl: string, method: string, request: NodeJS.ReadableStream, response: ServerResponse): Promise<void> {
    const url = new URL(rawUrl, "http://127.0.0.1");
    const prefix = `/t/${this.token}`;
    if (!url.pathname.startsWith(prefix)) return this.text(response, 404, "Not found");
    const path = url.pathname.slice(prefix.length) || "/";

    try {
      if (method === "GET" && path === "/") return await this.file(response, join(WEB_ROOT, "index.html"), "text/html; charset=utf-8");
      if (method === "GET" && path === "/studio.css") return await this.file(response, join(WEB_ROOT, "studio.css"), "text/css; charset=utf-8");
      if (method === "GET" && path === "/studio.js") return await this.file(response, join(WEB_ROOT, "studio.js"), "text/javascript; charset=utf-8");
      if (method === "GET" && path.startsWith("/vendor/mermaid/")) {
        const asset = path.slice("/vendor/mermaid/".length);
        if (!asset || asset.includes("..") || !/^[a-zA-Z0-9_./-]+$/.test(asset)) return this.text(response, 404, "Not found");
        const contentType = asset.endsWith(".wasm")
          ? "application/wasm"
          : asset.endsWith(".json")
            ? "application/json; charset=utf-8"
            : "text/javascript; charset=utf-8";
        return await this.file(response, join(MERMAID_ROOT, asset), contentType);
      }
      if (method === "GET" && path === "/api/diagrams") return this.json(response, 200, await this.store.list());
      if (method === "GET" && path === "/events") return this.events(request, response);

      const match = path.match(/^\/api\/diagrams\/([a-z0-9-]+)$/);
      if (match?.[1] && method === "GET") return this.json(response, 200, await this.store.get(match[1]));
      if (match?.[1] && method === "PUT") {
        const body = await this.readJson(request);
        if (typeof body.source !== "string") return this.json(response, 400, { error: "source must be a string" });
        await validateMermaid(body.source);
        const record = await this.store.update(match[1], {
          source: body.source,
          title: typeof body.title === "string" ? body.title : undefined,
          expectedVersion: typeof body.expectedVersion === "number" ? body.expectedVersion : undefined,
          summary: "Edited in workbench",
          actor: "human",
        });
        this.broadcast(record);
        return this.json(response, 200, record);
      }
      return this.text(response, 404, "Not found");
    } catch (error) {
      if (error instanceof DiagramConflictError) return this.json(response, 409, { error: error.message });
      if (error instanceof DiagramNotFoundError) return this.json(response, 404, { error: error.message });
      if (error instanceof MermaidSyntaxError) return this.json(response, 422, { error: error.message });
      return this.json(response, 500, { error: error instanceof Error ? error.message : "Unexpected server error" });
    }
  }

  private async readJson(request: NodeJS.ReadableStream): Promise<Record<string, unknown>> {
    let body = "";
    for await (const chunk of request) {
      body += String(chunk);
      if (body.length > 1_000_000) throw new Error("Request body is too large.");
    }
    return JSON.parse(body || "{}");
  }

  private events(request: NodeJS.ReadableStream, response: ServerResponse): void {
    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });
    response.write(": connected\n\n");
    this.clients.add(response);
    request.on("close", () => this.clients.delete(response));
  }

  private async file(response: ServerResponse, path: string, contentType: string): Promise<void> {
    await readFile(path);
    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": contentType.startsWith("text/html") ? "no-store" : "public, max-age=3600",
      "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    });
    createReadStream(path).pipe(response);
  }

  private json(response: ServerResponse, status: number, value: unknown): void {
    response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    response.end(JSON.stringify(value));
  }

  private text(response: ServerResponse, status: number, value: string): void {
    response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(value);
  }
}

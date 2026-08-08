import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { DiagramRecord, DiagramSummary } from "./types.js";

export class DiagramConflictError extends Error {}
export class DiagramNotFoundError extends Error {}

export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return slug || `diagram-${Date.now()}`;
}

function assertSafeId(id: string): void {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) {
    throw new Error("Diagram id must contain only lowercase letters, numbers, and hyphens.");
  }
}

export class DiagramStore {
  readonly directory: string;

  constructor(projectRoot: string) {
    this.directory = join(projectRoot, ".pi", "diagrams");
  }

  private metadataPath(id: string): string {
    assertSafeId(id);
    return join(this.directory, `${id}.json`);
  }

  private sourcePath(id: string): string {
    assertSafeId(id);
    return join(this.directory, `${id}.mmd`);
  }

  private async ensureDirectory(): Promise<void> {
    await mkdir(this.directory, { recursive: true });
  }

  private async atomicWrite(path: string, content: string): Promise<void> {
    const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temp, content, "utf8");
    await rename(temp, path);
  }

  async get(id: string): Promise<DiagramRecord> {
    try {
      const record = JSON.parse(await readFile(this.metadataPath(id), "utf8")) as DiagramRecord;
      record.source = await readFile(this.sourcePath(id), "utf8");
      return record;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new DiagramNotFoundError(`Diagram '${id}' does not exist.`);
      }
      throw error;
    }
  }

  async list(): Promise<DiagramSummary[]> {
    await this.ensureDirectory();
    const files = (await readdir(this.directory)).filter((file) => file.endsWith(".json"));
    const records = await Promise.all(
      files.map(async (file) => {
        try {
          return await this.get(basename(file, ".json"));
        } catch {
          return undefined;
        }
      }),
    );
    return records
      .filter((record): record is DiagramRecord => Boolean(record))
      .map(({ id, title, version, updatedAt }) => ({ id, title, version, updatedAt }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async create(input: { id?: string; title: string; source: string }): Promise<DiagramRecord> {
    await this.ensureDirectory();
    const baseId = slugify(input.id || input.title);
    let id = baseId;
    let suffix = 2;
    while (await this.exists(id)) id = `${baseId.slice(0, 59)}-${suffix++}`;

    const now = new Date().toISOString();
    const record: DiagramRecord = {
      id,
      title: input.title.trim() || id,
      version: 1,
      createdAt: now,
      updatedAt: now,
      source: input.source,
      versions: [{ version: 1, createdAt: now, source: input.source, actor: "agent", summary: "Created diagram" }],
    };
    await this.persist(record);
    return record;
  }

  async update(
    id: string,
    input: { source: string; title?: string; expectedVersion?: number; summary?: string; actor?: "agent" | "human" },
  ): Promise<DiagramRecord> {
    const current = await this.get(id);
    if (input.expectedVersion !== undefined && input.expectedVersion !== current.version) {
      throw new DiagramConflictError(
        `Version conflict for '${id}': expected v${input.expectedVersion}, current version is v${current.version}.`,
      );
    }
    if (input.source === current.source && (!input.title || input.title === current.title)) return current;

    const now = new Date().toISOString();
    const version = current.version + 1;
    const record: DiagramRecord = {
      ...current,
      title: input.title?.trim() || current.title,
      source: input.source,
      version,
      updatedAt: now,
      versions: [
        ...current.versions,
        {
          version,
          createdAt: now,
          source: input.source,
          actor: input.actor || "agent",
          summary: input.summary?.trim() || "Updated diagram",
        },
      ],
    };
    await this.persist(record);
    return record;
  }

  private async exists(id: string): Promise<boolean> {
    try {
      await this.get(id);
      return true;
    } catch (error) {
      if (error instanceof DiagramNotFoundError) return false;
      throw error;
    }
  }

  private async persist(record: DiagramRecord): Promise<void> {
    await this.ensureDirectory();
    const { source, ...metadata } = record;
    await this.atomicWrite(this.sourcePath(record.id), source);
    await this.atomicWrite(this.metadataPath(record.id), `${JSON.stringify({ ...metadata, source }, null, 2)}\n`);
  }
}

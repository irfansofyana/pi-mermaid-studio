export interface DiagramVersion {
  version: number;
  createdAt: string;
  source: string;
  summary?: string;
  actor: "agent" | "human";
}

export interface DiagramRecord {
  id: string;
  title: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  source: string;
  versions: DiagramVersion[];
}

export interface DiagramSummary {
  id: string;
  title: string;
  version: number;
  updatedAt: string;
}

export type DiagramAction = "create" | "update" | "get" | "list" | "open";

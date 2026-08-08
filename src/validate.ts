import { parseHTML } from "linkedom";

export class MermaidSyntaxError extends Error {}

let mermaidPromise: Promise<(typeof import("mermaid"))["default"]> | undefined;

async function mermaidParser(): Promise<(typeof import("mermaid"))["default"]> {
  if (!mermaidPromise) {
    const { window } = parseHTML("<!doctype html><html><body></body></html>");
    const globals = globalThis as Record<string, unknown>;
    globals.window ??= window;
    globals.document ??= window.document;
    globals.DOMParser ??= window.DOMParser;
    globals.Node ??= window.Node;
    globals.Element ??= window.Element;
    globals.HTMLElement ??= window.HTMLElement;
    globals.SVGElement ??= window.SVGElement;
    globals.navigator ??= window.navigator;
    mermaidPromise = import("mermaid").then((module) => module.default);
  }
  return mermaidPromise;
}

export async function validateMermaid(source: string): Promise<void> {
  if (!source.trim()) throw new MermaidSyntaxError("Mermaid source cannot be empty.");
  try {
    const mermaid = await mermaidParser();
    const result = await mermaid.parse(source, { suppressErrors: true });
    if (!result) throw new MermaidSyntaxError("Mermaid could not detect a valid diagram type or syntax.");
  } catch (error) {
    if (error instanceof MermaidSyntaxError) throw error;
    const message = error instanceof Error ? error.message.split("\n")[0] : "Invalid Mermaid syntax.";
    throw new MermaidSyntaxError(message);
  }
}

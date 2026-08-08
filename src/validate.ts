import mermaid from "mermaid";

export class MermaidSyntaxError extends Error {}

export async function validateMermaid(source: string): Promise<void> {
  if (!source.trim()) throw new MermaidSyntaxError("Mermaid source cannot be empty.");
  try {
    const result = await mermaid.parse(source, { suppressErrors: true });
    if (!result) throw new MermaidSyntaxError("Mermaid could not detect a valid diagram type or syntax.");
  } catch (error) {
    if (error instanceof MermaidSyntaxError) throw error;
    const message = error instanceof Error ? error.message.split("\n")[0] : "Invalid Mermaid syntax.";
    throw new MermaidSyntaxError(message);
  }
}

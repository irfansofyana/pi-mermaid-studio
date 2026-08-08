export type QualitySeverity = "info" | "warning";

export interface QualityWarning {
  code: string;
  severity: QualitySeverity;
  message: string;
}

function countMatches(source: string, pattern: RegExp): number {
  return [...source.matchAll(pattern)].length;
}

function diagramType(source: string): string {
  return source.trimStart().split(/\s+/)[0]?.toLowerCase() || "unknown";
}

/**
 * Conservative, forward-compatible quality checks. These rules never decide
 * whether Mermaid syntax is valid and intentionally avoid parsing the language.
 */
export function lintMermaid(source: string): QualityWarning[] {
  const warnings: QualityWarning[] = [];
  const type = diagramType(source);
  const meaningfulLines = source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("%%") && !line.startsWith("---"));

  const longLabels = meaningfulLines.filter((line) => {
    const labels = [...line.matchAll(/(?:\[|\(|\{|:|\|)([^\]\)\}\|]{48,})(?:\]|\)|\}|$|\|)/g)];
    return labels.length > 0;
  }).length;
  if (longLabels > 0) {
    warnings.push({
      code: "long-labels",
      severity: "warning",
      message: `${longLabels} line${longLabels === 1 ? " has" : "s have"} a long label. Shorten labels and move explanation into surrounding prose or a restrained note.`,
    });
  }

  const customColorCount = countMatches(source, /(?:#[0-9a-fA-F]{3,8}|rgb(?:a)?\()/g);
  if (customColorCount > 5) {
    warnings.push({
      code: "palette-sprawl",
      severity: "warning",
      message: `Found ${customColorCount} custom color uses. Prefer one accent plus neutral and semantic colors.`,
    });
  }

  const styleStatements = countMatches(source, /^\s*(?:style|classDef)\b/gm);
  if (styleStatements > 5) {
    warnings.push({
      code: "style-overload",
      severity: "warning",
      message: `Found ${styleStatements} styling declarations. Let the selected Mermaid theme carry most of the visual system.`,
    });
  }

  if (type === "sequencediagram") {
    const participants = countMatches(source, /^\s*(?:participant|actor|boundary|control|entity|database|collections|queue)\b/gm);
    const messages = countMatches(source, /(?:->>|-->>|->|-->|-\)|--\)|-x|--x)/g);
    const notes = countMatches(source, /^\s*note\b/gim);
    if (participants > 8) warnings.push({ code: "sequence-cast", severity: "warning", message: `The sequence has ${participants} declared participants. Group related actors or split the interaction by responsibility.` });
    if (messages > 24) warnings.push({ code: "sequence-density", severity: "warning", message: `The sequence has about ${messages} messages. Split happy path and exceptional behavior when they answer different questions.` });
    if (notes > 4) warnings.push({ code: "note-overload", severity: "info", message: `The sequence uses ${notes} notes. Keep only context that changes how the interaction is understood.` });
  }

  if (type === "flowchart" || type === "graph") {
    const edges = countMatches(source, /-->|---|-.->|==>/g);
    const direction = source.match(/^\s*(?:flowchart|graph)\s+(TB|TD|BT|RL|LR)/im)?.[1];
    if (edges > 28) warnings.push({ code: "flow-density", severity: "warning", message: `The flowchart has about ${edges} connections. Consider extracting a subsystem or alternate path into a second view.` });
    if (direction === "LR" && edges > 14) warnings.push({ code: "wide-layout", severity: "info", message: "This dense LR flow may become excessively wide. Try TD unless left-to-right order is the main story." });
  }

  if (type === "classdiagram" && meaningfulLines.length > 55) {
    warnings.push({ code: "class-detail", severity: "warning", message: "This class diagram is dense. Keep domain-significant members and relationships; omit routine getters, setters, and framework plumbing." });
  }

  if (type === "erdiagram") {
    const relationships = meaningfulLines.filter((line) => /\|[|o{}]|[|o{}]\|/.test(line));
    const unlabeled = relationships.filter((line) => !/:\s*\S+/.test(line)).length;
    if (unlabeled > 0) warnings.push({ code: "er-unlabeled", severity: "warning", message: `${unlabeled} ER relationship${unlabeled === 1 ? " is" : "s are"} unlabeled. Name relationships with a concise verb phrase.` });
  }

  if ((type === "statediagram" || type === "statediagram-v2") && meaningfulLines.length > 42) {
    warnings.push({ code: "state-density", severity: "warning", message: "This state diagram is dense. Use composite states or split lifecycle and failure recovery into separate views." });
  }

  if (type === "gantt") {
    const tasks = meaningfulLines.filter((line) => /:\s*(?:done,|active,|crit,|milestone,|[a-zA-Z0-9_-]+,|\d{4}-\d{2}-\d{2})/.test(line)).length;
    if (tasks > 28) warnings.push({ code: "gantt-detail", severity: "warning", message: `The Gantt contains about ${tasks} tasks. Show phases, dependencies, and milestones instead of reproducing the entire backlog.` });
  }

  if (meaningfulLines.length > 70 && warnings.every((item) => !item.code.endsWith("density"))) {
    warnings.push({ code: "diagram-density", severity: "info", message: `The diagram has ${meaningfulLines.length} meaningful lines. Confirm that it answers one clear question and split it if not.` });
  }

  return warnings;
}

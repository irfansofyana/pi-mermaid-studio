---
name: "pi-mermaid-studio"
description: "Guide Pi models to author validated, intentional engineering diagrams in raw Mermaid."
---

# Mermaid Studio

Author raw Mermaid diagrams that are technically accurate, visually intentional, and compatible with the Mermaid version bundled by Pi Mermaid Studio.

## Workflow

1. Identify the engineering question and audience.
2. Read `references/choosing-the-right-diagram.md`.
3. Load only the matching diagram guide plus `references/visual-quality.md`. Read `references/syntax-safety.md` when using unfamiliar or experimental syntax.
4. Inspect the available evidence. Never invent services, relationships, states, dates, or cardinalities.
5. Write complete raw Mermaid. Mermaid is the only canonical language; do not introduce a separate schema or DSL.
6. Call `mermaid_diagram` with `action: "validate"`.
7. Fix every syntax error. Address quality warnings that materially improve the diagram, but stop after at most two subjective refinement passes.
8. Create the diagram. For updates, retrieve it first and pass `expectedVersion`.
9. Open the workbench when visual review or export is useful.

## Core rules

- One diagram should answer one clear question at one abstraction level.
- Prefer short, parallel labels and meaningful identifiers.
- Use structure before decoration: direction, grouping, ordering, and whitespace.
- Use one accent plus neutral colors; reserve semantic colors for real meaning.
- Split overloaded diagrams instead of shrinking labels or adding more styling.
- Unknown syntax accepted by the pinned Mermaid parser is valid; advisory lint must never act as a second parser.
- C4 is experimental in Mermaid. State that limitation when choosing it.

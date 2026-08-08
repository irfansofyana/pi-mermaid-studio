---
name: mermaid-studio
description: Create and revise Mermaid diagrams with persistent project-local files and a live browser workbench. Use when a diagram will make architecture, sequence, state, hierarchy, or flow clearer.
---

# Mermaid Studio

Use the `mermaid_diagram` tool to create and maintain diagrams.

## Workflow

1. Choose the Mermaid diagram type that best communicates the relationship.
2. Call `mermaid_diagram` with `action: "create"`, a short stable id, a clear title, and complete Mermaid source.
3. Tell the user the diagram id and offer the returned workbench URL.
4. Before updating, call `get` and use its current `version` as `expectedVersion`.
5. Call `update` with complete revised source and a concise change summary.
6. If a version conflict occurs, retrieve the latest source and reconcile the requested change.

Prefer sequence diagrams for time-ordered interactions, flowcharts for branching processes, state diagrams for lifecycle transitions, and class/ER diagrams for structural models. Keep labels concise. Do not invent services, states, or relationships that the user did not establish.

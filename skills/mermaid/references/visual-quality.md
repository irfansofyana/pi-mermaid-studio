# Visual quality

Pinned documentation baseline: Mermaid 11.16.1
Official source: https://mermaid.js.org/config/theming.html

Design hierarchy through layout before color.

- Pick direction from topology: TD for deep branching, LR for short linear flows.
- Use consistent, parallel label grammar; target concise labels.
- Group only real boundaries or responsibilities.
- Use one primary accent, neutral support, and semantic warning/success colors only when meaningful.
- Avoid rainbow class definitions, decorative gradients, redundant notes, and huge titles inside nodes.
- Keep one abstraction level. Split a diagram when it needs tiny text, more than roughly 8 sequence actors, or several unrelated stories.
- Validate, render, then inspect aspect ratio, label wrapping, crossings, and density.

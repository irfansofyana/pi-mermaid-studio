# Syntax safety

Pinned documentation baseline: Mermaid 11.16.1
Official source: https://mermaid.js.org/intro/syntax-reference.html

Use syntax from the pinned Mermaid documentation and validate before saving.

- Prefer simple identifiers and quoted labels when punctuation is risky.
- Escape or quote special characters according to the selected diagram type.
- Do not guess experimental syntax.
- Mermaid's parser is authoritative. Quality warnings are advisory.
- On validation failure, repair the smallest relevant section and retry. Never replace a precise diagram with a vague one merely to make parsing pass.

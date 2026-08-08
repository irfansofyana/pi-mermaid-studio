# Gantt charts

Pinned documentation baseline: Mermaid 11.16.1
Official source: https://mermaid.js.org/syntax/gantt.html

Use for phases, dependencies, milestones, and critical work.

Skeleton:
```mermaid
gantt
  title Delivery plan
  dateFormat YYYY-MM-DD
  section Build
  MVP :active, mvp, 2026-08-10, 7d
  Release :milestone, after mvp, 0d
```

Use stable task IDs and explicit dependencies. Show decision-useful milestones and critical work, not an entire issue backlog. Do not invent dates; request or clearly state scheduling assumptions.

# Choosing the right diagram

Pinned documentation baseline: Mermaid 11.16.1
Official source: https://mermaid.js.org/intro/syntax-reference.html

Choose by question, not keyword:

- Interaction over time, retries, async calls: sequence.
- Branching process, algorithm, pipeline: flowchart.
- Services, resources, infrastructure boundaries: architecture.
- System context/container/component boundary: C4; keep one C4 level per view.
- Types, responsibilities, inheritance: class.
- Data entities, cardinality, optionality: ER.
- Lifecycle, triggers, guards, terminal states: state.
- Schedule, dependencies, milestones: Gantt.

Avoid architecture/C4 when the real question is request order. Avoid flowcharts for structural data relationships. If two questions compete, create two diagrams.

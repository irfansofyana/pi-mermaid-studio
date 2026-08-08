# Pi Mermaid Studio

A stateful Mermaid workbench for Pi: the agent creates and revises diagrams, while you edit Mermaid source beside a live browser preview.

## MVP

- One agent tool: `mermaid_diagram` (`create`, `update`, `get`, `list`, `open`)
- Project-local `.mmd` source and JSON version history under `.pi/diagrams/`
- Conflict-safe updates with `expectedVersion`
- Server-side Mermaid syntax validation before every saved version
- Localhost-only browser workbench with a capability URL
- Mermaid source + live client-side preview
- Direct human edits and SSE refresh when Pi changes a diagram
- `/mermaid [id]` command to reopen the workbench

## Try it locally

```bash
npm install
npm run check
pi -e /absolute/path/to/pi-mermaid-studio
```

Then ask Pi:

> Create a Mermaid sequence diagram for a login flow with MFA, token issuance, and refresh rotation. Open it in Mermaid Studio.

Or run `/mermaid` to open the most recently updated diagram.

## Storage

```text
.pi/diagrams/
├── login-flow.mmd   # canonical, Git-friendly Mermaid source
└── login-flow.json  # metadata and version history
```

The server binds to `127.0.0.1` on an ephemeral port and starts only when a diagram is created, updated, or opened. Mermaid renders in the browser; Chromium is not part of the conversational loop.

## Not in v0.1

PNG/PDF export, inline terminal images, visual node dragging, AI-generated variants, and MCP adapters are intentionally deferred until the Pi-first workflow proves useful.

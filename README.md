# Design-Code Registry MCP

A deterministic, project-agnostic [MCP](https://modelcontextprotocol.io) server that maps **design components,
tokens, and patterns** to their **code implementations** — across any design tool and any framework.

It's a lightweight, git-friendly alternative to Figma Code Connect, built as a generic knowledge layer that any
MCP-compatible AI coding agent (Claude Code, Cursor, Codex, OpenCode, ...) can query.

```
Figma Design  ↕  Design Component / Token / Pattern  ↕  Code Implementation
```

## Why this exists

AI coding agents are good at writing code but bad at knowing "does this project already have a Button component,
and if so, what's it called and where does it live?" Today that knowledge either lives in an agent's fuzzy
inference (unreliable) or is coupled tightly to one specific design tool + framework pairing (Figma Code Connect,
which is React/Figma-only).

**Core principle: exact registry data beats AI inference.** If the registry has an explicit mapping, the agent
should never need to guess it. If it doesn't, the agent should be told "unresolved" rather than making something up.

This project is:

- **Not an AI model.** It's a structured knowledge layer exposed through MCP tools.
- **Not a vector database / RAG.** Resolution is exact-match only (id, design reference, canonical name, alias) —
  never embeddings or fuzzy similarity.
- **Not tied to any framework or design tool.** React, Vue, Svelte, SwiftUI, Flutter, HTML — and Figma, Sketch,
  Penpot, or anything else — are all just strings in the schema, not special cases in the code.

## Architecture

```
                    AI Agent (Claude Code, Cursor, ...)
                             │
                             ↓
                       MCP Protocol (stdio)
                             │
                             ↓
                Design-Code Registry MCP  (this package — the generic engine)
                             │
                     FileRegistryProvider
                             │
              ┌──────────────┼──────────────┬─────────────┐
              ↓              ↓              ↓             ↓
         components.json  tokens.json  patterns.json  rules.json
                             │
                    .design/registry/   (your project — the data)
```

The **server** (this npm package) is generic and reusable across completely different projects. The **registry**
(`.design/registry/` in your project) is where all project-specific facts live, as plain JSON files that are
readable, diffable, and mergeable in git.

## Registry concepts

| Concept        | File               | What it captures |
| --------------- | ------------------ | ----------------- |
| **Manifest**    | `manifest.json`     | Schema version, project info, primary design tool. |
| **Component**   | `components.json`   | A design component (e.g. Button) → one or more code implementations, across languages/frameworks. |
| **Token**       | `tokens.json`       | A design token (color, spacing, typography, ...) with a stable id and value. |
| **Pattern**     | `patterns.json`     | A higher-level composition of components (e.g. "empty state" = message + Button). |
| **Rules**       | `rules.json`        | Structured project decisions an agent must respect (e.g. "reuse Button, don't create a new one"). |

A single component can have **multiple implementations** — the same design concept mapped to React, Vue, SwiftUI,
and Flutter simultaneously, if your project needs that:

```jsonc
{
  "id": "button",
  "name": "Button",
  "implementations": [
    { "language": "typescript", "framework": "react", "component": "Button", "sourcePath": "src/components/Button.tsx" },
    { "language": "dart", "framework": "flutter", "component": "AppButton", "sourcePath": "lib/widgets/app_button.dart" }
  ]
}
```

Design references are generic too — `tool` is an open string, not an enum, so adding support for a new design
tool never requires a schema migration:

```jsonc
{ "tool": "figma", "fileId": "abc123", "nodeId": "12:340", "url": "https://figma.com/file/abc123?node-id=12-340" }
```

See [`src/schema/`](./src/schema) for the full, commented schema (Zod), and
[`examples/fictional-project/`](./examples/fictional-project) for a complete worked example.

## Deterministic resolution

`registry_find_by_design_reference` and the underlying resolver never guess. They try, in this fixed order, and
stop at the first strategy that produces a match:

1. **Exact design reference** (tool + node/file/url/name)
2. **Exact registry id**
3. **Exact canonical name**
4. **Explicit alias**
5. Otherwise: **`unresolved`**

If a strategy matches more than one component, resolution stops there and reports `ambiguous` with every
candidate — it never silently picks one:

```jsonc
// unresolved
{ "status": "unresolved" }

// ambiguous
{ "status": "ambiguous", "strategy": "alias", "candidates": [ /* ... */ ] }

// resolved
{ "status": "resolved", "strategy": "design-reference", "component": { "id": "button", /* ... */ } }
```

## MCP tools

### Read

| Tool | Purpose |
| ---- | ------- |
| `registry_get_manifest` | Get registry metadata (schema version, project, design tool). |
| `registry_list_components` | List components, optionally filtered by status/tag. |
| `registry_get_component` | Fetch one component by exact id. |
| `registry_find_component` | Deterministic substring search across id/name/aliases/tags. |
| `registry_find_by_design_reference` | Resolve a design-tool reference to a component (see above). |
| `registry_list_tokens` | List tokens, optionally filtered by category. |
| `registry_get_token` | Fetch one token by exact id. |
| `registry_list_patterns` | List UI patterns. |
| `registry_get_pattern` | Fetch one pattern by exact id. |
| `registry_get_rules` | Get the full structured rules document. |
| `registry_validate` | Run full registry validation (see below). |

### Write

| Tool | Purpose |
| ---- | ------- |
| `registry_init` | Create a new starter registry. Fails if one exists (unless `force`). |
| `registry_create_component` | Create a component. Fails on duplicate id. |
| `registry_update_component` | Patch an existing component. Fails if the id doesn't exist. |
| `registry_deprecate_component` | Mark a component deprecated (no destructive delete exists). |
| `registry_create_token` / `registry_update_token` | Same create/update contract, for tokens. |
| `registry_create_pattern` / `registry_update_pattern` | Same create/update contract, for patterns. |
| `registry_update_rules` | Replace the full rules document (send the complete desired list). |

**Mutation safety:** creating an id that already exists is an error (use update instead); updating an id that
doesn't exist is an error (use create instead); there is no destructive delete for components — use
`registry_deprecate_component` so history survives in git.

## Validation

`registry_validate` (and `design-code-registry validate` in the CLI) checks the whole registry for:

- Duplicate ids within components/tokens/patterns/rules
- Duplicate design references (two components claiming the same Figma node)
- Broken references (a pattern pointing at a component that doesn't exist, a deprecation `replacedBy` pointing
  nowhere, a rule's `appliesTo.id` pointing nowhere)
- Circular pattern references (pattern A → related pattern B → related pattern A)
- Missing implementations on approved components (warning, not an error)

```json
{
  "valid": false,
  "errorCount": 1,
  "warningCount": 0,
  "issues": [
    { "severity": "error", "code": "BROKEN_REFERENCE", "message": "Pattern \"empty-state\" references component \"buton\", which does not exist.", "location": "pattern:empty-state" }
  ]
}
```

## CLI

Human-facing interface over the same `RegistryService` the MCP tools use — behavior never drifts between the two.

```bash
npx design-code-registry-mcp init --name "My Project" --design-tool figma

design-code-registry validate
design-code-registry list components --status approved
design-code-registry list tokens --category color
design-code-registry list patterns

design-code-registry add component --id button --name Button
design-code-registry add token --id color-primary --name "Primary" --category color --value "#3B5BFF"
design-code-registry add pattern --id empty-state --name "Empty State" --components button
```

Every command accepts `-p, --path <path>` to point at a specific registry, or reads `DESIGN_REGISTRY_PATH`.

## Installation

```bash
npm install -g design-code-registry-mcp
# or, without installing:
npx design-code-registry-mcp init

# or install locally:

npm run build

claude mcp add --scope project design-registry -- node /ABSOLUTE/PATH/TO/design-code-registry-mcp/dist/index.js
```

## Claude Code setup

Add the server to your Claude Code MCP configuration (`.mcp.json` at your project root, or via
`claude mcp add`):

```json
{
  "mcpServers": {
    "design-code-registry": {
      "command": "npx",
      "args": ["-y", "design-code-registry-mcp"]
    }
  }
}
```

Or, with an explicit registry path (useful in a monorepo):

```json
{
  "mcpServers": {
    "design-code-registry": {
      "command": "npx",
      "args": ["-y", "design-code-registry-mcp", "--registry-path=./packages/design-system/.design/registry"]
    }
  }
}
```

The server works with any MCP-compatible client over stdio — Claude Code is one client among several, not a
dependency of the server itself.

## Figma MCP integration

This server does **not** talk to the Figma API or inspect Figma files — that's
[Figma's own MCP server's](https://www.figma.com/) job. The two are designed to be complementary:

```
Figma MCP  →  design context (fileKey, nodeId, ...)  →  Design-Code Registry MCP  →  explicit mapping  →  AI agent  →  code
```

A typical agent workflow:

1. Agent asks **Figma MCP** for the selected node's `fileKey`/`nodeId`.
2. Agent calls `registry_find_by_design_reference` on **this server** with those identifiers.
3. If `resolved`, the agent reuses the returned implementation. If `unresolved`, the agent may propose a new
   component (per your project's rules) and register it with `registry_create_component`.

## Multi-framework example

A single registry can describe implementations across totally different codebases:

```
Button (design concept)
 ├── React        → src/components/Button.tsx
 ├── Vue          → src/components/Button.vue
 ├── SwiftUI      → Sources/Button.swift
 └── Flutter      → lib/widgets/app_button.dart
```

Nothing about the server changes based on which of these your project uses — the schema treats `language` and
`framework` as open strings.

## Example project

[`examples/fictional-project/`](./examples/fictional-project) contains a complete, validated example registry
(Button, Input, Card, Modal, two patterns, seven tokens, five rules) for a fictional "Aurora Design System." Copy
`.design/registry/` from there as a starting point, or run:

```bash
cp -r examples/fictional-project/.design .
```

## AI agent usage contract

Agents connected to this server should:

1. Query the registry **before** creating any reusable UI component.
2. Resolve exact mappings first — never guess a mapping when one might exist.
3. Reuse existing registered implementations rather than duplicating them.
4. Read relevant tokens and patterns before generating styles/layout.
5. Report `unresolved` honestly rather than inventing a mapping.
6. Never create a new canonical component when `registry_find_component` /
   `registry_find_by_design_reference` shows an equivalent one already exists.
7. Only propose a new component when no appropriate existing one exists.
8. Treat all registry mutations as explicit, deliberate actions — not incidental side effects.
9. Treat the registry as **authoritative** for project-specific Design ↔ Code facts.

At the same time, the registry doesn't own good engineering judgment: when it's incomplete or a more
maintainable approach is clearly available, an agent should say so — distinguishing **verified registry facts**
from **inferred information** and **recommendations** — rather than mechanically obeying an incomplete registry.

## Development

```bash
npm install
npm run build      # compile TypeScript → dist/
npm test           # build + run the full vitest suite (56 tests, including a real stdio subprocess e2e test)
npm run lint
npm run typecheck
```

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the project's design principles before opening a PR.

## Limitations & future improvements

- Only a local, file-based registry provider ships today. The `RegistryService` layer is provider-agnostic, so a
  remote/API-backed provider is possible without touching MCP tool logic — just not implemented yet.
- No optional HTTP/SSE transport yet (stdio only), per the "don't over-engineer the first version" principle.
- `registry_find_component` is a deterministic substring search, not a ranked/fuzzy search — by design, but it
  means very loose queries may return nothing where a human would expect a near-match.
- No built-in Figma/Sketch/Penpot API client — this server intentionally stays downstream of tools like Figma MCP
  rather than duplicating their job.

## License

[MIT](./LICENSE)

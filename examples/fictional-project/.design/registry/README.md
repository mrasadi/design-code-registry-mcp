# Design-Code Registry: Aurora Design System (Example)

This directory is a **Design-Code Registry** — a deterministic, machine- and
human-readable mapping between design components/tokens/patterns and their
code implementations. It is consumed by AI coding agents through the
[Design-Code Registry MCP](https://github.com/) server, and by humans via the
`design-code-registry` CLI.

## Files

- `manifest.json` — registry metadata (schema version, project info, design tool).
- `components.json` — design components mapped to one or more code implementations.
- `tokens.json` — design tokens (color, spacing, typography, ...).
- `patterns.json` — higher-level UI patterns composed of components.
- `rules.json` — structured project decisions/constraints for agents to follow.

## Editing

You can edit these files directly (they're plain JSON, git-diff-friendly), or
use the CLI:

```
design-code-registry add component
design-code-registry add token
design-code-registry add pattern
design-code-registry validate
```

AI agents connected via MCP should query this registry before creating new
UI components, and treat it as authoritative for project-specific
Design ↔ Code mappings.

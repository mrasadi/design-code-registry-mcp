# Contributing to Design-Code Registry MCP

Thanks for considering a contribution! This project aims to stay small,
deterministic, and framework-agnostic — please keep that in mind when
proposing changes.

## Development setup

```bash
git clone https://github.com/<org>/design-code-registry-mcp.git
cd design-code-registry-mcp
npm install
npm run build
npm test
```

Useful scripts:

| Command             | What it does                                   |
| -------------------- | ----------------------------------------------- |
| `npm run dev`        | Run the MCP server over stdio with live reload  |
| `npm run cli`        | Run the CLI from source (no build step needed)  |
| `npm run typecheck`  | Type-check without emitting                     |
| `npm run lint`       | Lint `src/` and `test/`                          |
| `npm run format`     | Format with Prettier                             |
| `npm test`           | Build, then run the full vitest suite            |

## Design principles (please read before opening a PR)

1. **The server must stay project-agnostic.** Never hard-code a framework,
   a design tool, a file path, or a project's naming conventions into `src/`.
   Anything project-specific belongs in a registry (`.design/registry/`), not
   in code.
2. **Deterministic over clever.** Resolution and validation logic must never
   guess, fuzzy-match, or call out to an LLM/embeddings. If a mapping is
   ambiguous or missing, say so explicitly (`ambiguous` / `unresolved`)
   rather than picking the "probably right" answer.
3. **No silent data loss.** Mutating tools must never overwrite or delete
   existing registry data implicitly. Creating an existing id is an error;
   removing a component happens via deprecation, not deletion.
3. **Schema changes are breaking changes.** If you change the shape of
   `Component`, `Token`, `Pattern`, or `Rule`, bump `CURRENT_SCHEMA_VERSION`
   in `src/schema/manifest.ts` and document the migration in `CHANGELOG.md`.
4. **Registry data stays human-readable.** Keep JSON output 2-space indented,
   deterministically ordered, and diff-friendly. Don't introduce a database.

## Making a change

1. Fork the repo and create a branch off `main`.
2. Add or update tests in `test/` for any behavior change — PRs without test
   coverage for new logic will be asked to add it.
3. Run `npm run typecheck && npm run lint && npm test` locally before
   opening a PR.
4. Update `README.md` and/or `CHANGELOG.md` if you're changing public
   behavior (new MCP tool, new CLI command, schema change).
5. Open a PR with a clear description of *what* changed and *why*.

## Reporting bugs / requesting features

Please open a GitHub issue with:

- What you expected to happen
- What actually happened (including any `registry_validate` output, if relevant)
- Your registry's `manifest.json` `schemaVersion`
- Steps to reproduce, ideally with a minimal registry

## Code of conduct

Be respectful, assume good intent, and keep discussion focused on the
technical merits of a change.

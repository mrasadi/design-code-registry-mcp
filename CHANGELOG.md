# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0] - Unreleased

### Added

- Initial implementation of the Design-Code Registry MCP server.
- File-based registry provider (`.design/registry/*.json`).
- Registry schema: manifest, components, tokens, patterns, rules — all
  design-tool- and framework-agnostic.
- Deterministic resolution engine (design reference → registry id → canonical
  name → alias → unresolved/ambiguous). No AI inference, no embeddings.
- Comprehensive validation: duplicate ids, duplicate design references, broken
  cross-references, circular pattern references.
- 20 MCP tools (11 read, 9 write) exposed over stdio transport.
- `design-code-registry` CLI: `init`, `validate`, `list`, `add`.
- Example fictional registry (Button, Input, Card, Modal) under `examples/`.
- Full automated test suite, including a real stdio-subprocess end-to-end test.

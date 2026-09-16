# LumoHub MCP Setup

## Defaults

`.mcp.json` enables only the low-context core servers:

- **Serena**: semantic navigation, references, refactoring, and project-aware code memory.
- **Context7**: current official documentation for libraries and frameworks.
- **Fetch**: reading web/API documentation.

The native Codex filesystem, shell, and Git capabilities remain preferred for local files and Git operations. Do not enable duplicate MCP tools for routine work.

## On-demand servers

`mcp.full.example.json` contains optional servers for GitHub, PostgreSQL/DBHub, Playwright, sequential thinking, Sentry, Grafana, memory-kg, and Docker Gateway. Copy only the server needed for the current task into `.mcp.json`; do not expose every schema by default.

Required environment variables:

- `GITHUB_PERSONAL_ACCESS_TOKEN` for GitHub MCP.
- `DATABASE_URL` for DBHub. Use a read-only database role for investigation tasks.
- `GRAFANA_URL` and `GRAFANA_SERVICE_ACCOUNT_TOKEN` for Grafana.
- Sentry requires its interactive/authenticated MCP flow.
- `LUMOHUB_MCP_MEMORY_FILE` is the absolute path to the memory JSONL file when using memory-kg.

Never place credentials in `.mcp.json`, commit `.env`, or create fake credentials. On Windows, Node-based stdio servers use `cmd /c`; Python servers use `uvx`.

## Project memory

Short, source-verified notes are kept under `.mcp-memory/`. They contain architecture, conventions, commands, and confirmed risks only; do not store secrets, full source files, long logs, chat history, or temporary output.

## Agent workflow

1. Search for symbols and references before opening large files.
2. Inspect only the relevant file ranges and progressively discover database schema.
3. Use Context7 when a library API or version behavior is uncertain.
4. Use DBHub for live schema/query facts rather than guessing.
5. Use GitHub MCP for remote repository/issues/PR state rather than guessing.
6. Run the smallest relevant lint, test, build, or firmware check after edits.
7. Never commit or push unless explicitly requested.

## Validation status

The core configuration has been written for this Windows environment. Fetch is pinned with `mcp<2` because the current `mcp-server-fetch` package imports an API removed in MCP 2.0. Server startup still depends on first-run package downloads and, for optional servers, the credentials listed above. Validate each server independently when it is needed; do not start all servers together.

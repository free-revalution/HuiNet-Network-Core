# Changelog

## 2.0.0 — Local Agent Fabric

### Breaking
- Removed cross-machine P2P / network keys as the product core
- CLI rewritten around a singleton local hub

### Added
- Local Hub on `127.0.0.1:19527` (HTTP) and `:19528` (WS)
- Agent inventory scanner (Claude Code, Cursor, Codex, Copilot, OpenClaw, Gemini, OpenCode, Windsurf, Kiro, …)
- Same-machine A2A bus (`a2a.*` JSON-RPC + MCP tools)
- Context Hub memory store with Claude / Codex / Cursor session importers
- MCP server (`dist/src/mcp/server.js`) and `huinet mcp install-config`
- CC Switch–style desktop UI (`apps/desktop`) with optional Tauri tray shell

### Commands
`start|stop|status`, `agents *`, `context *`, `bus *`, `mcp install-config`, `app`, `doctor`

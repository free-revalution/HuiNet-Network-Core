# Changelog

## 2.2.0 — Desktop fabric

- Electron desktop shell: frameless macOS titlebar, vibrancy/glass UI, tray quit
- Network canvas: draggable agent nodes, pan/pinch zoom, Instagram-style live border chase
- Hub chip with load / net / tok / mem; edges start at hub border; stroke width follows token traffic
- Bus messages carry `tokens` (explicit or estimated); UI accumulates traffic for stable edge weight
- `huinet app --quit` / `--stop-hub`; README rewritten for open-source first impression

## 2.1.2 — Full UI control surface

- All day-to-day ops available in the web UI (A2A toggles, connect/disconnect all, context CRUD, bus, doctor)
- Test phase: Hub still started via `huinet start`; desktop self-start deferred to final release
- APIs: `GET /api/doctor`, `POST /api/agents/disconnect-all`, `DELETE /api/context/:id`

## 2.1.1 — Frontend A2A controls

- UI: per-agent A2A open/close switches + one-click「一键全连」
- Persist open set in `~/.huinet/network-access.json`
- `POST /api/agents/:id/a2a`, `POST /api/agents/connect-all`
- A2A peer list / bus fanout only includes open agents
- CLI: `agents connect|disconnect|connect-all`

## 2.1.0 — Usability

- CLI auto-starts the local hub when needed (`agents`, `context`, `bus`, `app`, `doctor`)
- `huinet agents connect <id>` and `POST /api/mcp/wire` one-click MCP wiring
- `huinet mcp status` / `GET /api/mcp/status`
- Desktop UI: wire MCP per agent, show wiring status
- Richer session import (highlights → decision memories, project inference)

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

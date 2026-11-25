# HuiNet

**Your agents already live on one machine. HuiNet turns them into a network.**

<p align="center">
  <strong>Local Agent Fabric</strong> — discover · share context · A2A on <code>127.0.0.1</code>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#what-you-get">Features</a> ·
  <a href="docs/agent-integration.md">Agent Integration</a> ·
  <a href="docs/api-reference.md">API</a> ·
  <a href="#license">MIT</a>
</p>

---

Claude Code, Cursor, Codex, Gemini CLI, OpenClaw… they share a laptop but not a memory.
HuiNet is a **same-machine fabric**: a local hub that finds what you installed, opens an A2A bus between them, and keeps a shared context layer you can migrate.

No cloud account. No cross-WAN P2P. Just a fabric on your desk.

```
   Claude ──┐
   Cursor ──┼──►  HuiNet Hub  ──►  shared memory · token traffic · desktop fabric UI
   Codex  ──┘         │
                 127.0.0.1:19527
```

## Why HuiNet

| Pain | What HuiNet does |
|------|------------------|
| Context trapped in each tool’s session files | Import Claude / Codex / Cursor transcripts into one memory hub |
| Agents can’t see each other | Inventory scan + A2A open/close per agent |
| “Wire MCP” means hand-editing JSON everywhere | One-click connect; Hub writes MCP where adapters exist |
| Dashboards that feel like settings panels | A **network** UI — nodes, live edges, token-weighted links |

HuiNet is **not** a model router (that’s Magpie / CC Switch). It’s the fabric underneath: who is on the machine, who is on the bus, what they remember together.

## What you get

- **Inventory** — fingerprint PATH, home dirs, and processes; list agents without modifying them  
- **A2A bus** — same-machine messages over MCP tools or WebSocket JSON-RPC  
- **Context hub** — facts / decisions / imports; export a migration pack as Markdown  
- **Desktop fabric** — Electron shell, liquid-glass console, draggable topology, token-thick edges  
- **Local-only** — Hub binds to `127.0.0.1` (HTTP `:19527`, WS `:19528`)

## Quick Start

```bash
git clone https://github.com/free-revalution/HuiNet-Network-Core.git
cd HuiNet-Network-Core

npm install
npm run build && npm run build:ui
npm link                          # optional: global `huinet`

huinet app                        # launches desktop + Hub
# or:  huinet start && open http://127.0.0.1:19527
```

In the UI: **扫描** → toggle agents onto the fabric → import sessions → watch token traffic on the edges.

```bash
huinet app --quit                 # leave the desktop shell
huinet stop                       # stop the Hub daemon
```

### CLI cheatsheet

| Command | Purpose |
|---------|---------|
| `huinet start \| stop \| status` | Hub lifecycle |
| `huinet app` / `huinet app --quit` | Desktop window |
| `huinet agents scan \| list \| connect-all` | Inventory & A2A |
| `huinet context import --from claude\|codex\|cursor` | Session → memory |
| `huinet context migrate --out ctx.md` | Export pack |
| `huinet bus send --to '*' --message '…'` | Broadcast on fabric |
| `huinet mcp install-config --write` | Drop MCP snippet |
| `huinet doctor` | Health checks |

## How it fits together

```
┌─────────────┐   MCP / WS    ┌──────────────────────┐
│  Agents     │◄─────────────►│  Local Hub           │
│  (scanned)  │               │  inventory · bus ·   │
└─────────────┘               │  context · MCP       │
                              └──────────┬───────────┘
                                         │
                              ┌──────────▼───────────┐
                              │  Desktop fabric UI   │
                              │  (Electron + Hub)    │
                              └──────────────────────┘
```

**Compatibility layers**

1. **Passive discovery** — no agent changes required to appear in inventory  
2. **MCP** — `list_agents`, `send_message`, `context_*`, `scan_agents`  
3. **WS JSON-RPC** — `a2a.register` / `a2a.send` / `a2a.listAgents`  
4. **Importers** — read-only Claude JSONL, Codex rollouts, Cursor transcripts  

Details: [Agent Integration](docs/agent-integration.md) · [API Reference](docs/api-reference.md)

## Data on disk

```
~/.huinet/
  config.json
  inventory.json
  network-access.json     # which agents are open on A2A
  daemon.pid
  desktop.pid
  token
  context/memories/…
```

## Development

```bash
npm run dev:daemon                # Hub in the foreground
npm run build:ui                  # Vite UI → apps/desktop/dist
cd apps/desktop && npm run desktop  # Electron (starts Hub if needed)
npm test
```

## Scope

**In**

- Same-machine fabric, MCP, local UI, session import / migrate  

**Out (for now)**

- Cross-LAN / public P2P without a relay  
- Replacing Magpie / CC Switch model gateways  
- Cloud sync and accounts  

Legacy P2P notes live under [`docs/archive/`](docs/archive/).

## Related

If you need **model routing**, look at [Magpie](https://github.com/yetone/magpie) or [CC Switch](https://github.com/farion1231/cc-switch).  
If you need **peer chat between MCP agents**, see projects like agent-comm-hub / AgentMux.  
HuiNet sits beside them: **the local network graph and shared memory**, not the provider switchboard.

## License

[MIT](LICENSE)

# Install

## Requirements

- Node.js >= 18
- npm

Optional desktop shell:

- Rust toolchain (for Tauri)
- macOS / Windows / Linux

## Install from source

```bash
git clone https://github.com/free-revalution/HuiNet-Network-Core.git
cd HuiNet-Network-Core
npm install
npm run build
npm link
```

## Verify

```bash
huinet start
huinet doctor
huinet agents scan
huinet stop
```

## Desktop UI

```bash
npm run build:ui
huinet start
huinet app
```

Tauri (optional):

```bash
cd apps/desktop
npm install
npm run tauri build
```

# HuiNet Desktop

CC Switch–style control console for the local hub.

## Web UI (default)

Built assets are served by the hub at `http://127.0.0.1:19527/` after:

```bash
npm run build
# from repo root:
npm run build:ui
huinet start
huinet app
```

## Tauri shell (tray)

Requires a recent Rust toolchain (Cargo with edition 2024 support). Then:

```bash
cd apps/desktop
npm install
npm run tauri dev
# or
npm run tauri build
```

If `tauri build` fails on crate edition features, upgrade Rust (`rustup update`) and retry.

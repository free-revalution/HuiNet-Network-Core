# HuiNet Desktop

Electron shell + fabric UI for the local Hub.

## Run

From the **repo root**:

```bash
npm run build && npm run build:ui
huinet app
```

The shell starts the Hub if needed, opens a frameless window (`hiddenInset` traffic lights on macOS), and loads `http://127.0.0.1:19527/`.

```bash
huinet app --quit          # quit desktop
huinet app --quit --stop-hub
huinet app --browser       # debug in system browser
```

## Develop UI only

```bash
cd apps/desktop
npm install                # uses .npmrc Electron mirror when needed
npm run dev                # Vite on :1420
npm run build              # → dist/ (served by Hub)
npm run desktop            # Electron against local main.cjs
```

## Notes

- Primary UX is the **network canvas** (draggable nodes, token-weighted edges), not a settings grid.
- Tauri scaffolding remains under `src-tauri/` for a future native pack; day-to-day shell is Electron.

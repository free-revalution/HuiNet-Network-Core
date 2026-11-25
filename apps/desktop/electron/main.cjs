/**
 * HuiNet desktop shell (Electron)
 * - Starts Local Hub as a child process
 * - Opens a native window (not the system browser)
 */

const { app, BrowserWindow, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

const HUB_HOST = '127.0.0.1';
const HUB_PORT = 19527;
const HUB_URL = `http://${HUB_HOST}:${HUB_PORT}/`;

let mainWindow = null;
let tray = null;
let hubProc = null;
let quitting = false;

function repoRoot() {
  // apps/desktop/electron -> apps/desktop -> repo
  return path.resolve(__dirname, '../../..');
}

function hubEntry() {
  const root = repoRoot();
  const candidates = [
    path.join(root, 'dist/cli/hub/run-daemon.js'),
    path.join(root, 'bin/huinet'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

function uiDistIndex() {
  return path.join(__dirname, '../dist/index.html');
}

function hubHealthy() {
  return new Promise((resolve) => {
    const req = http.get(
      { hostname: HUB_HOST, port: HUB_PORT, path: '/api/health', timeout: 800 },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForHub(ms = 15000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await hubHealthy()) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

function nodeBin() {
  // Prefer a real Node binary; Electron's execPath needs ELECTRON_RUN_AS_NODE
  const candidates = [
    process.env.npm_node_execpath,
    process.env.NODE_BINARY,
    '/usr/local/bin/node',
    '/opt/homebrew/bin/node',
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return { bin: c, asNode: false };
  }
  return { bin: process.execPath, asNode: true };
}

function startHub() {
  if (hubProc) return;
  const entry = hubEntry();
  const root = repoRoot();
  const node = nodeBin();
  const env = { ...process.env };
  if (node.asNode) env.ELECTRON_RUN_AS_NODE = '1';

  hubProc = spawn(node.bin, [entry], {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  hubProc.stdout?.on('data', (d) => {
    if (process.env.HUINET_DEBUG) process.stdout.write(`[hub] ${d}`);
  });
  hubProc.stderr?.on('data', (d) => {
    if (process.env.HUINET_DEBUG) process.stderr.write(`[hub] ${d}`);
  });
  hubProc.on('exit', (code) => {
    hubProc = null;
    if (!quitting && process.env.HUINET_DEBUG) {
      console.warn('Hub exited', code);
    }
  });
}

async function ensureHub() {
  if (await hubHealthy()) return true;
  startHub();
  return waitForHub();
}

function stopHub() {
  if (!hubProc) return;
  try {
    hubProc.kill('SIGTERM');
  } catch {
    // ignore
  }
  hubProc = null;
}

function createWindow() {
  const isMac = process.platform === 'darwin';

  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    title: 'HuiNet',
    // Transparent + vibrancy → liquid glass behind the UI
    backgroundColor: '#00000000',
    transparent: true,
    ...(isMac
      ? {
          titleBarStyle: 'hiddenInset',
          trafficLightPosition: { x: 16, y: 18 },
          vibrancy: 'fullscreen-ui',
          visualEffectState: 'active',
        }
      : {
          frame: true,
        }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  if (isMac) {
    // Keep native traffic lights visible inside the inset titlebar
    mainWindow.setWindowButtonVisibility(true);
  }

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  mainWindow.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  // Content is loaded by the ready handler after Hub is up
}

function createTray() {
  const iconPath = path.join(__dirname, '../src-tauri/icons/icon.png');
  const image = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createEmpty();
  tray = new Tray(image.isEmpty() ? nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAFUlEQVQ4T2NkYGD4z0ABYBw1gGE0DFABAAbqA/+5bQe/AAAAAElFTkSuQmCC'
  ) : image.resize({ width: 16, height: 16 }));

  const menu = Menu.buildFromTemplate([
    {
      label: '打开 HuiNet',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    {
      label: '在浏览器打开（调试）',
      click: () => shell.openExternal(HUB_URL),
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        quitting = true;
        app.quit();
      },
    },
  ]);
  tray.setToolTip('HuiNet');
  tray.setContextMenu(menu);
  tray.on('click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

function desktopPidPath() {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  return path.join(home, '.huinet', 'desktop.pid');
}

function writeDesktopPid() {
  try {
    const p = desktopPidPath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, String(process.pid), 'utf-8');
  } catch {
    // ignore
  }
}

function clearDesktopPid() {
  try {
    const p = desktopPidPath();
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {
    // ignore
  }
}

app.whenReady().then(async () => {
  writeDesktopPid();
  createTray();
  createWindow();
  // Show a local splash while Hub boots (avoids blank white frame)
  if (mainWindow) {
    await mainWindow.loadURL(
      'data:text/html;charset=utf-8,' +
        encodeURIComponent(
          `<!doctype html><html><head><meta charset="utf-8"><title>HuiNet</title>
<style>html,body{height:100%;margin:0;background:transparent;color:#12141a;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}
main{display:grid;place-items:center;height:100%}p{opacity:.55}</style></head>
<body><main><div><h1 style="margin:0 0 .5rem">HuiNet</h1><p>正在启动本地 Hub…</p></div></main></body></html>`
        )
    );
  }

  const ok = await ensureHub();
  if (mainWindow) {
    if (ok) {
      await mainWindow.loadURL(HUB_URL);
    } else {
      const index = uiDistIndex();
      if (fs.existsSync(index)) {
        await mainWindow.loadFile(index);
      } else {
        await mainWindow.loadURL(
          'data:text/html;charset=utf-8,' +
            encodeURIComponent(
              '<h2 style="font-family:sans-serif;padding:2rem">Hub 启动失败。请在仓库执行 npm run build 后重试。</h2>'
            )
        );
      }
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow?.show();
  });
});

app.on('before-quit', () => {
  quitting = true;
  clearDesktopPid();
  stopHub();
});

app.on('window-all-closed', () => {
  // keep tray alive on macOS
  if (process.platform !== 'darwin') {
    quitting = true;
    app.quit();
  }
});

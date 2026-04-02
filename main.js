const { app, BrowserWindow, ipcMain, Tray, Menu, screen, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const OpenClawBridge = require('./openclaw-bridge');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('enable-transparent-visuals');
app.disableHardwareAcceleration();

let mainWindow, chatWindow = null, settingsWindow = null, tray, bridge;
let isDragging = false, isWalking = false;

const CHARACTERS = ['MascotAzusa', 'MascotYui', 'MascotMio', 'MascotRitsu', 'MascotTsumugi'];
const CHAR_NAMES = { MascotAzusa: 'Azusa', MascotYui: 'Yui', MascotMio: 'Mio', MascotRitsu: 'Ritsu', MascotTsumugi: 'Mugi' };
let currentCharacter = 'MascotAzusa';

function getFramesDir() { return path.join(__dirname, 'frames', currentCharacter); }
function getMetadata() {
  try { return JSON.parse(fs.readFileSync(path.join(getFramesDir(), 'metadata.json'), 'utf-8')); }
  catch (e) { return null; }
}

// ===== Action labels (per character) =====
const ACTION_LABELS = {
  MascotAzusa:  { drag: '✋ 拎起', special1: '🎭 特殊动作 1', special2: '🎭 特殊动作 2' },
  MascotYui:    { drag: '✋ 拎起', special1: '🎭 特殊动作 1', special2: '🎭 特殊动作 2', special3: '🎭 特殊动作 3' },
  MascotMio:    { drag: '✋ 拎起', special1: '🎭 特殊动作 1', special2: '🎭 特殊动作 2' },
  MascotRitsu:  { drag: '✋ 拎起', special1: '🎭 特殊动作 1', special2: '🎭 特殊动作 2' },
  MascotTsumugi:{ drag: '✋ 拎起', special1: '🎭 特殊动作 1', special2: '🎭 特殊动作 2' },
};

function getActionMenu() {
  const meta = getMetadata();
  if (!meta) return [];
  const actions = [];
  actions.push({ label: '🧍 站立', click: () => mainWindow.webContents.send('do-action', 'idle') });
  actions.push({ label: '🚶 散步', click: () => mainWindow.webContents.send('do-action', 'walk') });

  const labels = ACTION_LABELS[currentCharacter] || {};
  for (const [animName, label] of Object.entries(labels)) {
    if (meta.animations[animName]) {
      actions.push({ label, click: () => mainWindow.webContents.send('do-action', animName) });
    }
  }
  return actions;
}

// ===== Windows =====
function createWindow() {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;
  mainWindow = new BrowserWindow({
    width: 100, height: 110,
    x: screenW - 150, y: screenH - 130,
    title: '', frame: false, transparent: true,
    alwaysOnTop: true, resizable: false, skipTaskbar: true,
    hasShadow: false, thickFrame: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  mainWindow.setIgnoreMouseEvents(false);
  mainWindow.loadFile('index.html');
  mainWindow.on('ready-to-show', () => mainWindow.show());
  if (process.argv.includes('--dev')) mainWindow.webContents.openDevTools({ mode: 'detach' });
}

function createChatWindow() {
  if (chatWindow && !chatWindow.isDestroyed()) { chatWindow.focus(); return; }
  const [petX, petY] = mainWindow.getPosition();
  const [petW, petH] = mainWindow.getSize();
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;
  const chatW = 360, chatH = 480;
  let chatX = petX - chatW - 10;
  if (chatX < 0) chatX = petX + petW + 10;
  let chatY = petY + petH - chatH;
  if (chatY < 0) chatY = 10;
  if (chatY + chatH > screenH) chatY = screenH - chatH - 10;

  chatWindow = new BrowserWindow({
    width: chatW, height: chatH, x: chatX, y: chatY,
    frame: false, transparent: true, alwaysOnTop: true,
    resizable: true, skipTaskbar: true, hasShadow: false, thickFrame: false,
    minWidth: 280, minHeight: 360, maxWidth: 600, maxHeight: 800,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  chatWindow.loadFile('chat.html');
  chatWindow.on('closed', () => { chatWindow = null; });
  if (process.argv.includes('--dev')) chatWindow.webContents.openDevTools({ mode: 'detach' });
}

function closeChatWindow() {
  if (chatWindow && !chatWindow.isDestroyed()) { chatWindow.close(); chatWindow = null; }
}
function toggleChatWindow() {
  if (chatWindow && !chatWindow.isDestroyed()) closeChatWindow();
  else createChatWindow();
}

function showContextMenu() {
  const actions = getActionMenu();
  const menu = Menu.buildFromTemplate([
    { label: `♪ ${CHAR_NAMES[currentCharacter] || 'Pet'}`, enabled: false },
    { type: 'separator' },
    ...actions,
    { type: 'separator' },
    { label: '👤 切换角色', submenu: CHARACTERS.map(c => ({
      label: CHAR_NAMES[c], type: 'radio', checked: c === currentCharacter,
      click: () => { currentCharacter = c; mainWindow.webContents.send('switch-character', c); },
    }))},
    { type: 'separator' },
    { label: '💬 跟曼波聊天', click: () => createChatWindow() },
    { label: '🔊 声音开/关', click: () => mainWindow.webContents.send('toggle-sound') },
    { label: '📌 回到原位', click: () => {
      const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
      mainWindow.setPosition(sw - 200, sh - 150);
    }},
    { label: '⚙️ OpenClaw 设置', click: () => createSettingsWindow() },
    { type: 'separator' },
    { label: '❌ 退出', click: () => app.quit() },
  ]);
  menu.popup({ window: mainWindow });
}

function createTray() {
  const iconPath = path.join(__dirname, 'icon.png');
  let trayIcon;
  if (fs.existsSync(iconPath)) trayIcon = nativeImage.createFromPath(iconPath);
  else trayIcon = nativeImage.createEmpty();
  tray = new Tray(trayIcon);
  tray.setToolTip('pxpet Desktop Pet');
  tray.on('click', () => toggleChatWindow());
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'pxpet Desktop Pet ♪', enabled: false },
    { type: 'separator' },
    { label: '💬 跟曼波聊天', click: () => createChatWindow() },
    { label: '⚙️ OpenClaw 设置', click: () => createSettingsWindow() },
    { type: 'separator' },
    { label: '❌ 退出', click: () => app.quit() },
  ]));
}

// ===== IPC =====
ipcMain.on('get-character', (e) => { e.returnValue = currentCharacter; });
ipcMain.on('get-char-name', (e) => { e.returnValue = CHAR_NAMES[currentCharacter] || 'Pet'; });
ipcMain.on('get-frames-dir', (e) => { e.returnValue = getFramesDir(); });
ipcMain.on('get-metadata', (e) => { e.returnValue = getMetadata(); });

ipcMain.on('drag-start', () => { isDragging = true; });
ipcMain.on('drag-move', (e, { screenX, screenY, offsetX, offsetY }) => {
  if (isDragging) mainWindow.setPosition(Math.round(screenX - offsetX), Math.round(screenY - offsetY));
});
ipcMain.on('drag-end', () => { isDragging = false; });

ipcMain.on('resize-window', (e, { width, height }) => {
  if (isWalking || isDragging) return;
  const w = Math.round(Math.max(width, 60));
  const h = Math.round(Math.max(height, 60));
  const [curW, curH] = mainWindow.getSize();
  if (curW !== w || curH !== h) mainWindow.setSize(w, h);
});

// Synchronous resize — used before walk starts
ipcMain.on('resize-now', (e, { width, height }) => {
  const w = Math.round(Math.max(width, 60));
  const h = Math.round(Math.max(height, 60));
  mainWindow.setSize(w, h);
  e.returnValue = true;
});

ipcMain.on('show-context-menu', () => showContextMenu());
ipcMain.on('toggle-chat', () => toggleChatWindow());
ipcMain.on('close-chat', () => closeChatWindow());
ipcMain.on('chat-drag', (e, { screenX, screenY, offsetX, offsetY }) => {
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.setPosition(Math.round(screenX - offsetX), Math.round(screenY - offsetY));
  }
});

ipcMain.on('walk-start', () => { isWalking = true; });
ipcMain.on('walk-stop', () => { isWalking = false; });

// Walk step with wrap-around (no collision, teleport to other side)
ipcMain.on('walk-step', (e, { dx, dy }) => {
  if (!dx && !dy) return;
  const [x, y] = mainWindow.getPosition();
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;
  const [winW, winH] = mainWindow.getSize();

  let newX = x + (dx || 0);
  let newY = y + (dy || 0);

  if (newX < -winW) newX = screenW;
  if (newX > screenW) newX = -winW;
  if (newY < -winH) newY = screenH;
  if (newY > screenH) newY = -winH;

  mainWindow.setPosition(Math.round(newX) || 0, Math.round(newY) || 0);
});

// OpenClaw
ipcMain.handle('openclaw-chat', async (e, message, imageDataUrl) => {
  if (bridge) return await bridge.sendToOpenClaw(message, imageDataUrl);
  return { error: 'OpenClaw bridge not connected' };
});
ipcMain.on('push-openclaw-message', (e, message) => {
  if (chatWindow && !chatWindow.isDestroyed()) chatWindow.webContents.send('openclaw-push', message);
});

// Settings window
function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) { settingsWindow.focus(); return; }
  settingsWindow = new BrowserWindow({
    width: 400, height: 340,
    frame: false, resizable: false, alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  settingsWindow.loadFile('settings.html');
  settingsWindow.on('closed', () => { settingsWindow = null; });
}

// Settings IPC
ipcMain.on('get-openclaw-config', (e) => {
  e.returnValue = {
    url: bridge ? bridge.gatewayUrl : '',
    token: bridge ? bridge.gatewayToken : '',
  };
});

ipcMain.handle('save-openclaw-config', async (e, { url, token }) => {
  try {
    // Test connection first
    const http = require('http');
    const https = require('https');
    const testResult = await new Promise((resolve) => {
      const parsedUrl = new URL(url.replace('/v1/chat/completions', '/'));
      const mod = parsedUrl.protocol === 'https:' ? https : http;
      const req = mod.request(parsedUrl, { method: 'GET', timeout: 5000 }, (res) => {
        resolve({ ok: true });
      });
      req.on('error', (err) => resolve({ ok: false, error: err.message }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'Timeout' }); });
      req.end();
    });

    // Save config regardless (user might fix gateway later)
    const configDir = app.getPath('userData');
    const configPath = path.join(configDir, 'openclaw-config.json');
    fs.writeFileSync(configPath, JSON.stringify({ gatewayUrl: url, gatewayToken: token }, null, 2));

    // Reload bridge config
    if (bridge) {
      bridge.gatewayUrl = url;
      bridge.gatewayToken = token;
    }

    if (testResult.ok) {
      return { ok: true };
    } else {
      return { ok: true, warning: `Saved, but gateway unreachable: ${testResult.error}` };
    }
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// App
app.whenReady().then(() => {
  createWindow();
  createTray();
  bridge = new OpenClawBridge(mainWindow);
  bridge.start();
});
app.on('window-all-closed', () => {});
app.on('before-quit', () => { if (bridge) bridge.stop(); });

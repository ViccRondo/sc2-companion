/**
 * SC2 Companion - Electron 主进程
 */

const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, globalShortcut, screen } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const WebSocket = require('ws');

// 配置
const CONFIG = {
  serverUrl: process.env.SC2_SERVER_URL || 'ws://localhost:8765',
  wsReconnectInterval: 3000
};

let mainWindow = null;
let tray = null;
let ws = null;
let isConnected = false;
let sc2Monitor = null;

// 截图模块（智能前台窗口）
const screenshot = require('./screenshot');

// 录像分析模块
const replayAnalyzer = require('./replay-analyzer');

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 280,
    height: 380,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    x: screen.getPrimaryDisplay().workArea.width - 300,
    y: 100,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.hide();

  // 开发模式
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

// 创建系统托盘
function createTray() {
  const iconPath = path.join(__dirname, '../assets/icon.png');
  let trayIcon;
  
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      trayIcon = createDefaultIcon();
    }
  } catch (e) {
    trayIcon = createDefaultIcon();
  }

  tray = new Tray(trayIcon);
  updateTrayMenu();

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });

  tray.on('double-click', () => {
    mainWindow.show();
  });
}

// 创建默认图标
function createDefaultIcon() {
  // 创建一个简单的 16x16 图标
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);
  
  // 填充紫色背景
  for (let i = 0; i < size * size; i++) {
    canvas[i * 4] = 138;     // R
    canvas[i * 4 + 1] = 43; // G
    canvas[i * 4 + 2] = 226; // B
    canvas[i * 4 + 3] = 255; // A
  }
  
  return nativeImage.createFromBuffer(canvas, {
    width: size,
    height: size
  });
}

// 更新托盘菜单
function updateTrayMenu() {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示/隐藏', click: () => mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show() },
    { label: '─────────', enabled: false },
    { label: `状态: ${isConnected ? '✓ 已连接' : '✗ 未连接'}`, enabled: false },
    { label: '─────────', enabled: false },
    { label: '🎮 截帧分析 (Ctrl+Shift+C)', click: () => captureAndAnalyze() },
    { label: '📊 查看状态', click: () => showStatus() },
    { label: '─────────', enabled: false },
    { label: '❌ 退出', click: () => app.quit() }
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip(`SC2 Companion ${isConnected ? '✓' : '✗'}`);
}

// WebSocket 连接
function connectWebSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  console.log('[WS] 连接:', CONFIG.serverUrl);

  ws = new WebSocket(CONFIG.serverUrl, {
    handshakeTimeout: 5000
  });

  ws.on('open', () => {
    console.log('[WS] 已连接');
    isConnected = true;
    updateTrayMenu();
    mainWindow?.webContents.send('connection-status', true);
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      handleServerMessage(message);
    } catch (e) {
      console.error('[WS] 消息解析失败:', e.message);
    }
  });

  ws.on('close', () => {
    console.log('[WS] 连接断开');
    isConnected = false;
    updateTrayMenu();
    mainWindow?.webContents.send('connection-status', false);
    setTimeout(connectWebSocket, CONFIG.wsReconnectInterval);
  });

  ws.on('error', (err) => {
    console.error('[WS] 错误:', err.message);
  });
}

// 处理服务器消息
function handleServerMessage(message) {
  switch (message.type) {
    case 'advice':
    case 'alert':
    case 'timing':
    case 'vision':
    case 'tts':
      mainWindow?.webContents.send('advice', message);
      
      // 播放音频
      if (message.ttsUrl) {
        mainWindow?.webContents.send('play-audio', message.ttsUrl);
      }
      break;
      
    case 'connected':
      console.log('[WS] 服务器确认连接');
      break;
  }
}

// 截图并分析（智能前台窗口）
async function captureAndAnalyze() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.log('[WS] 未连接');
    return;
  }

  console.log('[Capture] 截取前台窗口...');
  
  try {
    // 优先截取前台窗口（智能自动）
    const screenshotData = await screenshot.captureForeground();
    
    // 备用：全屏截图
    const data = screenshotData?.data || await screenshot.captureScreen()?.data;
    
    if (data) {
      ws.send(JSON.stringify({
        type: 'screenshot',
        data: data,
        windowTitle: screenshotData?.windowTitle || 'Unknown',
        timestamp: Date.now()
      }));
      console.log('[Capture] 截图已发送');
      
      // 通知 UI
      mainWindow?.webContents.send('capture-started');
    } else {
      console.log('[Capture] 截图失败');
    }
  } catch (e) {
    console.error('[Capture] 截图失败:', e.message);
  }
}

// 显示状态
function showStatus() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.log('状态: 未连接');
    return;
  }
  
  ws.send(JSON.stringify({
    type: 'status_request',
    timestamp: Date.now()
  }));
}

// 注册全局快捷键
function registerShortcuts() {
  // Ctrl+Shift+C: 截帧分析
  globalShortcut.register('CommandOrControl+Shift+C', () => {
    captureAndAnalyze();
  });

  // Ctrl+Shift+H: 显示/隐藏窗口
  globalShortcut.register('CommandOrControl+Shift+H', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });

  console.log('[Shortcuts] 全局快捷键已注册');
}

// IPC 处理
ipcMain.handle('get-connection-status', () => isConnected);

ipcMain.on('capture-screen', () => {
  captureAndAnalyze();
});

ipcMain.on('analyze-replay', (event, filePath) => {
  // 设置进度回调
  replayAnalyzer.setProgressCallback((data) => {
    mainWindow?.webContents.send('replay-progress', data);
  });
  
  // 设置发送函数
  replayAnalyzer.setSendFunction((data) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        ...data,
        type: 'replay_' + data.type
      }));
    }
  });
  
  // 开始分析
  replayAnalyzer.analyzeReplay(filePath, ws);
});

ipcMain.on('move-window', (event, { x, y }) => {
  if (mainWindow) {
    mainWindow.setPosition(x, y);
  }
});

ipcMain.on('hide-window', () => {
  mainWindow?.hide();
});

ipcMain.on('show-window', () => {
  mainWindow?.show();
});

ipcMain.on('update-game-state', (event, state) => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      ...state,
      timestamp: Date.now()
    }));
  }
});

// 应用生命周期
app.whenReady().then(() => {
  createWindow();
  createTray();
  connectWebSocket();
  registerShortcuts();

  console.log('╔═══════════════════════════════════╗');
  console.log('║   SC2 Companion 已启动           ║');
  console.log('║   按 Ctrl+Shift+C 截帧分析        ║');
  console.log('║   按 Ctrl+Shift+H 显示/隐藏       ║');
  console.log('╚═══════════════════════════════════╝');
});

app.on('window-all-closed', () => {
  // 不退出，在托盘运行
});

app.on('before-quit', () => {
  if (ws) ws.close();
  globalShortcut.unregisterAll();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

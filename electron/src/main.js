/**
 * SC2 Companion - Electron 主进程
 */

const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const WebSocket = require('ws');
const https = require('https');

// 配置
const CONFIG = {
  serverUrl: process.env.SC2_SERVER_URL || 'ws://localhost:8765',
  wsReconnectInterval: 3000
};

let mainWindow = null;
let tray = null;
let ws = null;
let isConnected = false;

// SC2 状态
let sc2State = {
  gameTime: 0,
  resources: { minerals: 0, vespene: 0, foodUsed: 0, foodCap: 0 },
  event: 'idle'
};

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 300,
    height: 400,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // 调试模式
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

// 创建系统托盘
function createTray() {
  // 创建一个简单的图标
  const iconPath = path.join(__dirname, '../assets/icon.png');
  let trayIcon;
  
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
  } catch (e) {
    // 如果没有图标，创建一个空白图标
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示/隐藏', click: () => toggleWindow() },
    { label: '连接状态: 未连接', enabled: false, id: 'status' },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ]);

  tray.setToolTip('SC2 Companion');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => toggleWindow());
}

// 切换窗口显示
function toggleWindow() {
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
  }
}

// WebSocket 连接
function connectWebSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    return;
  }

  console.log('[WS] 连接到:', CONFIG.serverUrl);
  
  try {
    ws = new WebSocket(CONFIG.serverUrl);

    ws.on('open', () => {
      console.log('[WS] 已连接');
      isConnected = true;
      updateTrayStatus('已连接');
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
      updateTrayStatus('未连接');
      mainWindow?.webContents.send('connection-status', false);
      
      // 自动重连
      setTimeout(connectWebSocket, CONFIG.wsReconnectInterval);
    });

    ws.on('error', (err) => {
      console.error('[WS] 错误:', err.message);
    });
  } catch (e) {
    console.error('[WS] 连接失败:', e.message);
    setTimeout(connectWebSocket, CONFIG.wsReconnectInterval);
  }
}

// 处理服务器消息
function handleServerMessage(message) {
  switch (message.type) {
    case 'advice':
    case 'alert':
    case 'timing':
    case 'vision':
      mainWindow?.webContents.send('advice', message);
      // 播放 TTS
      if (message.ttsUrl) {
        mainWindow?.webContents.send('play-audio', message.ttsUrl);
      }
      break;
    case 'tts':
      mainWindow?.webContents.send('play-audio', message.audioUrl);
      break;
  }
}

// 更新托盘状态
function updateTrayStatus(status) {
  if (!tray) return;
  
  const menu = Menu.buildFromTemplate([
    { label: '显示/隐藏', click: () => toggleWindow() },
    { label: `连接状态: ${status}`, enabled: false },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ]);
  tray.setContextMenu(menu);
  tray.setToolTip(`SC2 Companion - ${status}`);
}

// 捕获屏幕（模拟 SC2 API 数据）
function captureScreen() {
  // 这里需要调用系统的截图功能
  // 暂时用占位符，实际需要集成 screenshot 库
  return null;
}

// 发送游戏状态到服务器
function sendGameState(state) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }

  // 合并当前状态和新状态
  sc2State = { ...sc2State, ...state };
  
  // 发送状态
  ws.send(JSON.stringify({
    ...sc2State,
    timestamp: Date.now()
  }));
}

// IPC 处理
ipcMain.handle('get-connection-status', () => isConnected);

ipcMain.on('update-state', (event, state) => {
  sendGameState(state);
});

ipcMain.on('capture-screen', async (event) => {
  // 截图并发送给服务器
  const screenshot = await captureScreen();
  if (screenshot) {
    sendGameState({ screenshot });
  }
});

ipcMain.on('move-window', (event, { x, y }) => {
  if (mainWindow) {
    mainWindow.setPosition(x, y);
  }
});

ipcMain.on('hide-window', () => {
  mainWindow?.hide();
});

// 应用启动
app.whenReady().then(() => {
  createWindow();
  createTray();
  connectWebSocket();
});

app.on('window-all-closed', () => {
  // 不退出，在托盘运行
});

app.on('before-quit', () => {
  if (ws) {
    ws.close();
  }
});

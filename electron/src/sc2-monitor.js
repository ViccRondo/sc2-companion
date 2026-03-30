/**
 * SC2 API 监控脚本
 * 
 * 使用 PySC2 的 SC2API 读取游戏状态
 * 需要 SC2 安装在默认位置
 * 
 * Windows: C:\Program Files (x86)\StarCraft II\
 * Mac: /Applications/StarCraft II/
 * Linux: ~/StarCraftII/
 */

const WebSocket = require('ws');
const { spawn } = require('child_process');

// 配置
const CONFIG = {
  sc2Path: process.env.SC2_PATH || 'C:\\Program Files (x86)\\StarCraft II\\SC2_x64.exe',
  serverUrl: process.env.SC2_SERVER_URL || 'ws://localhost:8765',
  pollInterval: 1000, // 1秒轮询
  screenshotInterval: 5000 // 5秒截图
};

let ws = null;
let lastState = {};
let screenshotTimer = null;

// 连接 WebSocket
function connect() {
  ws = new WebSocket(CONFIG.serverUrl, {
    reconnect: true,
    reconnectInterval: 3000
  });

  ws.on('open', () => {
    console.log('[SC2 Monitor] 已连接到服务器');
    sendState({ event: 'connected' });
  });

  ws.on('close', () => {
    console.log('[SC2 Monitor] 连接断开，3秒后重连...');
  });

  ws.on('error', (err) => {
    console.error('[SC2 Monitor] WebSocket错误:', err.message);
  });
}

// 发送状态
function sendState(state) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  
  ws.send(JSON.stringify({
    ...state,
    timestamp: Date.now()
  }));
}

// 轮询 SC2 API
function pollState() {
  // 这里需要调用 Python 脚本或直接使用 SC2 API
  // 暂时用占位符
  const state = {
    gameTime: Math.floor(process.hrtime().bigint() / BigInt(1000000000)) % 3600,
    resources: {
      minerals: 0,
      vespene: 0,
      foodUsed: 0,
      foodCap: 200
    },
    event: 'idle'
  };
  
  // 检测变化
  if (hasChanged(state)) {
    sendState(state);
    lastState = state;
  }
}

// 检测状态变化
function hasChanged(newState) {
  if (Object.keys(lastState).length === 0) return true;
  
  const keys = ['gameTime', 'resources', 'event'];
  for (const key of keys) {
    if (JSON.stringify(newState[key]) !== JSON.stringify(lastState[key])) {
      return true;
    }
  }
  return false;
}

// 截图
function captureScreen() {
  // 调用截图工具
  // 实际需要集成 screenshot 库
  return null;
}

// 主循环
function main() {
  console.log('[SC2 Monitor] 启动中...');
  console.log('[SC2 Monitor] SC2 路径:', CONFIG.sc2Path);
  
  connect();
  
  // 状态轮询
  setInterval(pollState, CONFIG.pollInterval);
  
  // 定期截图（可选）
  // setInterval(() => {
  //   const screenshot = captureScreen();
  //   if (screenshot) {
  //     sendState({ screenshot });
  //   }
  // }, CONFIG.screenshotInterval);
}

// 启动
main();

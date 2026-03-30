/**
 * SC2 Companion - 监控入口
 * 
 * 简化版：主要通过截图+手动触发
 * SC2 API 集成作为可选增强
 */

const WebSocket = require('ws');
const { spawn, exec } = require('child_process');
const https = require('https');
const { Buffer } = require('buffer');

// 配置
const CONFIG = {
  serverUrl: process.env.SC2_SERVER_URL || 'ws://localhost:8765',
  sc2ApiHost: process.env.SC2_API_HOST || '127.0.0.1',
  sc2ApiPort: process.env.SC2_API_PORT || '5000',
  minimaxApiKey: process.env.MINIMAX_API_KEY,
  screenshotInterval: 8000,  // 8秒截图一次（节省token）
  eventCheckInterval: 1000   // 1秒检查一次事件
};

let ws = null;
let isGameActive = false;
let gameStartTime = 0;
let lastScreenshotTime = 0;
let screenshotCount = 0;

// 游戏状态
let gameState = {
  gameTime: 0,
  resources: { minerals: 0, vespene: 0, foodUsed: 0, foodCap: 200 },
  event: 'idle'
};

// ============ WebSocket 服务器连接 ============

function connectServer() {
  ws = new WebSocket(CONFIG.serverUrl, {
    reconnect: true,
    reconnectInterval: 3000
  });

  ws.on('open', () => {
    console.log('[Monitor] 已连接 Companion 服务器');
    send({ type: 'connected', source: 'sc2-monitor' });
  });

  ws.on('close', () => {
    console.log('[Monitor] 服务器断开，3秒后重连...');
  });

  ws.on('error', (err) => {
    console.error('[Monitor] WebSocket 错误:', err.message);
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      handleServerMessage(msg);
    } catch (e) {}
  });
}

function send(data) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({
    ...data,
    timestamp: Date.now()
  }));
}

// 处理服务器消息
function handleServerMessage(msg) {
  if (msg.type === 'ping') {
    send({ type: 'pong' });
  }
}

// ============ 截图功能 ============

// 截图并发送给服务器
async function captureAndSend() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  if (!CONFIG.minimaxApiKey) {
    console.log('[Monitor] 未配置 MINIMAX_API_KEY，跳过截图');
    return;
  }

  // 简化：发送当前状态，不含截图
  // 后续集成真正的截图功能
  send({
    ...gameState,
    screenshot: null,
    screenshotId: `shot_${++screenshotCount}`
  });
}

// ============ 状态检测（简化版）============

function updateState(updates) {
  const oldState = { ...gameState };
  gameState = { ...gameState, ...updates };
  
  // 检测事件
  detectEvents(oldState, gameState);
}

function detectEvents(old, now) {
  // 资源溢出检测
  if (now.resources.minerals > 1000 && old.resources.minerals <= 1000) {
    gameState.event = 'resource';
    send(gameState);
  }
  
  // 气溢出检测
  if (now.resources.vespene > 500 && old.resources.vespene <= 500) {
    gameState.event = 'resource';
    send(gameState);
  }
  
  // 人口满检测
  if (now.resources.foodUsed >= now.resources.foodCap && 
      old.resources.foodUsed < old.resources.foodCap) {
    gameState.event = 'population';
    send(gameState);
  }
  
  // 游戏时间推进
  if (now.gameTime > old.gameTime) {
    gameState.event = 'time';
    send(gameState);
  }
}

// ============ 手动触发接口 ============

// 哥哥可以通过快捷键或命令行触发
function manualTrigger() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.log('[Monitor] 未连接到服务器');
    return;
  }
  
  console.log('[Monitor] 手动触发分析');
  captureAndSend();
}

// 接收命令行参数
function handleCommand(args) {
  switch (args[0]) {
    case 'capture':
    case 'c':
      manualTrigger();
      break;
    case 'state':
      console.log('[Monitor] 当前状态:', JSON.stringify(gameState, null, 2));
      break;
    case 'connect':
      connectServer();
      break;
    case 'quit':
      if (ws) ws.close();
      process.exit(0);
      break;
  }
}

// ============ 主循环 ============

function startPolling() {
  console.log('[Monitor] 启动状态轮询');
  
  // 定期截图
  setInterval(() => {
    if (isGameActive) {
      captureAndSend();
    }
  }, CONFIG.screenshotInterval);
  
  // 模拟游戏时间（用于测试）
  // 实际应该从 SC2 API 读取
  setInterval(() => {
    if (isGameActive) {
      gameState.gameTime += 1;
      updateState({});
    }
  }, 1000);
  
  // 监听命令行输入（用于测试）
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.on('data', (key) => {
      if (key === 'c') {
        manualTrigger();
      } else if (key === 'q') {
        process.exit(0);
      } else if (key === 's') {
        isGameActive = !isGameActive;
        console.log('[Monitor] 游戏状态:', isGameActive ? '进行中' : '已暂停');
      }
    });
  }
}

// ============ SC2 API 集成（预留）============

// 这个函数用于后续集成真实的 SC2 API
function setSC2State(apiData) {
  const newState = {
    gameTime: apiData.gameLoop / 22.4, // 转换为秒
    resources: {
      minerals: apiData.player?.minerals || 0,
      vespene: apiData.player?.vespene || 0,
      foodUsed: apiData.player?.foodUsed || 0,
      foodCap: apiData.player?.foodCap || 200
    },
    event: 'normal'
  };
  
  updateState(newState);
}

// ============ 启动 ============

function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║   SC2 Companion Monitor v1.0         ║');
  console.log('║   本小姐的星际争霸教练系统            ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');
  console.log('[Monitor] 配置:');
  console.log('  服务器:', CONFIG.serverUrl);
  console.log('  SC2 API:', `${CONFIG.sc2ApiHost}:${CONFIG.sc2ApiPort}`);
  console.log('');
  console.log('[Monitor] 操作说明:');
  console.log('  c - 手动截帧分析');
  console.log('  s - 开始/暂停游戏监控');
  console.log('  q - 退出');
  console.log('');
  
  // 解析命令行参数
  const args = process.argv.slice(2);
  if (args.length > 0) {
    handleCommand(args);
  }
  
  // 启动
  connectServer();
  startPolling();
  
  // 默认开启游戏监控（用于测试）
  isGameActive = true;
  console.log('[Monitor] 游戏状态: 进行中（按 s 可暂停）');
}

main();

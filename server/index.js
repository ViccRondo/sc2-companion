/**
 * SC2 Companion Server
 * WebSocket 服务端，接收客户端数据，转发给本小姐的 skill
 */

require('dotenv').config();
const WebSocket = require('ws');
const path = require('path');

// 复用 skill 的逻辑
const { SC2StateTracker } = require('./skill-tracker');
const { analyzeWithVision, synthesizeSpeech } = require('./ai-service');

// 配置
const CONFIG = {
  port: process.env.SC2_COMPANION_PORT || 8765
};

class SC2CompanionServer {
  constructor() {
    this.wss = null;
    this.tracker = new SC2StateTracker();
    this.clients = new Set();
  }

  async start() {
    this.wss = new WebSocket.Server({ port: CONFIG.port });

    this.wss.on('connection', (ws) => {
      console.log('[SC2 Companion] 客户端连接');
      this.clients.add(ws);

      ws.on('message', async (message) => {
        try {
          const state = JSON.parse(message);
          await this.handleGameState(ws, state);
        } catch (e) {
          console.error('[SC2 Companion] 处理消息失败:', e.message);
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log('[SC2 Companion] 客户端断开');
      });

      ws.on('error', (err) => {
        console.error('[SC2 Companion] WebSocket错误:', err.message);
      });
    });

    console.log(`[SC2 Companion] 服务器启动在端口 ${CONFIG.port}`);
    console.log('[SC2 Companion] 等待客户端连接...');
  }

  async handleGameState(ws, state) {
    // 重置追踪（游戏开始）
    if (state.event === 'game_start') {
      this.tracker.reset();
      return;
    }

    // 分析事件
    const eventAdvices = this.tracker.analyzeEvent(state);

    // 如果有截图，进行视觉分析
    let visionAdvice = null;
    if (state.screenshot) {
      try {
        visionAdvice = await analyzeWithVision(state.screenshot, state);
      } catch (e) {
        console.error('[SC2 Companion] 视觉分析失败:', e.message);
      }
    }

    // 合并建议
    const allAdvices = [...eventAdvices];
    if (visionAdvice) {
      allAdvices.push(visionAdvice);
    }

    // 按优先级排序
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    allAdvices.sort((a, b) => 
      (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3)
    );

    // 发送建议并合成语音
    for (const advice of allAdvices.slice(0, 2)) { // 最多2条，避免打扰
      // 发送文字建议
      ws.send(JSON.stringify(advice));

      // TTS（异步，不阻塞）
      if (advice.message) {
        synthesizeSpeech(advice.message).then(audioUrl => {
          if (audioUrl && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ 
              type: 'tts', 
              audioUrl,
              refId: advice.refId 
            }));
          }
        }).catch(e => {
          console.error('[SC2 Companion] TTS失败:', e.message);
        });
      }
    }
  }

  broadcast(message) {
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    }
  }
}

// 启动
const server = new SC2CompanionServer();
server.start().catch(console.error);

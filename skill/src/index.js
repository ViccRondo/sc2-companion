/**
 * SC2 Companion Skill - 本小姐的星际争霸2教练技能
 */

const WebSocket = require('ws');
const https = require('https');
const fs = require('fs');
const path = require('path');

// 知识库
const KNOWLEDGE = {
  timing: require('./knowledge/timing'),
  units: require('./knowledge/units'),
  strategy: require('./knowledge/strategy')
};

// 配置
const CONFIG = {
  port: process.env.SC2_COMPANION_PORT || 8765,
  minimaxApiKey: process.env.MINIMAX_API_KEY,
  minimaxTtsUrl: 'https://api.minimax.chat/v1/t2a_v2',
  minimaxVlmUrl: 'https://api.minimax.chat/v1/chat_completion_v2'
};

// SC2 游戏状态追踪
class SC2StateTracker {
  constructor() {
    this.lastResources = { minerals: 0, vespene: 0 };
    this.lastFood = { used: 0, cap: 0 };
    this.seenEnemyUnits = new Set();
    this.idleStartTime = null;
    this.lastAdviceTime = 0;
    this.adviceCooldown = 5000; // 5秒冷却
  }

  analyzeEvent(state) {
    const { resources, foodUsed, foodCap, event, units } = state;
    const advices = [];

    // 冷却检查
    if (Date.now() - this.lastAdviceTime < this.adviceCooldown) {
      return advices;
    }

    // 资源溢出检测
    if (resources.minerals > 1000) {
      advices.push({
        type: 'alert',
        priority: 'high',
        message: `资源溢出！矿有${resources.minerals}，建议建造更多建筑或开矿`
      });
    }
    if (resources.vespene > 500) {
      advices.push({
        type: 'alert',
        priority: 'high', 
        message: `气矿溢出！气有${resources.vespene}，记得采集或使用`
      });
    }

    // 人口检测
    if (foodUsed >= foodCap) {
      advices.push({
        type: 'alert',
        priority: 'urgent',
        message: '人口满了！立即补充人口'
      });
    } else if (foodUsed >= foodCap - 5) {
      advices.push({
        type: 'alert',
        priority: 'medium',
        message: `人口即将满了（${foodUsed}/${foodCap}），准备补人口`
      });
    }

    // idle检测
    if (event === 'idle' && !this.idleStartTime) {
      this.idleStartTime = Date.now();
    } else if (event !== 'idle') {
      this.idleStartTime = null;
    }
    if (this.idleStartTime && Date.now() - this.idleStartTime > 10000) {
      advices.push({
        type: 'alert',
        priority: 'medium',
        message: '建造队列空闲超过10秒！不要卡人口'
      });
    }

    // timing检测 - 根据游戏时间
    const gameTimeSeconds = state.gameTime || 0;
    const timingAdvice = KNOWLEDGE.timing.getAdvice(gameTimeSeconds);
    if (timingAdvice) {
      advices.push(timingAdvice);
    }

    // 兵种检测
    const newEnemyUnits = this.detectNewEnemyUnits(units?.enemy);
    if (newEnemyUnits.length > 0) {
      const counterAdvice = KNOWLEDGE.units.getCounterAdvice(newEnemyUnits);
      if (counterAdvice) {
        advices.push(counterAdvice);
      }
    }

    if (advices.length > 0) {
      this.lastAdviceTime = Date.now();
    }

    return advices;
  }

  detectNewEnemyUnits(enemyUnits) {
    const newUnits = [];
    if (!enemyUnits) return newUnits;
    
    for (const unit of enemyUnits) {
      if (!this.seenEnemyUnits.has(unit.type)) {
        this.seenEnemyUnits.add(unit.type);
        newUnits.push(unit.type);
      }
    }
    return newUnits;
  }

  reset() {
    this.seenEnemyUnits.clear();
    this.idleStartTime = null;
  }
}

// M2.7 视觉分析
async function analyzeWithVision(screenshot, gameState) {
  if (!CONFIG.minimaxApiKey) {
    return null;
  }

  const prompt = `你是星际争霸2的教练。分析这张游戏截图和以下游戏数据，给出简洁的建议：

游戏数据：
- 时间：${Math.floor((gameState.gameTime || 0) / 60)}分${(gameState.gameTime || 0) % 60}秒
- 矿：${gameState.resources?.minerals || 0}
- 气：${gameState.resources?.vespene || 0}
- 人口：${gameState.resources?.foodUsed || 0}/${gameState.resources?.foodCap || 0}
- 事件：${gameState.event || 'normal'}

请给出简短（50字以内）的战术建议。格式：
[建议] 你的建议`;

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'MiniMax-M2.7',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${screenshot}` } }
          ]
        }
      ],
      max_tokens: 200
    });

    const options = {
      hostname: 'api.minimax.chat',
      path: '/v1/chat_completion_v2',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.minimaxApiKey}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          const advice = response.choices?.[0]?.message?.content || '';
          resolve({ type: 'advice', message: advice.replace('[建议]', '').trim() });
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// TTS 合成
async function synthesizeSpeech(text) {
  if (!CONFIG.minimaxApiKey) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'speech-02-hd',
      text,
      stream: true,
      voice_setting: {
        voice_id: 'male-yunyang',
        speed: 1.1,
        vol: 1.0,
        pitch: 0
      }
    });

    const options = {
      hostname: 'api.minimax.chat',
      path: '/v1/t2a_v2',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.minimaxApiKey}`,
        'Content-Type': 'application/json'
      }
    };

    const chunks = [];
    const req = https.request(options, (res) => {
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const audioBase64 = buffer.toString('base64');
        resolve(`data:audio/mp3;base64,${audioBase64}`);
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// WebSocket 服务器
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
    });

    console.log(`[SC2 Companion] 服务器启动在端口 ${CONFIG.port}`);
  }

  async handleGameState(ws, state) {
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

    // 发送建议并合成语音
    for (const advice of allAdvices) {
      ws.send(JSON.stringify(advice));

      // TTS
      if (advice.message) {
        try {
          const audioUrl = await synthesizeSpeech(advice.message);
          if (audioUrl) {
            ws.send(JSON.stringify({ ...advice, ttsUrl: audioUrl }));
          }
        } catch (e) {
          console.error('[SC2 Companion] TTS失败:', e.message);
        }
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

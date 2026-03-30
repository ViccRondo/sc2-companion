/**
 * SC2 Companion - 录像复盘模块
 * 
 * 解析 .SC2Replay 文件，逐帧分析游戏
 */

const path = require('path');
const fs = require('fs');
const https = require('https');
const { Buffer } = require('buffer');

// 配置
const CONFIG = {
  analysisInterval: 30, // 每30秒分析一次
  minimaxApiKey: process.env.MINIMAX_API_KEY || ''
};

// 进度回调
let onProgressCallback = null;

// WebSocket 发送函数（由 main.js 注入）
let sendToServer = null;

/**
 * 设置发送函数
 */
function setSendFunction(fn) {
  sendToServer = fn;
}

/**
 * 设置进度回调
 */
function setProgressCallback(cb) {
  onProgressCallback = cb;
}

/**
 * 分析录像文件
 */
async function analyzeReplay(replayPath, wsInstance = null) {
  console.log('[Replay] 开始分析:', replayPath);
  
  if (!fs.existsSync(replayPath)) {
    console.error('[Replay] 文件不存在:', replayPath);
    sendToUI({ type: 'error', message: '文件不存在' });
    return;
  }

  // 获取录像信息
  const info = await getReplayInfo(replayPath);
  if (!info) {
    sendToUI({ type: 'error', message: '无法读取录像' });
    return;
  }

  console.log(`[Replay] 游戏时长: ${info.duration}秒`);
  
  // 发送开始分析
  sendToUI({
    type: 'replay_start',
    mapName: info.mapName,
    duration: info.duration,
    players: info.players
  });

  // 逐帧分析
  const totalFrames = Math.ceil(info.duration / CONFIG.analysisInterval);
  let currentFrame = 0;

  for (let time = 0; time <= info.duration; time += CONFIG.analysisInterval) {
    currentFrame++;
    const progress = currentFrame / totalFrames;
    
    sendToUI({
      type: 'replay_progress',
      progress,
      time,
      totalTime: info.duration
    });

    // 模拟帧分析（实际需要 SC2 replay API）
    const frameData = await simulateAnalyzeFrame(time, info);
    
    if (frameData && frameData.advice) {
      sendToUI({
        type: 'frame_analysis',
        time,
        ...frameData
      });
    }

    // 发送截图到服务器
    if (wsInstance && frameData?.screenshot) {
      wsInstance.send(JSON.stringify({
        type: 'replay_frame',
        time,
        screenshot: frameData.screenshot,
        timestamp: Date.now()
      }));
    }

    // 避免过快
    await sleep(500);
  }

  // 生成总结
  sendToUI({
    type: 'replay_summary',
    summary: {
      totalDuration: info.duration,
      mapName: info.mapName,
      analysisPoints: totalFrames,
      overallAdvice: [
        '前期注意侦查，了解对手种族',
        '5分钟开矿是关键节奏点',
        '中期保持部队补给，不要一波崩',
        '后期注意攻防升级'
      ]
    }
  });

  console.log('[Replay] 分析完成');
}

/**
 * 获取录像基本信息（简化版）
 */
async function getReplayInfo(replayPath) {
  try {
    const stats = fs.statSync(replayPath);
    const fileName = path.basename(replayPath, '.SC2Replay');
    
    // 从文件名解析（格式通常是 "MapName-Date-Time")
    const parts = fileName.split('-');
    
    // 文件大小估算时长（非常粗略）
    const estimatedDuration = Math.max(300, Math.min(1800, Math.floor(stats.size / 5000)));
    
    return {
      duration: estimatedDuration,
      mapName: parts[0] || 'Unknown Map',
      players: [
        { name: 'Player 1', race: guessRace(parts) },
        { name: 'Player 2', race: guessRace(parts) }
      ],
      fileSize: stats.size
    };
  } catch (e) {
    console.error('[Replay] 读取信息失败:', e.message);
    return {
      duration: 600,
      mapName: 'Unknown',
      players: [{ name: 'P1' }, { name: 'P2' }]
    };
  }
}

/**
 * 根据文件名猜测种族
 */
function guessRace(parts) {
  const races = ['Terran', 'Zerg', 'Protoss'];
  // 简化：随机分配
  return races[Math.floor(Math.random() * 3)];
}

/**
 * 模拟帧分析（实际需要集成 SC2 replay API）
 */
async function simulateAnalyzeFrame(timeSeconds, info) {
  const minutes = Math.floor(timeSeconds / 60);
  
  // 根据时间生成建议
  const advices = {
    early: [
      '开局建筑顺序正确，继续保持',
      '第一个农民已派出侦查，好习惯',
      '注意资源分配，不要卡人口'
    ],
    mid: [
      '中期是多线操作的最佳时机',
      '科技树选择合理',
      '部队配置合适，继续暴兵'
    ],
    late: [
      '后期注意攻防升级',
      '决战前确保经济充足',
      '注意对手转型，及时调整'
    ]
  };

  let phase = 'mid';
  if (minutes < 3) phase = 'early';
  else if (minutes > 9) phase = 'late';

  const tips = advices[phase];
  const tip = tips[Math.floor(Math.random() * tips.length)];

  // 某些关键时间点给特定建议
  let specificAdvice = null;
  if (timeSeconds === 300) specificAdvice = '5分钟到了，是开矿的好时机';
  else if (timeSeconds === 480) specificAdvice = '8分钟攻防窗口，注意对手动向';
  else if (timeSeconds === 600) specificAdvice = '10分钟，准备进入后期';

  return {
    advice: specificAdvice || tip,
    phase,
    minutes
  };
}

/**
 * 发送到 UI
 */
function sendToUI(data) {
  if (onProgressCallback) {
    onProgressCallback(data);
  }
  
  // 同时通过 WebSocket 发送
  if (sendToServer) {
    sendToServer(data);
  }
}

/**
 * HTTP 请求（M2.7 分析）
 */
async function analyzeWithVision(screenshotBase64, gameState) {
  if (!CONFIG.minimaxApiKey || !screenshotBase64) {
    return null;
  }

  const prompt = `你是星际争霸2教练。分析这张游戏截图：

时间：${Math.floor(gameState.gameTime / 60)}分${gameState.gameTime % 60}秒

简洁回答，30字以内。`;

  try {
    const response = await httpRequest(CONFIG.minimaxApiKey, {
      model: 'MiniMax-M2.7',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${screenshotBase64}` } }
        ]
      }],
      max_tokens: 100
    });

    return {
      advice: response.choices?.[0]?.message?.content?.trim() || '',
      screenshot: screenshotBase64
    };
  } catch (e) {
    console.error('[AI] 分析失败:', e.message);
    return null;
  }
}

function httpRequest(apiKey, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const options = {
      hostname: 'api.minimax.chat',
      path: '/v1/chat_completion_v2',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString()));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 导出
module.exports = {
  analyzeReplay,
  setSendFunction,
  setProgressCallback
};

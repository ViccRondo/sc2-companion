/**
 * AI 服务 - M2.7 视觉分析 + MiniMax TTS
 */

const https = require('https');

const CONFIG = {
  minimaxApiKey: process.env.MINIMAX_API_KEY,
  minimaxVlmUrl: 'https://api.minimax.chat/v1/chat_completion_v2',
  minimaxTtsUrl: 'https://api.minimax.chat/v1/t2a_v2'
};

// M2.7 视觉分析
async function analyzeWithVision(screenshot, gameState) {
  if (!CONFIG.minimaxApiKey) {
    console.log('[AI] 未配置 MINIMAX_API_KEY，跳过视觉分析');
    return null;
  }

  if (!screenshot) {
    return null;
  }

  const gameMinutes = Math.floor((gameState.gameTime || 0) / 60);
  const gameSeconds = (gameState.gameTime || 0) % 60;
  
  const prompt = `你是星际争霸2的专业教练。分析这张游戏截图和以下数据，给出简洁建议：

游戏时间：${gameMinutes}分${gameSeconds}秒
资源：矿${gameState.resources?.minerals || 0} | 气${gameState.resources?.vespene || 0}
人口：${gameState.resources?.foodUsed || 0}/${gameState.resources?.foodCap || 0}
事件：${gameState.event || '正常'}

请用50字以内给出战术建议。如果局势正常，说"局势不错，继续当前节奏"。`;

  try {
    const response = await httpRequest(CONFIG.minimaxVlmUrl, {
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
      max_tokens: 150
    });

    const advice = response.choices?.[0]?.message?.content?.trim() || '';
    
    // 过滤掉空建议或"局势不错"类的消息
    if (advice && !advice.includes('局势不错') && !advice.includes('继续当前节奏')) {
      return {
        type: 'vision',
        priority: 'medium',
        message: advice
      };
    }
  } catch (e) {
    console.error('[AI] M2.7 视觉分析失败:', e.message);
  }

  return null;
}

// MiniMax TTS 合成
async function synthesizeSpeech(text) {
  if (!CONFIG.minimaxApiKey) {
    return null;
  }

  if (!text) {
    return null;
  }

  try {
    // 流式请求
    const response = await httpRequestStream(CONFIG.minimaxTtsUrl, {
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

    if (response && response.data) {
      return `data:audio/mp3;base64,${response.data}`;
    }
  } catch (e) {
    console.error('[AI] TTS 合成失败:', e.message);
  }

  return null;
}

// HTTP 请求封装
function httpRequest(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.minimaxApiKey}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        try {
          resolve(JSON.parse(buffer.toString()));
        } catch (e) {
          reject(new Error('JSON解析失败: ' + buffer.toString().substring(0, 200)));
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(data));
    req.end();
  });
}

// 流式 HTTP 请求（用于 TTS）
function httpRequestStream(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.minimaxApiKey}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        try {
          // TTS 流式返回的是多个 JSON lines
          const lines = buffer.toString().split('\n');
          let audioData = '';
          
          for (const line of lines) {
            if (line.trim()) {
              try {
                const parsed = JSON.parse(line);
                if (parsed.data) {
                  audioData += parsed.data;
                }
              } catch (e) {}
            }
          }
          
          resolve({ data: audioData });
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(data));
    req.end();
  });
}

module.exports = { analyzeWithVision, synthesizeSpeech };

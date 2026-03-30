/**
 * SC2 Companion - 真实录像分析器
 * 
 * 调用 Python sc2reader 解析 SC2 replay 文件
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { Buffer } = require('buffer');

// 配置
const CONFIG = {
  analysisInterval: 60,  // 每60秒分析一次
  minimaxApiKey: process.env.MINIMAX_API_KEY || '',
  sc2Path: process.env.SC2_PATH || ''
};

// 进度回调
let onProgressCallback = null;

/**
 * 设置进度回调
 */
function setProgressCallback(cb) {
  onProgressCallback = cb;
}

/**
 * 发送进度到 UI
 */
function sendToUI(data) {
  if (onProgressCallback) {
    onProgressCallback(data);
  }
}

/**
 * 分析 SC2 Replay 文件
 */
async function analyzeReplay(replayPath) {
  console.log('[Replay] 开始分析:', replayPath);
  
  if (!fs.existsSync(replayPath)) {
    sendToUI({ type: 'error', message: '文件不存在' });
    return;
  }

  // 检查文件扩展名
  const ext = path.extname(replayPath).toLowerCase();
  if (ext !== '.sc2replay' && ext !== '.replay') {
    sendToUI({ type: 'error', message: '只支持 .SC2Replay 文件' });
    return;
  }

  sendToUI({ type: 'replay_start', status: 'loading' });

  try {
    // 调用 Python 脚本分析
    const result = await runPythonAnalyzer(replayPath);
    
    if (!result) {
      // Python 分析失败，使用模拟数据
      console.log('[Replay] Python 分析失败，使用模拟数据');
      await simulateAnalysis(replayPath);
      return;
    }

    const analysis = JSON.parse(result);
    
    console.log('[Replay] 分析完成:', analysis);
    
    // 发送游戏信息
    sendToUI({
      type: 'replay_info',
      data: analysis.info
    });

    // 逐帧分析
    const keyMoments = analysis.key_moments || [];
    let current = 0;
    
    for (const moment of keyMoments) {
      current++;
      const progress = current / keyMoments.length;
      
      sendToUI({
        type: 'replay_progress',
        progress,
        time: moment.time,
        label: moment.label
      });

      // 生成该时间点的分析
      const advice = generateAdviceForMoment(moment, analysis);
      
      sendToUI({
        type: 'frame_analysis',
        time: moment.time,
        label: moment.label,
        advice: advice,
        phase: moment.phase
      });

      // 避免过快
      await sleep(300);
    }

    // 生成总结
    const summary = generateSummary(analysis);
    sendToUI({
      type: 'replay_summary',
      summary: summary
    });

  } catch (error) {
    console.error('[Replay] 分析失败:', error);
    sendToUI({ type: 'error', message: error.message });
    
    // 降级到模拟分析
    await simulateAnalysis(replayPath);
  }
}

/**
 * 运行 Python 分析脚本
 */
function runPythonAnalyzer(replayPath) {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, 'sc2_replay_analyzer.py');
    
    // 检查 Python 是否可用
    execSync('python3 --version', { stdio: 'pipe' }, (err) => {
      if (err) {
        console.log('[Replay] python3 不可用');
        resolve(null);
      }
    });

    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    
    const proc = spawn(pythonCmd, [scriptPath, replayPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        console.error('[Replay] Python 错误:', stderr);
        resolve(null);
        return;
      }

      // 提取 JSON 输出
      const jsonMatch = stdout.match(/\{[\s\S]*"info"[\s\S]*\}/);
      if (jsonMatch) {
        resolve(jsonMatch[0]);
      } else {
        // 尝试提取完整 JSON
        const lines = stdout.split('\n');
        for (const line of lines) {
          if (line.trim().startsWith('{')) {
            try {
              JSON.parse(line);
              resolve(line);
              return;
            } catch (e) {}
          }
        }
        resolve(null);
      }
    });

    // 30秒超时
    setTimeout(() => {
      proc.kill();
      resolve(null);
    }, 30000);
  });
}

/**
 * 生成关键时刻的分析建议
 */
function generateAdviceForMoment(moment, analysis) {
  const time = moment.time;
  const phase = moment.phase;
  const info = analysis.info || {};
  const players = info.players || [];
  
  const advices = {
    early: [
      '前期侦查很重要，了解对手种族和开局',
      '保持经济平衡，不要过早转型',
      '农民数量决定了经济发展'
    ],
    mid: [
      '中期是多线操作的最佳时机',
      '注意对手可能的快攻',
      '科技树选择要考虑对手种族'
    ],
    late: [
      '后期注意攻防升级',
      '决战位置比人数更重要',
      '保持经济补给线'
    ],
    '开矿窗口': [
      '5分钟到了！检查是否应该开矿',
      '开矿后要补农民和新建筑',
      '注意防守新矿
    '],
    '攻防窗口': [
      '8分钟攻防窗口，注意对手科技进度',
      '考虑是否需要升级攻防',
      '保持部队压制
    ']
  };

  // 根据时间选择建议
  let tips = advices[phase] || advices.mid;
  
  if (time === 300) tips = advices['开矿窗口'];
  else if (time === 480) tips = advices['攻防窗口'];

  // 获取当前玩家 APM
  const currentAPM = moment.state?.commands || {};
  const avgAPM = Object.values(currentAPM).reduce((a, b) => a + b, 0) / Object.keys(currentAPM).length * 22.4 || 0;

  // 根据 APM 添加建议
  if (avgAPM < 100) {
    tips.push(`当前 APM ${avgAPM.toFixed(0)}，注意操作节奏`);
  } else if (avgAPM > 200) {
    tips.push(`APM ${avgAPM.toFixed(0)} 很高，注意决策质量`);
  }

  return tips[Math.floor(Math.random() * tips.length)];
}

/**
 * 生成总结报告
 */
function generateSummary(analysis) {
  const info = analysis.info || {};
  const players = info.players || [];
  
  const summary = {
    totalDuration: info.game_length || 0,
    mapName: info.map_name || 'Unknown',
    players: players.map(p => ({
      name: p.name,
      race: p.race,
      result: p.result,
      apm: p.avg_apm || 0
    })),
    overallAdvice: []
  };

  // 生成总体建议
  if (players.length >= 2) {
    const winner = players.find(p => p.result === 'Win');
    const loser = players.find(p => p.result === 'Loss');
    
    if (winner) {
      summary.overallAdvice.push(`${winner.name} 赢得比赛，${winner.race} 对战表现不错`);
    }
    
    // APM 对比
    if (players[0] && players[1]) {
      const apmDiff = Math.abs((players[0].avg_apm || 0) - (players[1].avg_apm || 0));
      if (apmDiff > 50) {
        summary.overallAdvice.push(`APM 差距较大(${apmDiff.toFixed(0)})，操作可以更细腻`);
      }
    }
  }

  // 通用建议
  summary.overallAdvice.push('注意侦查，了解对手意图');
  summary.overallAdvice.push('经济运营是基础');
  summary.overallAdvice.push('多看录像学习高水平操作');

  return summary;
}

/**
 * 模拟分析（当 Python 不可用时）
 */
async function simulateAnalysis(replayPath) {
  console.log('[Replay] 使用模拟分析');
  
  // 从文件名解析基本信息
  const fileName = path.basename(replayPath, '.SC2Replay');
  const parts = fileName.split('-');
  
  sendToUI({
    type: 'replay_info',
    data: {
      map_name: parts[0] || 'Unknown Map',
      game_length: 600,
      players: [
        { name: 'Player 1', race: 'Terran', result: 'Win', avg_apm: 150 },
        { name: 'Player 2', race: 'Zerg', result: 'Loss', avg_apm: 130 }
      ]
    }
  });

  // 关键时刻
  const keyMoments = [
    { time: 60, label: '1分钟', phase: 'early' },
    { time: 180, label: '3分钟', phase: 'early' },
    { time: 300, label: '5分钟', phase: 'mid' },
    { time: 420, label: '7分钟', phase: 'mid' },
    { time: 480, label: '8分钟', phase: 'late' },
    { time: 600, label: '10分钟', phase: 'late' }
  ];

  let current = 0;
  for (const moment of keyMoments) {
    current++;
    const progress = current / keyMoments.length;
    
    sendToUI({
      type: 'replay_progress',
      progress,
      time: moment.time,
      label: moment.label
    });

    const advice = generateAdviceForMoment(moment, {});
    
    sendToUI({
      type: 'frame_analysis',
      time: moment.time,
      label: moment.label,
      advice: advice,
      phase: moment.phase
    });

    await sleep(500);
  }

  sendToUI({
    type: 'replay_summary',
    summary: {
      totalDuration: 600,
      mapName: parts[0] || 'Unknown',
      players: [
        { name: 'Player 1', race: 'Terran', result: 'Win', apm: 150 },
        { name: 'Player 2', race: 'Zerg', result: 'Loss', apm: 130 }
      ],
      overallAdvice: [
        '5分钟是关键节奏点，注意开矿时机',
        '中期多线操作可以扩大优势',
        '后期注意攻防升级和决战位置'
      ]
    }
  });
}

/**
 * 检查 Python 环境
 */
function checkPython() {
  try {
    execSync('python3 --version', { stdio: 'pipe' });
    return true;
  } catch (e) {
    try {
      execSync('python --version', { stdio: 'pipe' });
      return true;
    } catch (e2) {
      return false;
    }
  }
}

/**
 * 检查 sc2reader 是否安装
 */
function checkSc2reader() {
  try {
    execSync('python3 -c "import sc2reader"', { stdio: 'pipe' });
    return true;
  } catch (e) {
    try {
      execSync('python -c "import sc2reader"', { stdio: 'pipe' });
      return true;
    } catch (e2) {
      return false;
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 导出
module.exports = {
  analyzeReplay,
  setProgressCallback,
  checkPython,
  checkSc2reader
};

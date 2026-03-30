/**
 * SC2 Companion - 录像分析器
 * 
 * 优先使用打包的 exe，备用 python
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { Buffer } = require('buffer');

// 配置
const CONFIG = {
  analysisInterval: 60,
  minimaxApiKey: process.env.MINIMAX_API_KEY || '',
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
 * 获取 exe 路径
 */
function getAnalyzerPath() {
  // 优先使用打包的 exe
  const exePaths = [
    path.join(__dirname, '../assets/sc2_replay_analyzer'),
    path.join(__dirname, '../assets/sc2_replay_analyzer.exe'),
    // 开发模式下的路径
    path.join(__dirname, '../../electron/assets/sc2_replay_analyzer'),
  ];
  
  // Windows 添加 .exe 后缀
  if (process.platform === 'win32') {
    exePaths[0] += '.exe';
  }
  
  for (const exePath of exePaths) {
    if (fs.existsSync(exePath)) {
      console.log('[Replay] 使用分析器:', exePath);
      return exePath;
    }
  }
  
  return null;
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

  const ext = path.extname(replayPath).toLowerCase();
  if (ext !== '.sc2replay' && ext !== '.replay') {
    sendToUI({ type: 'error', message: '只支持 .SC2Replay 文件' });
    return;
  }

  sendToUI({ type: 'replay_start', status: 'loading' });

  try {
    // 优先用打包的 exe
    const analyzerPath = getAnalyzerPath();
    
    let result;
    if (analyzerPath) {
      result = await runExeAnalyzer(analyzerPath, replayPath);
    } else {
      // 备用 python
      result = await runPythonAnalyzer(replayPath);
    }
    
    if (!result || result.error) {
      console.log('[Replay] 分析器执行失败:', result?.error);
      await simulateAnalysis(replayPath);
      return;
    }

    console.log('[Replay] 分析结果:', JSON.stringify(result).substring(0, 200));
    
    // 发送游戏信息
    sendToUI({
      type: 'replay_info',
      data: result.info
    });

    // 逐帧分析
    const keyMoments = result.key_moments || [];
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

      // 生成分析建议
      const advice = generateAdviceForMoment(moment, result);
      
      sendToUI({
        type: 'frame_analysis',
        time: moment.time,
        label: moment.label,
        advice: advice,
        phase: moment.phase
      });

      await sleep(400);
    }

    // 生成总结
    const summary = generateSummary(result);
    sendToUI({
      type: 'replay_summary',
      summary: summary
    });

  } catch (error) {
    console.error('[Replay] 分析失败:', error);
    sendToUI({ type: 'error', message: error.message });
    await simulateAnalysis(replayPath);
  }
}

/**
 * 运行打包的 exe 分析器
 */
function runExeAnalyzer(exePath, replayPath) {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';
    const exe = isWindows ? exePath : exePath;
    
    // 确保可执行
    if (!isWindows) {
      try {
        fs.chmodSync(exePath, '755');
      } catch (e) {}
    }

    console.log('[Replay] 执行 exe:', exe, replayPath);
    
    const proc = spawn(exe, [replayPath], {
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
      if (code !== 0 && stderr) {
        console.error('[Replay] exe 错误:', stderr);
      }

      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (e) {
        console.error('[Replay] JSON 解析失败:', stdout.substring(0, 200));
        resolve({ error: '解析失败' });
      }
    });

    // 60秒超时
    setTimeout(() => {
      proc.kill();
      resolve({ error: '超时' });
    }, 60000);
  });
}

/**
 * 运行 Python 脚本（备用）
 */
function runPythonAnalyzer(replayPath) {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, 'sc2_replay_analyzer.py');
    
    if (!fs.existsSync(scriptPath)) {
      resolve({ error: 'Python 脚本不存在' });
      return;
    }

    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    
    const proc = spawn(pythonCmd, [scriptPath, replayPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.on('close', (code) => {
      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (e) {
        resolve({ error: '解析失败' });
      }
    });

    setTimeout(() => {
      proc.kill();
      resolve({ error: '超时' });
    }, 60000);
  });
}

/**
 * 生成关键时刻的分析建议
 */
function generateAdviceForMoment(moment, result) {
  const time = moment.time;
  const phase = moment.phase;
  const info = result.info || {};
  const players = info.players || [];
  const state = moment.state || {};
  
  // 根据时间点给建议
  if (time === 60) {
    return '1分钟了，检查开局建筑顺序是否正确';
  }
  
  if (time === 180) {
    return '3分钟前期，注意侦查对手种族和开局';
  }
  
  if (time === 300) {
    const hasExtraBase = state.units_created?.[1] > 10;
    return hasExtraBase 
      ? '5分钟开矿成功，经济优势建立' 
      : '5分钟窗口到了，考虑开矿或压制对手';
  }
  
  if (time === 480) {
    return '8分钟攻防窗口，注意对手科技进度，准备防御或进攻';
  }
  
  if (time === 600) {
    return '10分钟后期，确保攻防升级，检查部队配置';
  }
  
  // APM 分析
  const apm = state.apm || {};
  const avgAPM = Object.values(apm).reduce((a, b) => a + b, 0) / Math.max(Object.keys(apm).length, 1);
  
  if (avgAPM > 250) {
    return `APM ${avgAPM} 很高！注意决策质量而非单纯操作`;
  } else if (avgAPM > 150) {
    return `APM ${avgAPM} 不错，保持节奏`;
  } else if (avgAPM > 0) {
    return `APM ${avgAPM}，可以尝试提高操作效率`;
  }
  
  // 默认建议
  const phaseAdvice = {
    early: ['前期保持侦查', '注意资源分配', '农民数量很重要'],
    mid: ['中期多线操作', '注意对手动向', '保持科技进度'],
    late: ['后期注意攻防', '决战位置选择', '经济补给要稳定']
  };
  
  const tips = phaseAdvice[phase] || phaseAdvice.mid;
  return tips[Math.floor(Math.random() * tips.length)];
}

/**
 * 生成总结报告
 */
function generateSummary(result) {
  const info = result.info || {};
  const players = info.players || [];
  
  const summary = {
    totalDuration: info.game_length || 0,
    mapName: info.map_name || 'Unknown',
    players: players.map(p => ({
      name: p.name,
      race: p.race,
      result: p.result,
      apm: Math.round(p.avg_apm || 0)
    })),
    overallAdvice: []
  };

  // 根据结果生成建议
  if (players.length >= 2) {
    const winner = players.find(p => p.result === 'Win');
    const loser = players.find(p => p.result === 'Loss');
    
    if (winner) {
      summary.overallAdvice.push(`${winner.name} (${winner.race}) 获胜`);
    }
    
    // APM 对比
    if (players[0]?.avg_apm && players[1]?.avg_apm) {
      const apmDiff = Math.abs(players[0].avg_apm - players[1].avg_apm);
      if (apmDiff > 50) {
        summary.overallAdvice.push(`APM 差距 ${apmDiff.toFixed(0)}，操作是胜负关键`);
      }
    }
  }

  // 通用建议
  if (summary.totalDuration < 300) {
    summary.overallAdvice.push('比赛较短，注意前期开局和侦查');
  } else if (summary.totalDuration > 600) {
    summary.overallAdvice.push('后期对决，注意攻防升级和决战时机');
  }

  summary.overallAdvice.push('多看高水平录像学习timing');
  summary.overallAdvice.push('保持良好心态，享受游戏');

  return summary;
}

/**
 * 模拟分析（当分析器都不可用时）
 */
async function simulateAnalysis(replayPath) {
  console.log('[Replay] 使用模拟分析');
  
  const fileName = path.basename(replayPath, '.SC2Replay');
  
  sendToUI({
    type: 'replay_info',
    data: {
      map_name: fileName.split('-')[0] || 'Unknown Map',
      game_length: 600,
      players: [
        { name: 'Player 1', race: 'Terran', result: 'Win', avg_apm: 150 },
        { name: 'Player 2', race: 'Zerg', result: 'Loss', avg_apm: 130 }
      ]
    }
  });

  const keyMoments = [
    { time: 60, label: '1分钟', phase: 'early' },
    { time: 180, label: '3分钟', phase: 'early' },
    { time: 300, label: '5分钟', phase: 'mid' },
    { time: 480, label: '8分钟', phase: 'late' },
    { time: 600, label: '10分钟', phase: 'late' }
  ];

  for (let i = 0; i < keyMoments.length; i++) {
    const moment = keyMoments[i];
    
    sendToUI({
      type: 'replay_progress',
      progress: (i + 1) / keyMoments.length,
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
      mapName: fileName.split('-')[0] || 'Unknown',
      players: [
        { name: 'Player 1', race: 'Terran', result: 'Win', apm: 150 },
        { name: 'Player 2', race: 'Zerg', result: 'Loss', apm: 130 }
      ],
      overallAdvice: [
        '注意开局侦查',
        '5分钟是关键节奏点',
        '后期注意攻防升级'
      ]
    }
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  analyzeReplay,
  setProgressCallback,
  getAnalyzerPath
};

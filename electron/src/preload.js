/**
 * SC2 Companion - Preload 脚本
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sc2Companion', {
  // ========== 连接状态 ==========
  
  /**
   * 获取连接状态
   */
  getConnectionStatus: () => ipcRenderer.invoke('get-connection-status'),
  
  // ========== 游戏状态 ==========
  
  /**
   * 更新游戏状态
   */
  updateGameState: (state) => ipcRenderer.send('update-game-state', state),
  
  /**
   * 截帧分析
   */
  captureScreen: () => ipcRenderer.send('capture-screen'),
  
  /**
   * 分析录像
   */
  analyzeReplay: (filePath) => ipcRenderer.send('analyze-replay', filePath),
  
  // ========== 窗口控制 ==========
  
  /**
   * 移动窗口
   */
  moveWindow: (x, y) => ipcRenderer.send('move-window', { x, y }),
  
  /**
   * 隐藏窗口
   */
  hideWindow: () => ipcRenderer.send('hide-window'),
  
  /**
   * 显示窗口
   */
  showWindow: () => ipcRenderer.send('show-window'),
  
  // ========== 事件监听 ==========
  
  /**
   * 连接状态变化
   */
  onConnectionStatus: (callback) => {
    ipcRenderer.on('connection-status', (event, status) => callback(status));
  },
  
  /**
   * 收到建议
   */
  onAdvice: (callback) => {
    ipcRenderer.on('advice', (event, advice) => callback(advice));
  },
  
  /**
   * 播放音频
   */
  onPlayAudio: (callback) => {
    ipcRenderer.on('play-audio', (event, audioUrl) => callback(audioUrl));
  },
  
  /**
   * 截帧开始
   */
  onCaptureStarted: (callback) => {
    ipcRenderer.on('capture-started', () => callback());
  },
  
  /**
   * 录像分析进度
   */
  onReplayProgress: (callback) => {
    ipcRenderer.on('replay-progress', (event, data) => callback(data));
  },
  
  // ========== 工具 ==========
  
  /**
   * 移除所有监听
   */
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('connection-status');
    ipcRenderer.removeAllListeners('advice');
    ipcRenderer.removeAllListeners('play-audio');
    ipcRenderer.removeAllListeners('capture-started');
    ipcRenderer.removeAllListeners('replay-progress');
  }
});

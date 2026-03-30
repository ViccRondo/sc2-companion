/**
 * SC2 Companion - Preload 脚本
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sc2Companion', {
  // ========== 连接状态 ==========
  
  /**
   * 获取连接状态
   * @returns {Promise<boolean>}
   */
  getConnectionStatus: () => ipcRenderer.invoke('get-connection-status'),
  
  // ========== 游戏状态 ==========
  
  /**
   * 更新游戏状态
   * @param {Object} state - 游戏状态
   */
  updateGameState: (state) => ipcRenderer.send('update-game-state', state),
  
  /**
   * 请求截图并分析
   */
  captureScreen: () => ipcRenderer.send('capture-screen'),
  
  // ========== 窗口控制 ==========
  
  /**
   * 移动窗口
   * @param {number} x
   * @param {number} y
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
   * 监听连接状态变化
   * @param {Function} callback - (isConnected: boolean) => void
   */
  onConnectionStatus: (callback) => {
    ipcRenderer.on('connection-status', (event, status) => callback(status));
  },
  
  /**
   * 监听建议消息
   * @param {Function} callback - (advice: Advice) => void
   */
  onAdvice: (callback) => {
    ipcRenderer.on('advice', (event, advice) => callback(advice));
  },
  
  /**
   * 监听音频播放
   * @param {Function} callback - (audioUrl: string) => void
   */
  onPlayAudio: (callback) => {
    ipcRenderer.on('play-audio', (event, audioUrl) => callback(audioUrl));
  },
  
  /**
   * 监听截图开始
   * @param {Function} callback - () => void
   */
  onCaptureStarted: (callback) => {
    ipcRenderer.on('capture-started', () => callback());
  },
  
  // ========== 工具 ==========
  
  /**
   * 移除所有监听器
   */
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('connection-status');
    ipcRenderer.removeAllListeners('advice');
    ipcRenderer.removeAllListeners('play-audio');
    ipcRenderer.removeAllListeners('capture-started');
  }
});

// 类型定义（仅供参考）
/**
 * @typedef {Object} GameState
 * @property {number} gameTime - 游戏时间（秒）
 * @property {Object} resources - 资源
 * @property {number} resources.minerals - 矿
 * @property {number} resources.vespene - 气
 * @property {number} resources.foodUsed - 已用人口
 * @property {number} resources.foodCap - 总人口
 * @property {string} event - 事件类型
 */

/**
 * @typedef {Object} Advice
 * @property {string} type - 消息类型
 * @property {string} priority - 优先级
 * @property {string} message - 消息内容
 * @property {string} [ttsUrl] - TTS音频URL
 */

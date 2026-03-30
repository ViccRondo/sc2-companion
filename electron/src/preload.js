/**
 * SC2 Companion - Preload 脚本
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sc2Companion', {
  // 连接状态
  getConnectionStatus: () => ipcRenderer.invoke('get-connection-status'),
  
  // 更新游戏状态
  updateState: (state) => ipcRenderer.send('update-state', state),
  
  // 截屏
  captureScreen: () => ipcRenderer.send('capture-screen'),
  
  // 移动窗口
  moveWindow: (x, y) => ipcRenderer.send('move-window', { x, y }),
  
  // 隐藏窗口
  hideWindow: () => ipcRenderer.send('hide-window'),
  
  // 监听事件
  onConnectionStatus: (callback) => {
    ipcRenderer.on('connection-status', (event, status) => callback(status));
  },
  
  onAdvice: (callback) => {
    ipcRenderer.on('advice', (event, advice) => callback(advice));
  },
  
  onPlayAudio: (callback) => {
    ipcRenderer.on('play-audio', (event, audioUrl) => callback(audioUrl));
  }
});

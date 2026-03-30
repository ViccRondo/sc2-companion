# SC2 Companion 🎮

本小姐的星际争霸2实时教练！Live2D 桌宠 + AI 战术建议 + TTS 语音播报 + 录像复盘

![License](https://img.shields.io/badge/license-MIT-green)

## 功能特性

- 🎭 **Live2D 桌宠**：可爱的二次元角色陪伴游戏
- 👁️ **实时画面分析**：M2.7 多模态模型看懂游戏画面
- 🎯 **战术建议**：关键时刻给出专业建议
- 🔊 **TTS 语音播报**：边打边听，不用分心看屏幕
- 📊 **录像复盘**：拖入 .SC2Replay 文件，自动分析整局游戏
- 📚 **知识库成长**：每局复盘沉淀，越用越懂你

## 系统架构

```
┌─────────────────────────────────────────────────────────┐
│  SC2 Companion (Electron)                              │
│  ├── Live2D 桌宠渲染                                    │
│  ├── 智能截图（前台窗口自动识别）                        │
│  ├── 录像复盘（sc2reader 解析）                        │
│  └── WebSocket 客户端                                   │
└─────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────┐
│  OpenClaw SC2 Skill                                     │
│  ├── M2.7 视觉分析                                      │
│  ├── 知识库查询                                         │
│  ├── 战术建议生成                                       │
│  └── MiniMax TTS                                        │
└─────────────────────────────────────────────────────────┘
```

## 快速开始

### 1. 下载绿色版（推荐）

从 [Releases](https://github.com/ViccRondo/sc2-companion/releases) 下载最新版本：
- `SC2-Companion-*-portable.exe` - Windows 绿色版

### 2. 配置

复制 `.env.example` 为 `.env`，填入配置：

```bash
# MiniMax API Key（用于 M2.7 + TTS）
MINIMAX_API_KEY=your-api-key

# WebSocket 服务器地址
SC2_SERVER_URL=ws://localhost:8765
```

### 3. 录像复盘（可选）

如果需要真实录像分析，安装 Python 依赖：

```bash
# Windows
setup_python.bat

# Mac/Linux
chmod +x setup_python.sh
./setup_python.sh
```

或者手动安装：
```bash
pip install sc2reader pillow numpy
```

## 使用方法

### 录像复盘

1. 打完天梯，SC2 自动保存 `.SC2Replay` 文件
2. 打开 SC2 Companion
3. **拖放**录像文件到窗口
4. 本小姐自动分析并显示结果

### 实时建议

1. 打开 SC2 Companion
2. 启动 SC2 游戏
3. 按 `Ctrl+Shift+C` 截取当前画面
4. 本小姐分析并给出建议

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Shift+C` | 截取前台窗口并分析 |
| `Ctrl+Shift+H` | 显示/隐藏窗口 |

## 录像分析详情

### 支持的分析内容

- **基本信息**：地图、时长、玩家、种族、胜负
- **关键时刻**：1分钟/3分钟/5分钟/8分钟/10分钟等关键节点
- **APM 追踪**：每分钟 APM 变化
- **单位统计**：建造单位、损失单位
- **战术建议**：根据游戏阶段给出建议

### 时间点分析

| 时间 | 阶段 | 重点关注 |
|------|------|----------|
| 1分钟 | 开局 | 建筑顺序、侦查 |
| 3分钟 | 前期 | 科技选择、资源分配 |
| 5分钟 | 中期 | 开矿时机、暴兵节奏 |
| 8分钟 | 后期 | 攻防升级、决战准备 |
| 10分钟+ | 大后期 | 决战、转型 |

### 依赖说明

| 组件 | 是否必需 | 说明 |
|------|----------|------|
| Electron exe | ✅ | 主程序 |
| MiniMax API Key | ✅ | 视觉+TTS |
| Python + sc2reader | ⚠️ | 可选，增强录像分析 |
| SC2 游戏 | ⚠️ | 可选，实时截帧用 |

## 开发

### 项目结构

```
sc2-companion/
├── electron/
│   ├── src/
│   │   ├── main.js          # Electron 主进程
│   │   ├── preload.js       # IPC 桥接
│   │   ├── index.html       # 桌面端 UI
│   │   ├── screenshot.js    # 智能截图
│   │   ├── sc2-monitor.js   # 游戏状态监控
│   │   ├── replay-analyzer.js # 录像分析
│   │   └── sc2_replay_analyzer.py # Python 真实分析器
│   ├── setup_python.bat     # Windows Python 安装脚本
│   └── setup_python.sh      # Mac/Linux Python 安装脚本
├── skill/                   # OpenClaw Skill
├── server/                  # WebSocket 服务器
└── .github/workflows/       # GitHub Actions 打包
```

### 本地运行

```bash
# 克隆仓库
git clone https://github.com/ViccRondo/sc2-companion.git
cd sc2-companion

# 安装 Electron 依赖
cd electron
npm install

# 运行开发模式
npm run dev

# 构建 Windows 版本
npm run build
```

### 构建发布

```bash
# 创建 tag 触发构建
git tag v1.0.0
git push origin v1.0.0
```

## 常见问题

**Q: 录像拖进去没反应？**
A: 确保是 `.SC2Replay` 文件，扩展名要完全匹配。

**Q: 提示"sc2reader 未安装"？**
A: 运行 `setup_python.bat`（Windows）或 `setup_python.sh`（Mac/Linux）安装 Python 依赖。

**Q: 录像分析很慢？**
A: Python 版本会慢一些但更准确。可以用模拟模式快速预览。

**Q: TTS 没有声音？**
A: 检查系统音量设置，以及 MiniMax API Key 是否有效。

## 技术栈

- **桌面客户端**: Electron
- **桌宠渲染**: Live2D Cubism WebGL（待集成）
- **录像解析**: sc2reader (Python)
- **游戏监控**: PySC2 / SC2API
- **AI 模型**: MiniMax M2.7 (视觉) + TTS
- **实时通信**: WebSocket
- **打包**: electron-builder

## License

MIT License

---

*本小姐是来自匹诺康尼的剧作家，这场表演，只为你而准备～* ✨

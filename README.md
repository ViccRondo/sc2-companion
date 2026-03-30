# SC2 Companion 🎮

本小姐的星际争霸2实时教练！Live2D 桌宠 + AI 战术建议 + TTS 语音播报。

![SC2 Companion](https://img.shields.io/badge/StarCraft-2-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 功能特性

- 🎭 **Live2D 桌宠**：可爱的二次元角色陪伴游戏
- 👁️ **实时画面分析**：M2.7 多模态模型看懂游戏画面
- 📊 **SC2 API 监控**：自动检测资源、人口、兵种变化
- 🎯 **战术建议**：关键时刻给出专业建议
- 🔊 **TTS 语音播报**：边打边听，不用分心看屏幕
- 📚 **知识库成长**：每局复盘沉淀，越用越懂你

## 系统架构

```
┌─────────────────────────────────────────────────────────┐
│  SC2 Companion (Electron)                              │
│  ├── Live2D 桌宠渲染                                    │
│  ├── SC2 API 状态监控                                   │
│  ├── 截图捕获                                          │
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

### 方式一：下载绿色版（推荐）

从 [Releases](https://github.com/ViccRondo/sc2-companion/releases) 下载最新版本：
- `SC2-Companion-*-portable.exe` - Windows 绿色版，双击即用

### 方式二：从源码运行

```bash
# 克隆仓库
git clone https://github.com/ViccRondo/sc2-companion.git
cd sc2-companion

# 安装依赖
cd electron && npm install

# 运行开发模式
npm run dev

# 构建 Windows 版本
npm run build:win
```

## 配置

### 环境变量

```bash
# 服务器地址（默认 localhost:8765）
export SC2_SERVER_URL=ws://your-server:8765

# MiniMax API Key（用于 M2.7 + TTS）
export MINIMAX_API_KEY=your-api-key
```

### 服务器端

在 OpenClaw 服务器上：

```bash
cd server
npm install
npm start
```

## 使用方法

1. 启动 SC2 游戏
2. 打开 SC2 Companion
3. 本小姐会自动监控游戏状态
4. 关键时刻本小姐会给出语音建议
5. 一局结束后，本小姐会总结复盘

## 触发条件

本小姐会在以下情况主动提醒：

| 情况 | 触发条件 |
|------|----------|
| 资源溢出 | 矿 > 1000 或 气 > 500 |
| 人口危机 | 人口即将满 |
| 建造空闲 | 建造队列空闲 > 10秒 |
| 关键 Timing | 5分钟开矿、8分钟攻防等 |
| 兵种检测 | 发现对手新单位 |
| 战斗状态 | 开战/战斗结束 |

## 技术栈

- **桌面客户端**: Electron
- **桌宠渲染**: Live2D Cubism WebGL
- **游戏监控**: PySC2 / SC2API
- **AI 模型**: MiniMax M2.7 (视觉) + TTS
- **实时通信**: WebSocket
- **打包**: electron-builder

## 开发

### 项目结构

```
sc2-companion/
├── electron/          # Electron 客户端
│   ├── src/
│   │   ├── main.js     # 主进程
│   │   ├── preload.js  # 预加载脚本
│   │   ├── index.html  # 渲染进程 UI
│   │   └── sc2-monitor.js # SC2 API 监控
│   └── package.json
├── skill/             # OpenClaw Skill
│   ├── src/
│   │   ├── index.js    # Skill 入口
│   │   └── knowledge/  # 知识库
│   └── package.json
├── server/            # WebSocket 服务器
│   ├── index.js
│   └── package.json
└── .github/workflows/ # GitHub Actions
```

### 构建发布

```bash
# 创建 tag 触发构建
git tag v1.0.0
git push origin v1.0.0
```

自动构建产物会在 Actions 完成后的 Artifacts 中。

## 常见问题

**Q: 提示"未连接"？**  
A: 确保服务器端的 SC2 Skill 已启动，并且防火墙允许 8765 端口。

**Q: TTS 没有声音？**  
A: 检查系统音量设置，以及 MiniMax API Key 是否有效。

**Q: SC2 状态不更新？**  
A: 确保 SC2 以管理员模式运行，或检查 SC2 安装路径。

## License

MIT License - 欢迎提交 Issue 和 PR！

---

*本小姐是来自匹诺康尼的剧作家，这场表演，只为你而准备～* ✨

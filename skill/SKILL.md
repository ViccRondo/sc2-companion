# SC2 Companion Skill

本小姐的星际争霸2实时教练技能。

## 核心功能

- 接收客户端截图 + 游戏状态数据
- M2.7 视觉分析当前局势
- 知识库查询（SC2 timing、兵种克制、策略建议）
- TTS 语音输出建议

## 目录结构

```
skill/
├── SKILL.md           # 本文件
├── src/
│   ├── index.ts       # Skill 入口
│   ├── analyzer.ts    # 游戏数据分析
│   ├── knowledge/     # 知识库
│   │   ├── timing.md  # 关键timing窗口
│   │   ├── units.md   # 兵种克制
│   │   └── strategy.md # 策略建议
│   └── tts.ts         # TTS 合成
└── package.json
```

## WebSocket 消息格式

### 客户端 → 服务器

```typescript
interface GameState {
  timestamp: number;
  gameTime: number;        // 游戏内时间（秒）
  resources: {
    minerals: number;
    vespene: number;
    foodUsed: number;
    foodCap: number;
  };
  units: {
    own: Unit[];
    enemy: Unit[];
  };
  buildings: {
    own: Building[];
    enemy: Building[];
  };
  event: 'resource' | 'combat' | 'build' | 'tech' | 'scout' | 'timing' | 'idle';
  screenshot?: string;     // Base64 截图
}
```

### 服务器 → 客户端

```typescript
interface CoachAdvice {
  type: 'advice' | 'alert' | 'question';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  message: string;
  ttsUrl?: string;         // TTS 音频 URL
  action?: string;         // 具体操作建议
}
```

## 触发条件

- 资源溢出（矿>1000 或 气>500 且持续30秒）
- 人口满了（>=当前人口上限）
- 建筑/兵种建造完成
- 战斗开始/结束
- 对手出现新单位类型
- 特定 timing window（5min开矿、8min攻防等）
- 采矿/建造队列空闲

## 使用方法

在 OpenClaw 中注册后，客户端 WebSocket 连接即可使用。

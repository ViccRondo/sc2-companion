"""
SC2 Companion - 真实录像分析器
使用 sc2reader 解析 replay + SC2 API 截图

需要安装依赖:
    pip install sc2reader numpy pillow

SC2 需要安装在默认位置:
    Windows: C:\\Program Files (x86)\\StarCraft II\\
    Mac: /Applications/StarCraft II/
    Linux: ~/StarCraftII/
"""

import sys
import os
import json
import time
import subprocess
import struct
import socket
from pathlib import Path
from datetime import datetime

try:
    import sc2reader
    from sc2reader import utils
    SC2READER_AVAILABLE = True
except ImportError:
    SC2READER_AVAILABLE = False
    print("[SC2] sc2reader 未安装，运行: pip install sc2reader")

try:
    from PIL import Image
    import io
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False


# SC2 安装路径
SC2_PATHS = {
    'win32': 'C:\\Program Files (x86)\\StarCraft II\\Support64\\SC2Switcher.exe',
    'darwin': '/Applications/StarCraft II/SC2.app/Contents/MacOS/SC2',
    'linux': '~/StarCraftII/SC2'
}


class SC2ReplayAnalyzer:
    """SC2 录像分析器"""
    
    def __init__(self, sc2_path=None):
        self.sc2_path = sc2_path or self._find_sc2()
        self.replay = None
        self.game_data = None
        
    def _find_sc2(self):
        """查找 SC2 安装路径"""
        import platform
        system = platform.system().lower()
        path_key = {'windows': 'win32', 'darwin': 'darwin', 'linux': 'linux'}.get(system, 'linux')
        default_path = SC2_PATHS.get(path_key, '')
        
        if os.path.exists(default_path):
            return default_path
        return None
    
    def load_replay(self, replay_path):
        """加载 replay 文件"""
        if not os.path.exists(replay_path):
            raise FileNotFoundError(f"Replay 文件不存在: {replay_path}")
        
        print(f"[SC2] 加载录像: {replay_path}")
        
        if not SC2READER_AVAILABLE:
            raise RuntimeError("需要安装 sc2reader: pip install sc2reader")
        
        # 加载 replay
        self.replay = sc2reader.load_replay(replay_path, load_level=2)
        
        print(f"[SC2] 游戏: {self.replay.map_name}")
        print(f"[SC2] 时长: {self.replay.game_length}s")
        print(f"[SC2] 玩家: {len(self.replay.players)}")
        
        for player in self.replay.players:
            print(f"  - {player.name} ({player.play_race})")
        
        return self.replay
    
    def get_game_info(self):
        """获取游戏基本信息"""
        if not self.replay:
            return None
        
        return {
            'map_name': self.replay.map_name,
            'game_type': self.replay.game_type,
            'game_length': self.replay.game_length,
            'real_length': self.replay.real_length,
            'date': self.replay.date.isoformat() if hasattr(self.replay, 'date') else None,
            'players': [
                {
                    'name': p.name,
                    'race': p.play_race,
                    'result': p.result,
                    'avg_apm': getattr(p, 'avg_apm', 0),
                    'max_apm': getattr(p, 'max_apm', 0),
                }
                for p in self.replay.players if p.is_parsed
            ],
            'region': getattr(self.replay, 'region', 'Unknown'),
            'build': getattr(self.replay, 'build', 'Unknown'),
        }
    
    def get_events(self):
        """获取游戏事件"""
        if not self.replay:
            return []
        
        events = []
        
        # 遍历事件
        for event in self.replay.events:
            # 过滤有用事件
            if event.name in ['UnitBornEvent', 'UnitDiedEvent', 'UnitTypeChangeEvent',
                              'UpgradeCompleteEvent', 'BasiccommandsEvent']:
                events.append({
                    'frame': getattr(event, 'frame', 0),
                    'second': getattr(event, 'frame', 0) / 22.4,  # SC2 22.4fps
                    'name': event.name,
                    'player': getattr(event, 'player', None),
                    'unit': str(getattr(event, 'unit', '')),
                })
        
        return events
    
    def get_timeline(self, interval=30):
        """获取关键时间线（每N秒一个节点）"""
        if not self.replay:
            return []
        
        game_length = int(self.replay.game_length / 22.4)  # 转换为秒
        timeline = []
        
        for second in range(0, game_length, interval):
            frame = int(second * 22.4)
            
            # 获取该时间点的状态
            state = self._get_state_at_frame(frame)
            timeline.append(state)
        
        return timeline
    
    def _get_state_at_frame(self, frame):
        """获取指定帧的状态"""
        if not self.replay:
            return {}
        
        # 简化：基于事件重建状态
        events_up_to_frame = []
        for event in self.replay.events:
            if getattr(event, 'frame', 0) <= frame:
                events_up_to_frame.append(event)
        
        # 统计单位
        units_created = {}
        units_died = {}
        
        for event in events_up_to_frame:
            if event.name == 'UnitBornEvent':
                player = getattr(event, 'player', 0)
                unit = str(getattr(event, 'unit_type', ''))
                units_created[player] = units_created.get(player, 0) + 1
            
            elif event.name == 'UnitDiedEvent':
                player = getattr(event, 'player', 0)
                units_died[player] = units_died.get(player, 0) + 1
        
        # 获取 APM
        player_apm = {}
        for event in events_up_to_frame:
            if event.name == 'BasiccommandsEvent':
                player = getattr(event, 'player', 0)
                player_apm[player] = player_apm.get(player, 0) + 1
        
        second = frame / 22.4
        
        return {
            'frame': frame,
            'second': int(second),
            'minute': int(second // 60),
            'second_in_minute': int(second % 60),
            'units_created': units_created,
            'units_died': units_died,
            'commands': player_apm,
        }
    
    def get_key_moments(self):
        """获取关键时刻"""
        if not self.replay:
            return []
        
        moments = []
        game_seconds = self.replay.game_length / 22.4
        
        # 关键时间点
        key_times = [
            (60, "1分钟", "开局"),
            (180, "3分钟", "前期"),
            (300, "5分钟", "开矿窗口"),
            (420, "7分钟", "中期"),
            (480, "8分钟", "攻防窗口"),
            (600, "10分钟", "后期"),
            (720, "12分钟", "大后期"),
        ]
        
        for second, label, phase in key_times:
            if second <= game_seconds:
                state = self._get_state_at_frame(int(second * 22.4))
                moments.append({
                    'time': second,
                    'label': label,
                    'phase': phase,
                    'state': state,
                })
        
        return moments
    
    def analyze(self):
        """完整分析"""
        if not self.replay:
            return None
        
        return {
            'info': self.get_game_info(),
            'timeline': self.get_timeline(interval=60),  # 每分钟一个点
            'key_moments': self.get_key_moments(),
        }
    
    def generate_report(self):
        """生成分析报告"""
        if not self.replay:
            return "没有加载 replay"
        
        analysis = self.analyze()
        info = analysis['info']
        
        report = f"""
╔══════════════════════════════════════════════════════════════╗
║              SC2 录像分析报告                               ║
╚══════════════════════════════════════════════════════════════╝

📊 基本信息
─────────────────────────────────────
  地图: {info['map_name']}
  时长: {info['game_length']} ({info['real_length']})
  日期: {info['date']}
  地区: {info['region']}

👥 玩家
─────────────────────────────────────"""
        
        for player in info['players']:
            result = "✓ 胜利" if player['result'] == 'Win' else "✗ 失败"
            report += f"""
  {player['name']} ({player['race']})
    结果: {result}
    APM: {player['avg_apm']:.0f} (最高: {player['max_apm']:.0f})"""
        
        report += """
"""
        
        # 关键时刻
        moments = analysis['key_moments']
        if moments:
            report += """⏱️ 关键时刻
─────────────────────────────────────"""
            for moment in moments:
                state = moment['state']
                apm = state.get('commands', {})
                total_apm = sum(apm.values()) / max(len(apm), 1) * 22.4
                
                report += f"""
  {moment['label']} ({moment['phase']})
    APM: {total_apm:.0f}"""
        
        report += """
"""
        
        return report


class SC2ScreenshotCapture:
    """SC2 截图捕获器（使用 SC2 API）"""
    
    def __init__(self, sc2_path=None):
        self.sc2_path = sc2_path or self._find_sc2()
        self.process = None
        self.ws = None
        
    def _find_sc2(self):
        """查找 SC2"""
        import platform
        system = platform.system().lower()
        path_key = {'windows': 'win32', 'darwin': 'darwin', 'linux': 'linux'}.get(system, 'linux')
        default_path = SC2_PATHS.get(path_key, '')
        return default_path if os.path.exists(default_path) else None
    
    def start_replay_mode(self, replay_path, port=5000):
        """启动 SC2 replay 模式"""
        if not self.sc2_path:
            raise RuntimeError("未找到 SC2 安装")
        
        if not os.path.exists(replay_path):
            raise FileNotFoundError(f"Replay 不存在: {replay_path}")
        
        # 启动 SC2 以 API 模式
        args = [
            self.sc2_path,
            '-listen', '127.0.0.1',
            '-port', str(port),
            '-displayMode', '0',  # 无窗口模式
            '-offline'
        ]
        
        print(f"[SC2] 启动 SC2: {' '.join(args)}")
        self.process = subprocess.Popen(args)
        
        # 等待启动
        time.sleep(3)
        
        return self.process is not None
    
    def capture_at_time(self, replay_path, time_seconds, output_path=None):
        """在指定时间截取 replay 画面"""
        # 这个功能需要完整的 SC2 API 实现
        # 简化版返回 None
        print(f"[SC2] 截图功能需要完整 API 实现")
        return None
    
    def stop(self):
        """停止 SC2"""
        if self.process:
            self.process.terminate()
            self.process = None


def main():
    """命令行入口"""
    if len(sys.argv) < 2:
        print("用法: python sc2_replay_analyzer.py <replay_file.SC2Replay>")
        sys.exit(1)
    
    replay_path = sys.argv[1]
    
    print("=" * 60)
    print("SC2 Companion - 录像分析器")
    print("=" * 60)
    
    # 创建分析器
    analyzer = SC2ReplayAnalyzer()
    
    # 加载并分析
    try:
        analyzer.load_replay(replay_path)
        report = analyzer.generate_report()
        print(report)
        
        # 输出 JSON 格式（供 Electron 使用）
        analysis = analyzer.analyze()
        print("\n[JSON 输出]")
        print(json.dumps(analysis, indent=2, ensure_ascii=False))
        
    except Exception as e:
        print(f"[错误] {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""
SC2 Companion - 录像分析器 (简化版)
编译成单个 exe 使用
"""

import sys
import json
import os
from pathlib import Path

try:
    import sc2reader
    SC2READER_OK = True
except ImportError:
    SC2READER_OK = False
    print("# ERROR: sc2reader not installed", file=sys.stderr)
    sys.exit(1)


def analyze_replay(replay_path):
    """分析 replay 文件"""
    
    if not os.path.exists(replay_path):
        return {"error": f"File not found: {replay_path}"}
    
    try:
        # 加载 replay
        replay = sc2reader.load_replay(replay_path, load_level=2)
        
        # 基本信息
        info = {
            "map_name": replay.map_name,
            "game_length": int(replay.game_length / 22.4),  # 转换为秒
            "real_length": replay.real_length,
            "date": replay.date.isoformat() if hasattr(replay, 'date') else None,
            "region": getattr(replay, 'region', 'Unknown'),
            "build": getattr(replay, 'build', 'Unknown'),
        }
        
        # 玩家信息
        players = []
        for p in replay.players:
            if p.is_parsed:
                players.append({
                    "name": p.name or f"Player {p.pid}",
                    "race": p.play_race,
                    "result": p.result,
                    "avg_apm": getattr(p, 'avg_apm', 0),
                    "max_apm": getattr(p, 'max_apm', 0),
                    "pid": p.pid
                })
        info["players"] = players
        
        # 关键时刻
        game_seconds = info["game_length"]
        key_moments = []
        
        key_times = [
            (60, "1分钟", "early"),
            (180, "3分钟", "early"),
            (300, "5分钟", "mid"),
            (420, "7分钟", "mid"),
            (480, "8分钟", "late"),
            (600, "10分钟", "late"),
            (720, "12分钟", "late"),
        ]
        
        for second, label, phase in key_times:
            if second <= game_seconds:
                # 统计该时间点的 APM
                frame_start = int((second - 30) * 22.4) if second > 30 else 0
                frame_end = int(second * 22.4)
                
                commands = {}
                units_created = {}
                
                for event in replay.events:
                    f = getattr(event, 'frame', 0)
                    if frame_start <= f <= frame_end:
                        player = getattr(event, 'player', 0)
                        if player:
                            commands[player] = commands.get(player, 0) + 1
                        
                        if event.name == 'UnitBornEvent':
                            p = getattr(event, 'player', 0)
                            if p:
                                units_created[p] = units_created.get(p, 0) + 1
                
                # 计算该时段的 APM
                apm = {p: int(c / 0.5) for p, c in commands.items()}
                
                key_moments.append({
                    "time": second,
                    "label": label,
                    "phase": phase,
                    "state": {
                        "apm": apm,
                        "units_created": units_created
                    }
                })
        
        return {
            "info": info,
            "key_moments": key_moments
        }
        
    except Exception as e:
        import traceback
        return {
            "error": str(e),
            "traceback": traceback.format_exc()
        }


def main():
    if len(sys.argv) < 2:
        # 交互模式
        print("SC2 Replay Analyzer")
        print("Usage: sc2_replay_analyzer.exe <replay_file.SC2Replay>")
        sys.exit(1)
    
    replay_path = sys.argv[1]
    
    result = analyze_replay(replay_path)
    
    # 输出 JSON
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()

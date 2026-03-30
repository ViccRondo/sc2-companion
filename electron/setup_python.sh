#!/bin/bash
# SC2 Companion - Python 依赖安装脚本

echo "╔════════════════════════════════════════════╗"
echo "║   SC2 Companion - Python 环境配置        ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# 检测系统
if [[ "$OSTYPE" == "darwin"* ]]; then
    PYTHON_CMD="python3"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    PYTHON_CMD="python3"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    PYTHON_CMD="python"
else
    PYTHON_CMD="python3"
fi

echo "[1/3] 检测 Python..."
if ! command -v $PYTHON_CMD &> /dev/null; then
    echo "❌ Python 未安装"
    echo "   请先安装 Python 3.8+: https://www.python.org/downloads/"
    exit 1
fi

PYTHON_VERSION=$($PYTHON_CMD --version 2>&1)
echo "✓ Python 已安装: $PYTHON_VERSION"

echo ""
echo "[2/3] 安装 Python 依赖..."
$PYTHON_CMD -m pip install --user sc2reader pillow numpy 2>&1

if [ $? -eq 0 ]; then
    echo "✓ 依赖安装成功"
else
    echo "⚠️ 部分依赖安装失败，尝试使用 sudo..."
    $PYTHON_CMD -m pip install sc2reader pillow numpy
fi

echo ""
echo "[3/3] 验证安装..."
$PYTHON_CMD -c "import sc2reader; print('✓ sc2reader 版本:', sc2reader.__version__)"
$PYTHON_CMD -c "from PIL import Image; print('✓ Pillow 已安装')"

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║   配置完成！                              ║"
echo "║                                           ║"
echo "║   现在可以运行录像分析了:                 ║"
echo "║   python sc2_replay_analyzer.py <replay>  ║"
echo "╚════════════════════════════════════════════╝"

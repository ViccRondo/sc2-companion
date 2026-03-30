@echo off
chcp 65001 >nul
echo ╔════════════════════════════════════════════╗
echo ║   SC2 Companion - Python 环境配置        ║
echo ╚════════════════════════════════════════════╝
echo.

echo [1/3] 检测 Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python 未安装
    echo    请先安装 Python 3.8+: https://www.python.org/downloads/
    pause
    exit /b 1
)

for /f "delims=" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
echo ✓ Python 已安装: %PYTHON_VERSION%

echo.
echo [2/3] 安装 Python 依赖...
pip install --user sc2reader pillow numpy

echo.
echo [3/3] 验证安装...
python -c "import sc2reader; print('✓ sc2reader 版本:', sc2reader.__version__)"
python -c "from PIL import Image; print('✓ Pillow 已安装')"

echo.
echo ╔════════════════════════════════════════════╗
echo ║   配置完成！                              ║
echo ║                                           ║
echo ║   现在可以运行录像分析了:                 ║
echo ║   python sc2_replay_analyzer.py ^<replay^> ║
echo ╚════════════════════════════════════════════╝
pause

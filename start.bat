@echo off
chcp 65001 >nul
title Word Reader 启动器
cd /d "%~dp0"

echo ============================================
echo   Word Reader 单词·句子学习器  正在启动
echo   启动后：任务栏右下角会出现 Word Reader 图标
echo   右键图标 = 打开网页 / 查看IP / 停止服务
echo   本机: http://127.0.0.1:8000
echo ============================================
echo.

rem 检查 python 是否可用
where python >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 python，请先安装 Python 3。
  pause
  exit /b 1
)

rem 检查边缘组件依赖是否齐全
python -c "import edge_tts" >nul 2>nul
if errorlevel 1 (
  echo [提示] 未检测到 edge-tts，正在安装（需能联网）...
  pip install edge-tts
)
python -c "import pystray, PIL" >nul 2>nul
if errorlevel 1 (
  echo [提示] 正在安装托盘组件 pystray...
  pip install pystray pillow
)

echo 正在启动服务（窗口保持打开即可，可最小化）...
echo.
python tray.py

echo.
echo 服务已停止。
pause

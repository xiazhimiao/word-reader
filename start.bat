@echo off
chcp 65001 >nul
title Word Reader 启动器
cd /d "%~dp0"

echo ============================================
echo   Word Reader 单词·句子学习器
echo   http://127.0.0.1:8000   本机访问
echo   http://你的电脑IP:8000   手机同WiFi访问
echo   按 Ctrl+C 停止服务
echo ============================================
echo.

rem 检查 python 是否可用
where python >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 python，请先安装 Python 3。
  pause
  exit /b 1
)

rem 检查 edge-tts 是否已装
python -c "import edge_tts" >nul 2>nul
if errorlevel 1 (
  echo [提示] 未检测到 edge-tts，正在安装（需能联网）...
  pip install edge-tts
)

echo 正在启动服务...
echo.
python server.py
echo.
echo 服务已停止。
pause

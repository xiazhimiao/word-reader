@echo off
cd /d "%~dp0"
title Word Reader Launcher (hidden)

rem Check python
where pythonw.exe >nul 2>nul
if errorlevel 1 (
  echo [ERROR] pythonw.exe not found. Install Python 3.
  pause
  exit /b 1
)

rem Ensure deps
pythonw.exe -c "import edge_tts" >nul 2>nul
if errorlevel 1 (
  where pip >nul 2>nul
  if not errorlevel 1 pip install edge-tts
)
pythonw.exe -c "import pystray, PIL" >nul 2>nul
if errorlevel 1 (
  where pip >nul 2>nul
  if not errorlevel 1 pip install pystray pillow
)

rem Launch hidden (no console window), then exit
echo Word Reader is starting in the background.
echo Tray icon will appear in the taskbar (right-click to use).
start "" /min pythonw.exe tray.py
exit

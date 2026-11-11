@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Install-EVA-DesktopShortcut.ps1"
if errorlevel 1 pause

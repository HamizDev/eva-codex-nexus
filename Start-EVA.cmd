@echo off
setlocal
set "EVA_DRIVER=remember"
if not "%~1"=="" set "EVA_DRIVER=%~1"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0codex-skin\Start-EVA.ps1" -Driver "%EVA_DRIVER%" -PromptRestart
if errorlevel 1 pause

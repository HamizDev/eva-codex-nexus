@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0codex-skin\Start-EVA.ps1" -Driver rei -PromptRestart
if errorlevel 1 pause

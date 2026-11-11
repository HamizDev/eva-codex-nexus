@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0codex-skin\Restore-EVA.ps1"
if errorlevel 1 pause

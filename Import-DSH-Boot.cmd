@echo off
setlocal
if "%~1"=="" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0codex-skin\Import-DSH-Boot.ps1"
) else (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0codex-skin\Import-DSH-Boot.ps1" -SourceRoot "%~1"
)
if errorlevel 1 pause

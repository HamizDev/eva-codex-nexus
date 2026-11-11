@echo off
setlocal
set "EVA_DRIVER=remember"
if not "%~1"=="" set "EVA_DRIVER=%~1"
start "" /b wscript.exe "%~dp0Start-EVA.vbs" "%EVA_DRIVER%"

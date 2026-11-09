@echo off
chcp 65001 >nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0首次推送到GitHub.ps1"
if errorlevel 1 (
    echo.
    echo 推送未完成。请检查上面的错误提示。
)
pause

@echo off
title Roblox Universal IDE Bridge -- Building Windows Executable (.exe)
cd /d "%~dp0"

echo =============================================================
echo   🛠️ Building Standalone RobloxBridgeApp.exe Executable...
echo =============================================================

echo [1/2] Installing build dependencies (Electron & Builder)...
call npm install --no-audit

echo.
echo [2/2] Packaging Desktop App into Windows .exe...
call npm run build-exe

if errorlevel 1 (
    echo  ERROR: Executable build failed.
    pause & exit /b 1
)

echo.
echo =============================================================
echo   SUCCESS! Standalone Executable Created:
echo   %~dp0dist\RobloxBridgeApp.exe
echo =============================================================
echo.
pause
exit /b 0

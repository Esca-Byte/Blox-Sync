@echo off
title Blox Sync -- Native Desktop App
cd /d "%~dp0"

echo =============================================================
echo   Launching Blox Sync Desktop App
echo =============================================================

if exist "dist\BloxSyncApp.exe" (
    echo Starting compiled BloxSyncApp.exe...
    start "" "dist\BloxSyncApp.exe"
    exit /b 0
)

if exist "dist\RobloxBridgeApp.exe" (
    echo Starting compiled RobloxBridgeApp.exe...
    start "" "dist\RobloxBridgeApp.exe"
    exit /b 0
)

if not exist "node_modules\electron" (
    echo Installing Desktop App dependencies...
    call npm install --no-audit
)

echo Starting Native Electron App Window...
call npm start

exit /b 0

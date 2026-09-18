@echo off
setlocal enabledelayedexpansion
title Blox Sync -- Installer v2.2.0

echo.
echo  +-------------------------------------------------------------+
echo  ^|   Blox Sync (v2.2.0) -- Installer                           ^|
echo  +-------------------------------------------------------------+
echo.

:: 1. Copy Roblox Studio plugin
set "PLUGINS_DIR=%LOCALAPPDATA%\Roblox\Plugins"

if not exist "%PLUGINS_DIR%" (
    echo  Creating Roblox Plugins folder...
    mkdir "%PLUGINS_DIR%"
)

:: Clean up legacy RobloxBridge.lua if present
if exist "%PLUGINS_DIR%\RobloxBridge.lua" (
    del /F /Q "%PLUGINS_DIR%\RobloxBridge.lua" >nul 2>&1
)

echo  [1/4] Copying BloxSync.lua --^> Roblox Plugins...
copy /Y "%~dp0blox-sync-plugin\BloxSync.lua" "%PLUGINS_DIR%\BloxSync.lua" >nul
if errorlevel 1 (
    echo  ERROR: Could not copy plugin file. Close Roblox Studio and try again.
    pause & exit /b 1
)
echo         OK: %PLUGINS_DIR%\BloxSync.lua

:: 2. Create User Projects Directory
echo.
echo  [2/4] Creating default Projects directory...
if exist "%USERPROFILE%\OneDrive\Documents" (
    set "PROJECTS_DIR=%USERPROFILE%\OneDrive\Documents\RobloxProjects"
) else (
    set "PROJECTS_DIR=%USERPROFILE%\Documents\RobloxProjects"
)
if not exist "%PROJECTS_DIR%" (
    mkdir "%PROJECTS_DIR%"
)
echo         OK: %PROJECTS_DIR%

:: 3. Install Server Dependencies
echo.
echo  [3/4] Installing bridge server dependencies...
cd /d "%~dp0blox-sync-server"
call npm install --no-audit >nul 2>&1
if errorlevel 1 (
    echo  WARNING: npm install returned an error in blox-sync-server.
) else (
    echo         OK: Server dependencies installed successfully.
)

:: 4. Install MCP Server Dependencies
echo.
echo  [4/4] Installing MCP Server (AI Agent) dependencies...
cd /d "%~dp0blox-sync-mcp"
call npm install --no-audit >nul 2>&1
if errorlevel 1 (
    echo  WARNING: npm install returned an error in blox-sync-mcp.
) else (
    echo         OK: MCP Server dependencies installed successfully.
)

echo.
echo  +=============================================================+
echo  ^|   Installation complete!  (Blox Sync v2.2.0 + MCP Server)   ^|
echo  +=============================================================+
echo.
echo   HOW TO START USING:
echo.
echo   1. Double-click `start-bloxsync.bat` (or start `BloxSyncApp.exe`)
echo   2. Open ANY IDE or Text Editor (Antigravity, Cursor, VS Code, etc.)
echo   3. Connect Roblox Studio via the Blox Sync plugin toolbar.
echo   4. (AI Agents): Connect `mcp_config.example.json` to Antigravity / Cursor
echo      to enable direct Luau execution, logs, and live DataModel inspection!
echo.
pause
exit /b 0

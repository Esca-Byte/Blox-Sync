@echo off
setlocal enabledelayedexpansion
title Roblox Universal IDE Bridge -- Installer v2.2.0

echo.
echo  +-------------------------------------------------------------+
echo  ^|   Roblox Universal IDE Bridge (v2.2.0) -- Installer        ^|
echo  +-------------------------------------------------------------+
echo.

:: 1. Copy Roblox Studio plugin
set "PLUGINS_DIR=%LOCALAPPDATA%\Roblox\Plugins"

if not exist "%PLUGINS_DIR%" (
    echo  Creating Roblox Plugins folder...
    mkdir "%PLUGINS_DIR%"
)

echo  [1/4] Copying RobloxBridge.lua --^> Roblox Plugins...
copy /Y "%~dp0roblox-plugin\RobloxBridge.lua" "%PLUGINS_DIR%\RobloxBridge.lua" >nul
if errorlevel 1 (
    echo  ERROR: Could not copy plugin file. Close Roblox Studio and try again.
    pause & exit /b 1
)
echo         OK: %PLUGINS_DIR%\RobloxBridge.lua

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
cd /d "%~dp0roblox-bridge-server"
call npm install --no-audit >nul 2>&1
if errorlevel 1 (
    echo  WARNING: npm install returned an error in roblox-bridge-server.
) else (
    echo         OK: Server dependencies installed successfully.
)

:: 4. Install MCP Server Dependencies
echo.
echo  [4/4] Installing MCP Server (AI Agent) dependencies...
cd /d "%~dp0roblox-mcp-server"
call npm install --no-audit >nul 2>&1
if errorlevel 1 (
    echo  WARNING: npm install returned an error in roblox-mcp-server.
) else (
    echo         OK: MCP Server dependencies installed successfully.
)

echo.
echo  +=============================================================+
echo  ^|   Installation complete!  (v2.2.0 + Path A MCP Server)     ^|
echo  +=============================================================+
echo.
echo   HOW TO START USING:
echo.
echo   1. Double-click `start-bridge.bat` (or start `RobloxBridgeApp.exe`)
echo   2. Open ANY IDE or Text Editor (Antigravity, Cursor, VS Code, etc.)
echo   3. Connect Roblox Studio via the Universal Bridge plugin toolbar.
echo   4. (AI Agents): Connect `mcp_config.example.json` to Antigravity / Cursor
echo      to enable direct Luau execution, logs, and live DataModel inspection!
echo.
pause
exit /b 0

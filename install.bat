@echo off
setlocal enabledelayedexpansion
title Roblox Universal IDE Bridge -- Installer v2.0.0

echo.
echo  +-------------------------------------------------------------+
echo  ^|   Roblox Universal IDE Bridge (v2.0.0) -- Installer        ^|
echo  +-------------------------------------------------------------+
echo.

:: ── 1. Copy Roblox Studio plugin ──────────────────────────────────
set "PLUGINS_DIR=%LOCALAPPDATA%\Roblox\Plugins"

if not exist "%PLUGINS_DIR%" (
    echo  Creating Roblox Plugins folder...
    mkdir "%PLUGINS_DIR%"
)

echo  [1/3] Copying RobloxBridge.lua --^> Roblox Plugins...
copy /Y "%~dp0roblox-plugin\RobloxBridge.lua" "%PLUGINS_DIR%\RobloxBridge.lua" >nul
if errorlevel 1 (
    echo  ERROR: Could not copy plugin file. Close Roblox Studio and try again.
    pause & exit /b 1
)
echo         OK: %PLUGINS_DIR%\RobloxBridge.lua

:: ── 2. Create User Projects Directory ─────────────────────────────
echo.
echo  [2/3] Creating default Projects directory...
if exist "%USERPROFILE%\OneDrive\Documents" (
    set "PROJECTS_DIR=%USERPROFILE%\OneDrive\Documents\RobloxProjects"
) else (
    set "PROJECTS_DIR=%USERPROFILE%\Documents\RobloxProjects"
)
if not exist "%PROJECTS_DIR%" (
    mkdir "%PROJECTS_DIR%"
)
echo         OK: %PROJECTS_DIR%

:: ── 3. Install Server Dependencies ─────────────────────────────────
echo.
echo  [3/3] Installing bridge server dependencies...
cd /d "%~dp0roblox-bridge-server"
call npm install --no-audit >nul 2>&1
if errorlevel 1 (
    echo  WARNING: npm install returned an error. Ensure Node.js is installed.
) else (
    echo         OK: Dependencies installed successfully.
)

echo.
echo  +=============================================================+
echo  ^|   Installation complete!  (v2.0.0)                         ^|
echo  +=============================================================+
echo.
echo   HOW TO START USING:
echo.
echo   1. Double-click `start-bridge.bat` (or run `npm start` in `roblox-bridge-server`)
echo   2. Open ANY IDE or Text Editor (VS Code, Cursor, JetBrains, Neovim, etc.)
echo   3. Open your project folder in:
echo      %PROJECTS_DIR%\
echo   4. Open Roblox Studio with your place file.
echo   5. Click "Connect" on the Roblox Universal Bridge toolbar or widget!
echo.
pause
exit /b 0

@echo off
title Roblox Universal IDE Bridge -- Server Launcher v2.2.0
cd /d "%~dp0roblox-bridge-server"
echo Starting Roblox Universal IDE Bridge Server v2.2.0...
node src/cli.js %*
pause

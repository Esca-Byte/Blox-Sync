@echo off
title Roblox Universal IDE Bridge -- Server Launcher v2.0.0
cd /d "%~dp0roblox-bridge-server"
echo Starting Roblox Universal IDE Bridge Server...
node src/cli.js %*
pause

@echo off
title Blox Sync -- Server Launcher v2.2.0
cd /d "%~dp0blox-sync-server"
echo Starting Blox Sync Server v2.2.0...
node src/cli.js %*
pause

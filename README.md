<p align="center">
  <img src="bloxsynclogo.png" alt="Blox Sync Logo" width="130" style="border-radius: 20px;">
</p>

<h1 align="center">Blox Sync</h1>

<p align="center">
  <strong>Real-time Roblox Studio IDE Bridge & Autonomous AI Agent Platform</strong><br>
  Code in Antigravity, Cursor, VS Code, or JetBrains with instant two-way sync to Roblox Studio.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.2.0-blue?style=flat-square" alt="Version">
  <img src="https://img.shields.io/badge/platform-Windows-0078D6?style=flat-square&logo=windows" alt="Platform">
  <img src="https://img.shields.io/badge/Roblox-Studio-E2231A?style=flat-square&logo=roblox&logoColor=white" alt="Roblox">
  <img src="https://img.shields.io/badge/MCP-Enabled-8A2BE2?style=flat-square" alt="MCP">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License">
</p>

---

## ⚡ Quick Start

1. **Install**: Run `install.bat` (sets up dependencies and the Studio plugin automatically).
2. **Enable HTTP**: In Roblox Studio, open **Game Settings** → **Security** → toggle **Allow HTTP Requests** on.
3. **Launch & Sync**: Run `BloxSyncApp.exe` (or `start-bloxsync.bat`), open Studio, and click **Connect** on the Blox Sync toolbar!

> 📖 For full configuration, IDE integration, and troubleshooting, check out the **[Complete Usage Guide (USAGE.md)](USAGE.md)**.

---

## ✨ Features

- **⚡ Instant Two-Way Sync**: Edit Lua, Luau, or TypeScript in any IDE — changes reflect inside Studio in milliseconds.
- **🖥️ Native Desktop Dashboard**: Frameless Windows control center with project switching, Luau test runner, and live DataModel explorer.
- **🤖 Autonomous AI Agents (MCP)**: Built-in Model Context Protocol server enabling AI assistants (**Antigravity**, **Cursor**, **Claude**) to inspect hierarchies, run scripts, and debug runtime errors.
- **🛡️ Conflict Protection**: Split visual diff merge modal protects your work if files are edited simultaneously in Studio and your IDE.
- **📦 Ecosystem Ready**: One-click `.rbxlx` place file exports, Wally package management, and TypeScript (`roblox-ts`) support.

---

## 📁 Repository Structure

- [`blox-sync-app/`](blox-sync-app/) — Native Electron desktop application & web dashboard.
- [`blox-sync-server/`](blox-sync-server/) — Headless CLI and file synchronization engine.
- [`blox-sync-plugin/`](blox-sync-plugin/) — Roblox Studio plugin (`BloxSync.lua`).
- [`blox-sync-mcp/`](blox-sync-mcp/) — MCP Server for AI coding assistants.
- [`.agents/skills/`](.agents/skills/) — AI agent skills suite for game auditing, datastores, and testing.

---

## 📄 License

Licensed under the [MIT License](LICENSE). Developed with ❤️ by [Esca-Byte](https://github.com/Esca-Byte).

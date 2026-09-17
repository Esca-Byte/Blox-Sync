<p align="center">
  <img src="https://img.shields.io/badge/version-2.2.0-blue?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/platform-Windows-0078D6?style=for-the-badge&logo=windows" alt="Platform">
  <img src="https://img.shields.io/badge/Roblox-Studio-E2231A?style=for-the-badge&logo=roblox&logoColor=white" alt="Roblox">
  <img src="https://img.shields.io/badge/IDEs-Antigravity%20|%20Cursor%20|%20VS%20Code%20|%20JetBrains-007ACC?style=for-the-badge" alt="IDEs">
  <img src="https://img.shields.io/badge/language-Lua%20|%20Luau%20|%20TypeScript-2C2D72?style=for-the-badge&logo=lua&logoColor=white" alt="Languages">
  <img src="https://img.shields.io/badge/MCP-Protocol%20Enabled-8A2BE2?style=for-the-badge" alt="MCP">
  <img src="https://img.shields.io/github/license/Esca-Byte/Roblox-Bridge?style=for-the-badge" alt="License">
</p>

<h1 align="center">🔗 Roblox Universal IDE Bridge & AI Agent Platform</h1>

<p align="center">
  <strong>Real-time two-way sync, native desktop dashboard, and autonomous AI Agent integration (MCP) between any external editor and Roblox Studio.</strong><br>
  Developed by <a href="https://github.com/Esca-Byte"><strong>Esca-Byte</strong></a> • Code in Antigravity, Cursor, VS Code, JetBrains, or Neovim.
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-features">Features</a> •
  <a href="USAGE.md">Complete Usage Guide</a> •
  <a href="#-ai-agent-integration-mcp-server">AI Agent (MCP)</a> •
  <a href="#-troubleshooting">Troubleshooting</a>
</p>

---

## 🎯 What is the Universal Bridge?

The built-in Roblox Studio script editor lacks the speed, AI intelligence, and extension ecosystems of professional developer environments. The **Roblox Universal IDE Bridge** gives you the best of both worlds:

- ⚡ **Direct Real-Time Two-Way Sync**: Edit Lua/Luau in your favorite editor; saves update inside Studio in milliseconds.
- 🖥️ **Native Desktop Dashboard (`RobloxBridgeApp.exe`)**: Control center with project switching, live activity logs, Luau script runner, and Game Explorer.
- 🤖 **AI Agent Autonomous Control (MCP Server)**: Connects with AI assistants (**Antigravity**, **Cursor**, **Claude Desktop**) via the Model Context Protocol. AI agents can execute tests, inspect game hierarchies, and read runtime errors autonomously!
- 📦 **.rbxlx Place File Export**: Download complete, hierarchical XML place files that open directly in Roblox Studio without needing any plugin.
- 🛡️ **Smart Conflict Diff / Merge**: Side-by-side split visual diff modal that prevents data loss if Studio and your IDE edit the same script at once.
- 🏷️ **GUID Tracking & Safe Renames (`.meta.json`)**: Persistent UUID sidecars ensure renaming or moving files won't destroy script instances or break `require()` chains.
- 📦 **Wally Package Manager**: One-click package installer inside the app for libraries like Knit, Signal, and Promise.
- ⚡ **TypeScript / roblox-ts**: Watches `.ts` files, auto-compiles with `rbxtsc`, and tracks build statuses.

---

## 🚀 Quick Start

### 1. Installation (One-Click)
Run `install.bat` in the repository root. It automatically:
- Installs `RobloxBridge.lua` to `%LOCALAPPDATA%\Roblox\Plugins\`
- Sets up your default projects directory (`Documents\RobloxProjects`)
- Installs all dependencies for the server, desktop app, and MCP agent layer.

### 2. Enable HTTP in Studio
1. Open your game in **Roblox Studio**.
2. **Home** → **Game Settings** → **Security** → Enable **"Allow HTTP Requests"**.
3. Save.

### 3. Launch & Connect
1. Double-click `RobloxBridgeApp.exe` (in `roblox-bridge-app/dist/`) or run `start-bridge.bat`.
2. In Roblox Studio, click **Plugins** → **Roblox Universal Bridge** → **Status Widget** → **Connect**.
3. Edit code in your IDE — changes reflect instantly in Studio!

For detailed step-by-step testing instructions, read the **[Complete Usage Guide (USAGE.md)](USAGE.md)**.

---

## ✨ Features Breakdown

| Feature | Category | Description |
|---|---|---|
| **Real-time Live Sync** | Core Sync | Saves in your IDE instantly push to Studio via local WebSocket/HTTP. |
| **.rbxlx Place Export** | Portability | One-click export to standard Roblox XML place format with nested folder reconstruction. |
| **Smart Conflict Diff** | Safety | Visual side-by-side diff resolution when Studio and the IDE modify the same file within 8s. |
| **GUID Rename Tracking** | Integrity | `.meta.json` sidecars ensure renames update in-place without breaking `require()` references. |
| **Wally Package Manager** | Packages | Detects `wally.toml` and installs dependencies directly from the dashboard. |
| **TypeScript (roblox-ts)** | Toolchain | Watches `.ts` files and compiles via `rbxtsc` with status badge & manual build triggers. |
| **Luau Execution Engine** | Testing | In-app runner executing arbitrary Luau directly inside Studio with live timing & return values. |
| **DataModel Game Explorer** | Inspection | Live hierarchy tree snapshot streamed from Studio to the dashboard. |
| **Studio Log Streaming** | Console | Studio `print`, `warn`, and `error` outputs streamed live to your desktop console. |
| **Roblox MCP Server** | AI Agents | Standard Model Context Protocol server giving AI agents direct tool access in Studio. |

---

## 🤖 AI Agent Integration (MCP Server)

The bridge includes a built-in **Model Context Protocol (MCP)** server (`roblox-mcp-server`), allowing AI assistants like **Antigravity**, **Cursor**, or **Claude Desktop** to autonomously interact with Roblox Studio:

- `roblox_start_playtest` — AI starts Play Solo or Server + Player playtests directly.
- `roblox_stop_playtest` — AI stops playtests and returns Studio to edit mode.
- `roblox_lint_script` — AI statically checks Luau scripts for syntax errors before syncing.
- `roblox_run_luau` — AI runs test scripts directly inside Studio and inspects results.
- `roblox_read_studio_logs` — AI reads Studio's `print`/`warn`/`error` stream to debug runtime bugs.
- `roblox_get_datamodel_tree` — AI inspects game hierarchy (parts, models, folders, Remotes).
- `roblox_write_script` — AI writes or updates scripts with hot-reloading into Studio.
- `roblox_launch_studio` — AI launches Roblox Studio on demand.
- `roblox_get_status` — AI checks connection state and active project stats.

See [mcp_config.example.json](mcp_config.example.json) and [roblox-mcp-server/README.md](roblox-mcp-server/README.md) for configuration.

### 🧠 Built-In AI Skills Suite (`.agents/skills/`)
The repository includes a comprehensive, modular Agent Skills suite (compatible with Antigravity and Cursor) mirroring and surpassing Roblox Studio's Assistant Skills:
- **`roblox-debug`** — Autonomous error log diagnosis, stack trace mapping, and playtest verification.
- **`roblox-security-audit`** — RemoteEvent/RemoteFunction vulnerability audits, exploiter mitigation, and server-side authority validation.
- **`roblox-datastore-architect`** — Session locking, `UpdateAsync` race condition prevention, and schema migration.
- **`roblox-unit-test`** — Automated test suite generation and live execution in Studio.
- **`roblox-perf-profiling`** — Microsecond `os.clock()` benchmarking and memory leak detection.
- **`roblox-ui-builder`** — Code-first responsive `ScreenGui` generation with glassmorphism and tweens.
- **`roblox-scene-inspector`** — 3D physics audit, unanchored part detection, and streaming checks.

---

## 📁 Rojo-Compatible File Conventions

The bridge organizes disk files into Roblox hierarchy:

```
Documents\RobloxProjects\<ProjectName>\
├── default.project.json
├── .robloxignore
├── wally.toml                       # (Optional) Wally dependencies
├── tsconfig.json                    # (Optional) TypeScript configuration
└── src/
    ├── ReplicatedStorage/          → game.ReplicatedStorage
    │   ├── SharedModule.luau       → ModuleScript
    │   └── SharedModule.luau.meta.json
    ├── ServerScriptService/        → game.ServerScriptService
    │   └── GameManager.server.luau → Script (Server)
    └── StarterPlayer/
        └── StarterPlayerScripts/   → game.StarterPlayer.StarterPlayerScripts
            └── ClientMain.client.luau → LocalScript (Client)
```

---

## 🔧 Troubleshooting

- **Studio says "Connection failed" or "Offline"**: Ensure the bridge server/app is running on port `7777` and **Allow HTTP Requests** is enabled in Studio Game Settings.
- **"Cannot start server script (lacking capability RunServerScript)"**: You have a `.server.luau` script inside a client container (e.g. `StarterPlayerScripts` or character models). Rename it to `.client.luau`.
- **Port 7777 Busy**: If another app uses 7777, you can change the port in `appServer.js` and `RobloxBridge.lua`.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

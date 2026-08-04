<p align="center">
  <img src="https://img.shields.io/badge/version-1.3.0-blue?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/platform-Windows-0078D6?style=for-the-badge&logo=windows" alt="Platform">
  <img src="https://img.shields.io/badge/Roblox-Studio-E2231A?style=for-the-badge&logo=roblox&logoColor=white" alt="Roblox">
  <img src="https://img.shields.io/badge/VS_Code-Extension-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="VS Code">
  <img src="https://img.shields.io/badge/language-Lua%2FLuau-2C2D72?style=for-the-badge&logo=lua&logoColor=white" alt="Lua">
  <img src="https://img.shields.io/github/license/Esca-Byte/Roblox-Bridge?style=for-the-badge" alt="License">
</p>

<h1 align="center">🔗 Roblox VS Code Bridge</h1>

<p align="center">
  <strong>Real-time two-way sync between VS Code and Roblox Studio</strong><br>
  Developed by <a href="https://github.com/Esca-Byte"><strong>Esca-Byte</strong></a> • Write Lua/Luau in your favorite editor.
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-features">Features</a> •
  <a href="#-how-it-works">How It Works</a> •
  <a href="#%EF%B8%8F-configuration">Configuration</a> •
  <a href="#-troubleshooting">Troubleshooting</a> •
  <a href="#-contributing">Contributing</a>
</p>

---

## 🎯 Why This Exists

Roblox Studio's built-in script editor lacks the power of a real code editor. This bridge lets you:

- ✏️ **Write code in VS Code** with full IntelliSense, extensions, themes, and Git
- ⚡ **See changes in Studio instantly** — no manual copy-paste
- 📤 **Export your entire game's scripts** to VS Code in one click
- 🔄 **Two-way sync** — edit in either direction
- 📁 **Rojo-compatible file structure** — `init.lua`, `.server.lua`, `.client.lua`

---

## 🚀 Quick Start

### Prerequisites

- [VS Code](https://code.visualstudio.com/) (v1.74+)
- [Roblox Studio](https://www.roblox.com/create)
- [Node.js](https://nodejs.org/) (v16+)
- Windows OS

### Installation

```bash
# 1. Clone the repo
git clone https://github.com/Esca-Byte/Roblox-Bridge.git
cd Roblox-Bridge

# 2. Run the installer (copies plugin + installs VS Code extension)
install.bat
```

That's it! The installer automatically:
- Copies the Roblox Studio plugin to `%LOCALAPPDATA%\Roblox\Plugins\`
- Packages and installs the VS Code extension

### First Sync (3 steps)

1. **VS Code** → `Ctrl+Shift+P` → `Roblox Bridge: Start Server`
2. **Roblox Studio** → Enable **HTTP Requests** in Game Settings → Security
3. **Studio toolbar** → Click **Connect**

Your scripts are now syncing! ✅

---

## ✨ Features

### Core

| Feature | Description |
|---------|-------------|
| **Live Sync** | File changes in VS Code are instantly reflected in Studio |
| **Export Scripts** | One-click export of all Studio scripts to VS Code |
| **Upload Selected** | Push specific scripts back from Studio to disk |
| **Conflict Detection** | Warns you when a file was modified in both places |
| **init.lua Support** | Rojo-compatible `init.lua`, `init.server.lua`, `init.client.lua` |
| **Two-Way Delete** | Scripts deleted in Studio are removed from disk (opt-in) |
| **Auto-Export** | Automatically rescan workspace when Studio connects |
| **.robloxignore** | Exclude files from syncing (gitignore-style syntax) |

### VS Code Extension

| Feature | Description |
|---------|-------------|
| **Output Channel** | Dedicated "Roblox Bridge" log panel for debugging |
| **TreeView Panel** | Sidebar showing synced scripts organized by Roblox service |
| **New Script Templates** | Right-click → create Script / LocalScript / ModuleScript with boilerplate |
| **Smart Status Bar** | Live file count, last sync time, connection animation |
| **Write-Guard** | Prevents file watcher loops when the bridge writes files |

### Roblox Studio Plugin

| Feature | Description |
|---------|-------------|
| **Status Widget** | Animated panel with pulse indicator, stat cards, and color-coded log |
| **Progress Bar** | Visual feedback during sync operations |
| **Auto-Reconnect** | Retries connection automatically on network hiccups |
| **Uptime Counter** | Shows how long you've been connected |

---

## ⚙️ How It Works

```
VS Code                    localhost:7777              Roblox Studio
┌──────────────────┐       ┌──────────────┐           ┌──────────────────┐
│  .lua/.luau files│──────▸│  HTTP Bridge │◂──────────│  Script instances │
│  (file watcher)  │       │  (Node.js)   │           │  (Lua plugin)    │
│                  │◂──────│              │──────────▸│                  │
│  VS Code ext.    │ write │  extension.js│  poll     │  RobloxBridge.lua│
└──────────────────┘       └──────────────┘           └──────────────────┘
```

1. The **VS Code extension** starts an HTTP server on `localhost:7777`
2. It watches your `src/` folder for `.lua` / `.luau` file changes
3. The **Studio plugin** polls the server every 2 seconds for updates
4. Changed files are applied as Script instances in the correct location
5. You can also push scripts back from Studio → VS Code via `POST /write`

---

## 📁 File Structure

```
my-game/
├── src/
│   ├── ServerScriptService/
│   │   ├── GameManager.server.lua          → Script
│   │   └── DataStore/
│   │       └── init.server.lua             → Script (named "DataStore")
│   ├── ReplicatedStorage/
│   │   ├── Shared/
│   │   │   ├── init.lua                    → ModuleScript (named "Shared")
│   │   │   └── Types.lua                   → ModuleScript
│   │   └── RemoteEvents.lua                → ModuleScript
│   └── StarterPlayer/
│       └── StarterPlayerScripts/
│           └── MainGui.client.lua          → LocalScript
├── .robloxignore                           → Exclude patterns
└── README.md
```

**Naming conventions** (Rojo-compatible):
| Pattern | Script Type |
|---------|-------------|
| `*.server.lua` / `*.server.luau` | Script |
| `*.client.lua` / `*.client.luau` | LocalScript |
| `*.lua` / `*.luau` | ModuleScript |
| `init.lua` / `init.server.lua` / `init.client.lua` | Maps to parent folder name |

---

## 🛠️ Configuration

All settings are in VS Code under **Settings → Extensions → Roblox Bridge**:

| Setting | Default | Description |
|---------|---------|-------------|
| `robloxBridge.port` | `7777` | HTTP server port |
| `robloxBridge.sourcePath` | `"src"` | Folder to watch for Lua files |
| `robloxBridge.autoStart` | `false` | Start bridge when workspace opens |
| `robloxBridge.pollInterval` | `2` | Seconds between Studio polls |
| `robloxBridge.preferLuau` | `false` | Use `.luau` instead of `.lua` |
| `robloxBridge.autoExportOnConnect` | `false` | Rescan files when Studio connects |
| `robloxBridge.twoWayDelete` | `false` | Allow Studio to delete files on disk |
| `robloxBridge.showConnectionNotifications` | `true` | Toast on connect/disconnect |
| `robloxBridge.heartbeatTimeoutSeconds` | `15` | Seconds before disconnect detection |

---

## 📋 Commands

### VS Code (`Ctrl+Shift+P`)

| Command | Description |
|---------|-------------|
| `Roblox Bridge: Start Server` | Start the HTTP bridge server |
| `Roblox Bridge: Stop Server` | Stop the server |
| `Roblox Bridge: Rescan Workspace Files` | Force rescan all Lua files |
| `Roblox Bridge: Show Connection Status` | Display connection info |
| `Roblox Bridge: New Script` | Create a new Roblox script from template |
| `Roblox Bridge: Show Output Log` | Open the output channel |

### Roblox Studio Toolbar

| Button | Description |
|--------|-------------|
| **Connect** | Start/stop live polling |
| **Export →** | Export all game scripts to VS Code |
| **Pull All** | Pull every file from VS Code |
| **Upload** | Push selected script(s) to VS Code |
| **Status** | Toggle the status panel |

---

## 🔧 Troubleshooting

<details>
<summary><strong>Studio says "Server unreachable"</strong></summary>

Make sure the bridge server is running in VS Code first:  
`Ctrl+Shift+P` → `Roblox Bridge: Start Server`
</details>

<details>
<summary><strong>Port 7777 is already in use</strong></summary>

Change `robloxBridge.port` in VS Code settings to another port (e.g., `7778`).  
Also update `CONFIG.port` in `RobloxBridge.lua` to match.
</details>

<details>
<summary><strong>"Allow HTTP Requests" error in Studio</strong></summary>

Go to **Game Settings → Security** and enable **Allow HTTP Requests**.
</details>

<details>
<summary><strong>Scripts not appearing in Studio</strong></summary>

- Verify a `src/` folder exists in your workspace root
- Ensure files have `.lua` or `.luau` extensions
- Try clicking **Pull All** in the Studio toolbar
</details>

<details>
<summary><strong>Extension not found after install</strong></summary>

Reload VS Code: `Ctrl+Shift+P` → `Developer: Reload Window`  
If still missing, re-run `install.bat`.
</details>

<details>
<summary><strong>Two-way delete not working</strong></summary>

It's disabled by default for safety.  
Enable it: VS Code Settings → `robloxBridge.twoWayDelete` → `true`
</details>

---

## 🌐 HTTP API Reference

For advanced users and custom tooling:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Health check |
| `GET` | `/status` | Server stats & connection state |
| `GET` | `/config` | Current settings (for Studio plugin) |
| `GET` | `/files` | List all tracked files |
| `GET` | `/changes?since=<ms>` | Get changes since timestamp |
| `POST` | `/heartbeat` | Studio heartbeat |
| `POST` | `/write` | Write a file from Studio to disk |
| `POST` | `/delete-from-studio` | Delete a file on disk |
| `POST` | `/sync-from-studio` | Bulk export from Studio |

---

## 📦 Project Structure

```
roblox-vscode-bridge/
├── vscode-extension/
│   ├── extension.js          # VS Code extension (HTTP server + file watcher)
│   └── package.json          # Extension manifest
├── roblox-plugin/
│   └── RobloxBridge.lua      # Roblox Studio plugin
├── install.bat               # One-click installer
└── README.md
```

---

## 🤝 Contributing

Contributions are welcome! Here's how:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Ideas for Contributions

- 🐧 Linux / macOS support
- 🔌 Rojo project file (`*.project.json`) compatibility
- 📊 Script analytics dashboard
- 🧪 Automated testing
- 🎨 Custom themes for the Studio widget

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## ⭐ Star This Repo

If this tool helped your Roblox development workflow, please consider giving it a ⭐ on GitHub!

---

<p align="center">
  Made with ❤️ for the Roblox developer community
</p>
#

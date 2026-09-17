# 🖥️ Roblox Universal IDE Bridge — Desktop Application v2.2.0

> Created by **[Esca-Byte](https://github.com/Esca-Byte)**

A modern, native Desktop GUI Dashboard and Synchronization Engine for the **Roblox Universal IDE Bridge**.

---

## ✨ Features & What's New in v2.2.0

- 💾 **Persistent Project Memory**: Remembers your last active project across launches via `bridge-config.json`.
- 📁 **Project Management**:
  - **Create Project**: Choose between **Standard** Rojo project and **Knit Framework** (inspired by SuperbulletFrameworkV1-Knit).
  - **Rename Project**: Rename projects in-place directly from the UI toolbar.
  - **Delete Project**: Permanently remove old projects with confirmation safety modal.
- ⚡ **Knit Framework Scaffolding**:
  - Pre-configures `ClientSource`, `SharedSource`, and `ServerSource`.
  - Scaffolds `ProfileTemplate.lua`, `ProfileService.lua` (DataStore session management), and `DataController.lua`.
  - Component architecture with `Accessor.lua` (Read) and `Mutator.lua` (Write).
  - Built-in AI instructions: strictly NO yielding in `KnitInit()`.
- 📊 **Real-Time Dashboard**:
  - Live **Server Uptime** counter (HH:MM:SS).
  - **File Sync Pulse Animation**: Real-time glow whenever files are modified or deleted.
  - **Dynamic WebSocket Status Badge**: Connected (Green), Reconnecting (Yellow pulse), Disconnected (Red).
  - Real-time Studio connection status and active project path.
- 🔔 **Interactive Notification Toasts**: Instant feedback for Studio connection, project switches, file scans, and errors.
- 📄 **Export Console Log**: Download complete timestamped session logs as a `.txt` file with one click.
- 🌳 **Interactive Script Explorer**: Tree navigation of all `.luau` / `.lua` files grouped by Roblox services (`ServerScriptService`, `ReplicatedStorage`, `StarterPlayerScripts`, etc.).
- 🚀 **Quick Action Toolbar**:
  - **Open in IDE**: Launches VS Code / Cursor for your project immediately.
  - **Open Folder**: Opens project location in Windows Explorer.
  - **Rescan**: Force rescans project files.

---

## 🚀 How to Launch

### Option 1: Compiled Executable (No Node.js Required)
Run `start-app.bat` or launch:
```
roblox-bridge-app/dist/RobloxBridgeApp.exe
```

### Option 2: Run via Node.js
```bash
cd roblox-bridge-app
npm install
npm start
```
The native Electron window will appear automatically (also accessible via browser at `http://localhost:7777`).

---

## 🛠️ Building the Executable (.exe)
```bash
cd roblox-bridge-app
npm install
npm run build-exe
```
Or simply double-click `build-exe.bat`. The standalone portable Windows executable will be compiled into `dist/RobloxBridgeApp.exe`.

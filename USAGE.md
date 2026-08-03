# 📖 Roblox Universal IDE Bridge — How to Use Guide

> Developed by **[Esca-Byte](https://github.com/Esca-Byte)**

A complete guide to installing, configuring, and using the **Roblox Universal IDE Bridge** to write Lua/Luau scripts in your favorite IDE (VS Code, Cursor, JetBrains, Neovim, etc.) with real-time sync to Roblox Studio.

---

## 📋 Table of Contents
1. [Prerequisites](#-prerequisites)
2. [Installation](#-installation)
3. [Step 1: Roblox Studio Setup](#step-1-roblox-studio-setup)
4. [Step 2: Starting the Bridge Server](#step-2-starting-the-bridge-server)
5. [Step 3: Opening your Project in your IDE](#step-3-opening-your-project-in-your-ide)
6. [Step 4: Connecting Roblox Studio](#step-4-connecting-roblox-studio)
7. [Daily Workflow & Features](#-daily-workflow--features)
   - [Writing & Auto-Syncing Code](#writing--auto-syncing-code)
   - [Exporting Game Scripts from Studio](#exporting-game-scripts-from-studio)
   - [Pulling All Files into Studio](#pulling-all-files-into-studio)
   - [Creating New Scripts](#creating-new-scripts)
8. [File & Directory Conventions](#-file--directory-conventions)
9. [Ignoring Files (.robloxignore)](#-ignoring-files-robloxignore)
10. [Troubleshooting & FAQ](#-troubleshooting--faq)

---

## ⚡ Prerequisites

Before you begin, ensure you have installed:
- **[Roblox Studio](https://www.roblox.com/create)**
- **[Node.js](https://nodejs.org/)** (v16 or higher)
- **Windows OS**
- Any Code Editor: VS Code, Cursor, JetBrains, Sublime Text, Neovim, etc.

---

## 🛠️ Installation

1. Open the project folder in File Explorer or Command Prompt.
2. Double-click **`install.bat`** (or run `.\install.bat` in CMD/PowerShell).

**What `install.bat` does automatically:**
- Copies `RobloxBridge.lua` to your local Roblox Studio Plugins directory (`%LOCALAPPDATA%\Roblox\Plugins`).
- Resolves and creates your default projects folder in your Windows **Documents** directory (`Documents\RobloxProjects`).
- Installs all node dependencies required by the bridge server.

---

## Step 1: Roblox Studio Setup

1. Open your place file in **Roblox Studio**.
2. Go to **Home** → **Game Settings** → **Security**.
3. Enable **"Allow HTTP Requests"**.
4. Click **Save**.

> 💡 *Note: Roblox Studio plugins require HTTP access to communicate with the local bridge server on `http://localhost:7777`.*

---

## Step 2: Starting the Bridge Server

### Option A: Using `start-bridge.bat` (Recommended)
Double-click `start-bridge.bat` in the project folder.

### Option B: Using Command Line (CLI)
Open CMD/PowerShell in `roblox-bridge-server` directory and run:
```bash
npm start
```

### Options for Creating / Selecting Projects via CMD:
- **Interactive Mode**: Simply run `start-bridge.bat`. It will display available projects in your `Documents\RobloxProjects` folder or prompt you to press `[C]` to create a new project.
- **Direct Project Creation**: Pass your project name directly:
  ```cmd
  start-bridge.bat MyNewGame
  ```
  or
  ```cmd
  node src/cli.js "MyNewGame"
  ```

---

## Step 3: Opening your Project in your IDE

1. Open your code editor (VS Code, Cursor, JetBrains, etc.).
2. Open your project folder located in your **Documents**:
   ```
   Documents\RobloxProjects\<YourProjectName>\
   ```
3. You will see the standard Rojo-compatible structure:
   ```
   MyRobloxGame/
   ├── default.project.json
   ├── .robloxignore
   └── src/
       ├── ReplicatedStorage/
       │   └── SharedModule.luau
       ├── ServerScriptService/
       │   └── GameManager.server.luau
       └── StarterPlayer/
           └── StarterPlayerScripts/
               └── ClientMain.client.luau
   ```

---

## Step 4: Connecting Roblox Studio

1. In Roblox Studio, look under **Plugins** → **Roblox Universal Bridge**.
2. Click **Status Widget** to open the bridge side panel.
3. In the side panel, click **Connect to Bridge Server**.
4. Studio will display:  
   `🟢 Connected to project: <YourProjectName>`

All scripts will automatically pull and start live-syncing!

---

## 🔄 Daily Workflow & Features

### Writing & Auto-Syncing Code
- Edit any `.luau` or `.lua` file inside `src/` in your IDE and save (`Ctrl+S`).
- The bridge server instantly detects the save and updates the script inside Roblox Studio in real time.

### Exporting Game Scripts from Studio
If you created scripts inside Roblox Studio and want to bring them into your external IDE:
- Open the **Status Widget** panel and click **📤 Export Game**.
- All scripts in `ReplicatedStorage`, `ServerScriptService`, and `StarterPlayer` will be saved to your IDE project folder.

### Pulling All Files into Studio
If you made offline edits or switched projects:
- Open the **Status Widget** panel and click **📥 Pull All Files** to force-reload all files from disk into Studio.

---

## 📁 File & Directory Conventions

The bridge uses standard Rojo naming rules to map disk files to Roblox Studio instances:

| File Extension / Pattern | Roblox Instance Type | Roblox Studio Location |
|--------------------------|---------------------|------------------------|
| `*.server.luau` / `*.server.lua` | **Script** (Server) | Based on subfolder path |
| `*.client.luau` / `*.client.lua` | **LocalScript** (Client) | Based on subfolder path |
| `*.luau` / `*.lua` | **ModuleScript** | Based on subfolder path |
| `init.server.luau` | **Script** | Named after parent folder |
| `init.client.luau` | **LocalScript** | Named after parent folder |
| `init.luau` | **ModuleScript** | Named after parent folder |

### Folder Mapping (`default.project.json`):
- `src/ReplicatedStorage/` → `game.ReplicatedStorage`
- `src/ServerScriptService/` → `game.ServerScriptService`
- `src/StarterPlayer/StarterPlayerScripts/` → `game.StarterPlayer.StarterPlayerScripts`

---

## 🙈 Ignoring Files (.robloxignore)

To prevent specific temporary files or folders from syncing to Studio, edit `.robloxignore` in your project root:
```gitignore
*.tmp
node_modules/
.git/
secret_drafts/
```

---

## 🔧 Troubleshooting & FAQ

#### Q: Where are my project files saved?
A: Projects are stored in your Windows Documents folder:  
`Documents\RobloxProjects\<ProjectName>`  
*(Note: If OneDrive is active on your PC, Windows stores this at `%USERPROFILE%\OneDrive\Documents\RobloxProjects`)*.

#### Q: Plugin status says "Status: 🔴 Offline"
1. Ensure `start-bridge.bat` is running in your terminal/CMD.
2. Verify that **Allow HTTP Requests** is enabled in Roblox Studio (**Game Settings → Security**).
3. Ensure port `7777` is not blocked by Windows Firewall.

#### Q: How do I change the bridge port?
If port `7777` is occupied by another application, edit `port` in `roblox-bridge-server/src/server.js` and matching `CONFIG.serverUrl` in `RobloxBridge.lua`.

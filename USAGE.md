# 📖 Blox Sync — Comprehensive Usage & Testing Guide (v2.2.0)

> Developed by **[Esca-Byte](https://github.com/Esca-Byte)**  
> Next-generation two-way sync connecting external IDEs (**Antigravity, VS Code, Cursor, JetBrains, Neovim, etc.**) with **Roblox Studio** via **Blox Sync**.

---

## 📋 Table of Contents
1. [⚡ Prerequisites & Installation](#-prerequisites--installation)
2. [🚀 Quick Setup (3 Steps)](#-quick-setup-3-steps)
3. [🖥️ Desktop App Dashboard Overview](#️-desktop-app-dashboard-overview)
4. [🛠️ Core Features & How to Use Them](#️-core-features--how-to-use-them)
   - [Feature 1: .rbxlx Place File Export](#feature-1-rbxlx-place-file-export)
   - [Feature 2: Smart Diff & Conflict Merge](#feature-2-smart-diff--conflict-merge)
   - [Feature 3: File Rename & GUID Tracking (.meta.json)](#feature-3-file-rename--guid-tracking-metajson)
   - [Feature 4: Wally Package Manager](#feature-4-wally-package-manager)
   - [Feature 5: TypeScript / roblox-ts Compiler](#feature-5-typescript--roblox-ts-compiler)
   - [Feature 6: Live Luau Script Runner](#feature-6-live-luau-script-runner)
   - [Feature 7: Live Game Explorer & Console Logs](#feature-7-live-game-explorer--console-logs)
5. [🤖 AI Agent Integration via MCP Server (Path A)](#-ai-agent-integration-via-mcp-server-path-a)
6. [🧪 Step-by-Step Manual Testing Guide](#-step-by-step-manual-testing-guide)
7. [📁 Project Structure & Rojo Mappings](#-project-structure--rojo-mappings)
8. [🔧 Troubleshooting & FAQ](#-troubleshooting--faq)

---

## ⚡ Prerequisites & Installation

### Requirements
- **Windows OS** (10 or 11)
- **[Roblox Studio](https://www.roblox.com/create)**
- **[Node.js](https://nodejs.org/)** (v16 or higher)
- Any Code Editor: **Antigravity**, **VS Code**, **Cursor**, **JetBrains**, etc.
- *(Optional for Wally)*: [Wally CLI](https://github.com/UpliftGames/wally) installed in PATH
- *(Optional for TypeScript)*: `roblox-ts` (`npm install -g roblox-ts`)

### One-Click Installation
1. Open the repository root.
2. Double-click **`install.bat`** (or run `.\install.bat` in CMD/PowerShell).
3. `install.bat` will automatically:
   - Copy `BloxSync.lua` to `%LOCALAPPDATA%\Roblox\Plugins\`
   - Set up your default projects directory (`Documents\RobloxProjects`)
   - Install required dependencies for the Desktop App, Server, and MCP AI Agent


---

## 🚀 Quick Setup (3 Steps)

### Step 1: Enable HTTP Requests in Roblox Studio
1. Open any game or place in **Roblox Studio**.
2. Click **Home** → **Game Settings** → **Security**.
3. Toggle **"Allow HTTP Requests"** to **ON**.
4. Click **Save**.

### Step 2: Start Blox Sync
You can launch either:
- **Desktop Dashboard App**:
  ```bash
  cd blox-sync-app
  npm start
  ```
- **CLI Sync Server**:
  Double-click `start-bloxsync.bat` or run:
  ```bash
  cd blox-sync-server
  npm start
  ```

### Step 3: Connect Roblox Studio
1. In Studio, click the **Plugins** tab on the top ribbon.
2. Under **Blox Sync**, click **Status Widget**.
3. In the floating dock widget, click **Connect to Blox Sync Server**.
4. The status pill will turn **🟢 Connected**.

---

## 🖥️ Desktop App Dashboard Overview

The Desktop App UI (`http://localhost:7777`) gives you complete visibility and control:

- **Top Navigation Bar**:
  - **Project Switcher**: Dropdown to toggle between projects in `Documents\RobloxProjects`.
  - **New Project (`+ New`)**: Create standard or Knit framework projects.
  - **IDE Launcher (`Open IDE`)**: One-click launcher for Antigravity, Cursor, VS Code, Qoder, or Custom CLI.
  - **Export .rbxlx (`📦 Export .rbxlx`)**: Download full place file.
  - **Wally Install (`📦 Wally Install`)**: Run Wally package installer.
  - **Compile TS (`⚡ Compile TS`)**: Trigger roblox-ts build.
  - **Rescan & Open Folder**: Sync files on disk or open Explorer.
- **Stats Bar**:
  - Tracked file count, active project, Studio connection state, TypeScript status (`Active` / `Build OK` / `Compiling`).
- **Main Workspace Tabs**:
  - **Console**: Live WebSocket & server activity logs + Studio `print`, `warn`, and `error` outputs.
  - **Luau Runner**: Execute Luau code directly inside Studio with live output and timings.
  - **Game Explorer**: Live DataModel tree snapshot from Roblox Studio.

---

## 🛠️ Core Features & How to Use Them

### Feature 1: .rbxlx Place File Export
- **What it does**: Builds a complete Roblox XML Place (`.rbxlx`) format directly from your project files, reconstructing all nested folders and services (`Workspace`, `ReplicatedStorage`, `ServerScriptService`, `ServerStorage`, `StarterGui`, `StarterPack`, `StarterPlayer`).
- **How to use**:
  1. Click **Export .rbxlx** in the top action bar of the Desktop App.
  2. The browser downloads `<ProjectName>.rbxlx`.
  3. Double-click the downloaded file — it opens directly in Roblox Studio with your full script hierarchy, completely independent of the plugin!

---

### Feature 2: Smart Diff & Conflict Merge
- **What it does**: Protects against accidental overwrites if you edit a script in your IDE and in Roblox Studio at the same time (within an 8-second window).
- **How to use**:
  1. When a collision occurs, the server rejects silent overwriting and emits a conflict event.
  2. The **Sync Conflict Detected** modal pops up in the Desktop App with side-by-side editors:
     - 📁 **IDE Version** (Your local disk file)
     - 🎮 **Studio Version** (The version modified in Studio)
  3. Click either:
     - **✅ Keep IDE Version**: Retains local file and pushes your changes back to Studio.
     - **🎮 Use Studio Version**: Overwrites local file with the Studio code.

---

### Feature 3: File Rename & GUID Tracking (.meta.json)
- **What it does**: Renaming a file previously deleted and recreated the script in Studio, changing its instance identity and breaking active `require()` chains. Blox Sync tracks every script with a persistent UUID (`BloxSyncGUID` / `BridgeGUID`) stored in sidecar `.meta.json` files.
- **How to use**:
  - Rename or move any script file in your IDE (e.g. `OldService.luau` → `NewService.luau`).
  - The server detects the rename via content matching and copies `.meta.json`.
  - The Studio plugin finds the script instance by GUID and renames/moves it **in place** without destroying it.
  - All existing table references and `require()` calls remain intact!

---

### Feature 4: Wally Package Manager
- **What it does**: Installs Wally dependencies (like Knit, Promise, Signal) directly from the dashboard.
- **How to use**:
  1. Include a `wally.toml` in your project root (or create a Knit project from the `+ New Project` button).
  2. The **Wally Install** button will highlight in the toolbar.
  3. Click **Wally Install**: the app executes `wally install`, streams output to the Console log, and automatically syncs newly installed packages into Studio.

---

### Feature 5: TypeScript / roblox-ts Compiler
- **What it does**: Supports TypeScript Roblox development using `roblox-ts` (`rbxtsc`).
- **How to use**:
  1. If a `tsconfig.json` exists in the project, Blox Sync automatically flags it as a TypeScript project.
  2. Whenever any `.ts` file is saved, the Blox Sync watcher automatically runs `npx rbxtsc --watch=false`.
  3. You can also click **⚡ Compile TS** at any time.
  4. The stats bar displays compile progress (`Compiling…` → `Build OK` or `Build Error`).

---

### Feature 6: Live Luau Script Runner
- **What it does**: Runs ad-hoc Luau code inside Roblox Studio without having to open the Studio Command Bar.
- **How to use**:
  1. In the Desktop App, switch to the **Luau Runner** tab.
  2. Type any Luau code (e.g., `workspace.Baseplate.Color = Color3.fromRGB(255, 0, 0)`).
  3. Click **▶ Run in Studio** (or press `Ctrl+Enter`).
  4. The job ID, execution time in ms, and return values appear in the output log.

---

### Feature 7: Live Game Explorer & Console Logs
- **Console**: Switch to the **Console** tab to see all Studio prints, warnings, and errors streamed in real time.
- **Game Explorer**: Switch to the **Game Explorer** tab and click **Refresh Snapshot** to inspect the live Studio DataModel hierarchy.

---

## 🤖 AI Agent Integration via MCP Server (Path A)

The **Roblox MCP Server** allows AI assistants (such as **Antigravity**, **Cursor**, and **Claude Desktop**) to autonomously control and inspect Roblox Studio directly via tools:

- `roblox_get_status`: Checks connection state, active project, and tracked script count.
- `roblox_start_playtest`: Starts a Roblox Studio playtest session directly (`"solo"` or `"server"`).
- `roblox_stop_playtest`: Stops the active playtest session and returns Studio to Edit Mode.
- `roblox_lint_script`: Statically checks Luau script code or tracked files for syntax errors and common bugs.
- `roblox_run_luau`: Executes Luau code live in Studio and returns stdout, return values, and runtime errors.
- `roblox_get_datamodel_tree`: Inspects live instances, parts, folders, and scripts across any Roblox service.
- `roblox_read_studio_logs`: Streams engine print/warn/error logs for autonomous error fixing.
- `roblox_get_tracked_files`: Lists all tracked project scripts and their persistent GUIDs.
- `roblox_write_script`: Writes scripts with instant synchronization into Studio.
- `roblox_export_place`: Generates standalone `.rbxlx` place files.
- `roblox_install_wally`: Runs Wally dependency installation.
- `roblox_launch_studio`: Launches Roblox Studio via system shortcut.

### Configuration

> ⚠️ **Important**: The MCP server requires an **absolute path** to your local clone of this repo.  
> The `mcp_config.example.json` contains a `<ABSOLUTE_PATH_TO_REPO>` placeholder — you **must** replace it with the real path on your machine.

**Antigravity** — edit `~/.gemini/config/mcp_config.json`:
```json
{
  "mcpServers": {
    "roblox-bridge": {
      "command": "node",
      "args": [
        "C:/path/to/your/roblox-vscode-bridge-main/blox-sync-mcp/src/index.js"
      ],
      "env": {
        "BLOX_SYNC_URL": "http://localhost:7777"
      }
    }
  }
}
```

**Cursor / Claude Desktop** — copy `mcp_config.example.json` into your IDE's MCP settings and replace `<ABSOLUTE_PATH_TO_REPO>` with the full path to this repo on your machine (e.g. `C:/Users/YourName/Downloads/roblox-vscode-bridge-main`).

---

### 🧠 Built-In AI Skills Package (`.agents/skills/`)
Similar to the official Roblox Assistant Skills (`rbx-debug`, `rbx-perf-profiling`, `textured-gui`), our bridge repository includes a native, production-grade AI Agent skills suite with ready-to-run Luau companion scripts:
- **`roblox-debug`**: Autonomous debugging runbook. Directs the AI to capture error logs from Studio, translate hierarchy paths to local files, and verify fixes with playtests. Includes `scripts/diagnose_world.luau`.
- **`roblox-security-audit`**: RemoteEvent and RemoteFunction security auditing. Enforces server-side authority, validates parameter types/bounds, checks range, and prevents exploiter DoS. Includes `scripts/audit_remotes.luau`.
- **`roblox-datastore-architect`**: Production DataStore & persistence engineering. Session locking, `UpdateAsync` atomic transformations, schema version migration, and `BindToClose` shutdown handling. Includes `scripts/datastore_mock_harness.luau`.
- **`roblox-unit-test`**: Generates and executes automated Luau test suites inside Studio using lightweight assertion harnesses. Includes `scripts/test_harness.luau`.
- **`roblox-perf-profiling`**: High-precision `os.clock()` benchmarking, spatial query performance profiling, and memory auditing. Includes `scripts/microbenchmark.luau`.
- **`roblox-ui-builder`**: Code-first responsive `ScreenGui` generation with smooth tween animations and modern glassmorphic styling. Includes `scripts/modern_hud_template.luau`.
- **`roblox-scene-inspector`**: 3D world audits, unanchored part detection, collision checks, and StreamingEnabled spawn audits. Includes `scripts/audit_physics.luau`.


---

## 🧪 Step-by-Step Manual Testing Guide

Follow these simple manual steps to test each feature in your own workspace:

### 🔬 Test 1: Live Sync
1. Open your project folder in your IDE (e.g., `Documents\RobloxProjects\DefaultProject\src\ServerScriptService\GameManager.server.luau`).
2. Add a new line: `print("Test sync " .. os.time())` and press `Ctrl+S`.
3. Switch to Studio: observe that `ServerScriptService.GameManager` in Studio instantly contains the new line without needing to refresh.

---

### 🔬 Test 2: File Rename & GUID Preservation (Feature 3)
1. In your IDE, create a file: `src/ReplicatedStorage/ModuleA.luau` with:
   ```lua
   local ModuleA = { version = 1 }
   return ModuleA
   ```
2. Save it. Notice `src/ReplicatedStorage/ModuleA.luau.meta.json` is created with a `guid`.
3. In Studio, check `ReplicatedStorage.ModuleA`: it has attribute `BloxSyncGUID` (and `BridgeGUID`).
4. In your IDE, rename `ModuleA.luau` to `ModuleRenamed.luau`.
5. Switch to Studio:
   - Notice the script was renamed to `ModuleRenamed` **without being destroyed**.
   - Notice its GUID attributes are preserved.

---

### 🔬 Test 3: Conflict Detection & Resolution (Feature 2)
1. Open `GameManager.server.luau` in your IDE.
2. Make a change: `local x = "IDE Version"` and save (`Ctrl+S`).
3. Within 5 seconds, switch to Studio, open the script in Studio, change it to: `local x = "Studio Version"`, and trigger a sync or write.
4. Observe the Desktop App:
   - A warning notification appears: `⚠️ Sync Conflict Detected`.
   - The conflict modal opens showing your IDE text on the left and Studio text on the right.
5. Click **✅ Keep IDE Version**: Studio receives the IDE version.
6. Alternatively, test **🎮 Use Studio Version**: local disk file updates to the Studio text.

---

### 🔬 Test 4: .rbxlx Place File Export (Feature 1)
1. In the Desktop App, click **📦 Export .rbxlx** in the top header.
2. A `.rbxlx` file downloads to your machine.
3. Open Roblox Studio → **File** → **Open from File...** and select the downloaded file.
4. Confirm:
   - The place opens cleanly.
   - All scripts exist under their respective services (`ReplicatedStorage`, `ServerScriptService`, etc.).
   - Nested subfolders are preserved.

---

### 🔬 Test 5: Wally Package Manager (Feature 4)
1. In your project directory, create a `wally.toml` file with:
   ```toml
   [package]
   name = "my-game"
   version = "0.1.0"
   registry = "https://github.com/UpliftGames/wally-index"
   realm = "shared"

   [dependencies]
   Signal = "sleitnick/signal@2.0.1"
   ```
2. In the Desktop App, observe that **Wally Install** is enabled.
3. Click **📦 Wally Install**.
4. Check the Console log: Wally runs `wally install`, generates the `Packages/` folder, and the new packages appear in Studio.

---

### 🔬 Test 6: TypeScript Compile (Feature 7)
1. In a project with a `tsconfig.json` and a `.ts` file inside `src/`:
2. Observe the Desktop App stats bar: TypeScript shows **Active (rbxtsc)**.
3. Click **⚡ Compile TS** or edit a `.ts` file.
4. Observe the button shows compiling state, then displays **Build OK** in green.

---

### 🔬 Test 7: Luau Runner & Studio Logs
1. Switch to the **Luau Runner** tab in the Desktop App.
2. Enter:
   ```lua
   print("Hello from Desktop Runner!")
   return workspace.DistributedGameTime
   ```
3. Click **▶ Run in Studio**.
4. Look at the Runner result output: displays `OK`, execution time, and output value.
5. Switch to the **Console** tab: confirm `"Hello from Desktop Runner!"` was streamed from Studio's LogService.

---

## 📁 Project Structure & Rojo Mappings

Standard directory layout for synced projects:

```
Documents\RobloxProjects\<ProjectName>\
├── default.project.json           # Rojo project configuration
├── .robloxignore                  # Ignored files & patterns
├── .cursorrules                   # Cursor / Antigravity AI instructions
├── README.md                      # Project description
├── wally.toml                     # (Optional) Wally dependencies
├── tsconfig.json                  # (Optional) TypeScript configuration
└── src/
    ├── ReplicatedStorage/         # Synced to game.ReplicatedStorage
    │   ├── SharedModule.luau
    │   └── SharedModule.luau.meta.json   # GUID tracking sidecar
    ├── ServerScriptService/       # Synced to game.ServerScriptService
    │   └── GameServer.server.luau
    └── StarterPlayer/
        └── StarterPlayerScripts/  # Synced to StarterPlayer.StarterPlayerScripts
            └── ClientMain.client.luau
```

### File Extension Mapping Table:
| File Extension | Studio Instance Created |
|----------------|-------------------------|
| `*.server.luau` / `*.server.lua` | `Script` (RunContext: Server) |
| `*.client.luau` / `*.client.lua` | `LocalScript` (RunContext: Client) |
| `*.luau` / `*.lua` | `ModuleScript` |
| `init.server.luau` | `Script` named after folder |
| `init.client.luau` | `LocalScript` named after folder |
| `init.luau` | `ModuleScript` named after folder |

---

## 🔧 Troubleshooting & FAQ

#### Q: Where is the Desktop App running?
Open `http://localhost:7777` in your browser, or launch the Electron app with `npm start` in `blox-sync-app` (or launch `BloxSyncApp.exe`).

#### Q: Studio says "Connection failed" or "Offline"
1. Verify `Allow HTTP Requests` is enabled in Studio (**Game Settings → Security**).
2. Check that the Blox Sync app/server is running on port `7777`.
3. Check that Windows Firewall isn't blocking port `7777`.

#### Q: Where are `.meta.json` files generated?
`.meta.json` files are automatically generated alongside your scripts in `src/`. They store persistent GUIDs so that file renames don't delete and recreate scripts in Roblox Studio. You can commit these `.meta.json` files to Git.

#### Q: Can I use Antigravity / Cursor / VS Code simultaneously?
Yes! Blox Sync is editor-agnostic. Any editor that modifies files in your project directory will trigger real-time sync with Roblox Studio.

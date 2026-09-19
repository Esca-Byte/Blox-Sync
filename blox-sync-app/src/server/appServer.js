const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
const os = require('os');
const fs = require('fs-extra');
const chokidar = require('chokidar');
const { exec, execSync } = require('child_process');
const crypto = require('crypto');
const { ensureProjectGuidanceFiles } = require('./utils/projectGuidance');
const { extractAndInstallMcp, configureIDEs, getMcpStatus } = require('./utils/mcpInstaller');

// ── Utility: content hash for rename detection ───────────────────────────────
function hashContent(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

// ── Utility: escape XML special chars for .rbxlx generation ─────────────────
function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getDefaultDocumentsDir() {
  const home = process.env.USERPROFILE || os.homedir();
  if (process.platform === 'win32') {
    if (process.env.ONEDRIVE && fs.existsSync(path.join(process.env.ONEDRIVE, 'Documents'))) {
      return path.join(process.env.ONEDRIVE, 'Documents');
    }
    const oneDriveDocs = path.join(home, 'OneDrive', 'Documents');
    if (fs.existsSync(oneDriveDocs)) {
      return oneDriveDocs;
    }
  }
  return path.join(home, 'Documents');
}

function getDefaultProjectsDir() {
  return path.join(getDefaultDocumentsDir(), 'RobloxProjects');
}

class RojoParser {
  constructor(projectDir) {
    this.projectDir = projectDir;
  }

  async parseProjectConfig() {
    const configPath = path.join(this.projectDir, 'default.project.json');
    if (await fs.pathExists(configPath)) {
      try {
        const json = await fs.readJson(configPath);
        return { raw: json, mappings: this.extractMappings(json) };
      } catch (err) {
        console.error('[RojoParser] Error reading default.project.json:', err.message);
      }
    }

    return {
      raw: {},
      mappings: [
        { pathPrefix: 'src/ReplicatedStorage', robloxService: 'ReplicatedStorage' },
        { pathPrefix: 'src/ServerScriptService', robloxService: 'ServerScriptService' },
        { pathPrefix: 'src/ServerStorage', robloxService: 'ServerStorage' },
        { pathPrefix: 'src/StarterGui', robloxService: 'StarterGui' },
        { pathPrefix: 'src/StarterPack', robloxService: 'StarterPack' },
        { pathPrefix: 'src/Workspace', robloxService: 'Workspace' },
        { pathPrefix: 'src/StarterPlayer/StarterPlayerScripts', robloxService: 'StarterPlayer.StarterPlayerScripts' },
        { pathPrefix: 'src/StarterPlayer/StarterCharacterScripts', robloxService: 'StarterPlayer.StarterCharacterScripts' }
      ]
    };
  }

  extractMappings(json) {
    const mappings = [];
    if (!json || !json.tree) return mappings;

    const traverse = (node, currentRobloxPath) => {
      if (typeof node !== 'object' || node === null) return;
      if (node['$path']) {
        mappings.push({ pathPrefix: node['$path'].replace(/\\/g, '/'), robloxService: currentRobloxPath });
      }
      for (const [key, val] of Object.entries(node)) {
        if (key.startsWith('$')) continue;
        const nextPath = currentRobloxPath ? `${currentRobloxPath}.${key}` : key;
        traverse(val, nextPath);
      }
    };

    traverse(json.tree, '');
    return mappings;
  }

  getScriptInfo(relPath, mappings) {
    const normalizedRel = relPath.replace(/\\/g, '/');
    let scriptType = 'ModuleScript';
    let cleanRelPath = normalizedRel;

    const filename = path.basename(normalizedRel);
    if (/^init\.server\.lua[u]?$/.test(filename)) {
      scriptType = 'Script';
      cleanRelPath = path.dirname(normalizedRel);
    } else if (/^init\.client\.lua[u]?$/.test(filename)) {
      scriptType = 'LocalScript';
      cleanRelPath = path.dirname(normalizedRel);
    } else if (/^init\.lua[u]?$/.test(filename)) {
      scriptType = 'ModuleScript';
      cleanRelPath = path.dirname(normalizedRel);
    } else if (/\.server\.lua[u]?$/.test(normalizedRel)) {
      scriptType = 'Script';
      cleanRelPath = normalizedRel.replace(/\.server\.lua[u]?$/, '');
    } else if (/\.client\.lua[u]?$/.test(normalizedRel)) {
      scriptType = 'LocalScript';
      cleanRelPath = normalizedRel.replace(/\.client\.lua[u]?$/, '');
    } else if (/\.lua[u]?$/.test(normalizedRel)) {
      scriptType = 'ModuleScript';
      cleanRelPath = normalizedRel.replace(/\.lua[u]?$/, '');
    } else {
      return null; // Not a script
    }

    let fullRobloxPath = 'ReplicatedStorage';
    let matchedPrefixLength = 0;

    for (const map of mappings) {
      if (cleanRelPath.startsWith(map.pathPrefix)) {
        if (map.pathPrefix.length > matchedPrefixLength) {
          matchedPrefixLength = map.pathPrefix.length;
          const subPath = cleanRelPath.slice(map.pathPrefix.length).replace(/^\//, '');
          fullRobloxPath = subPath ? `${map.robloxService}.${subPath.replace(/\//g, '.')}` : map.robloxService;
        }
      }
    }

    const pathParts = fullRobloxPath.split('.');
    const scriptName = pathParts[pathParts.length - 1];
    let robloxHierarchy = pathParts.slice(0, -1).join('.');
    if (!robloxHierarchy && pathParts.length === 1) {
      robloxHierarchy = pathParts[0];
    }

    return {
      scriptName,
      scriptType,
      fullRobloxPath,
      robloxHierarchy,
      relPath: normalizedRel
    };
  }
}

class BloxSyncAppServer {
  constructor(options = {}) {
    this.port = options.port || 7777;
    this.baseProjectsDir = options.baseProjectsDir || getDefaultProjectsDir();
    this.activeProjectName = options.activeProjectName || 'DefaultProject';
    this.activeProjectPath = path.join(this.baseProjectsDir, this.activeProjectName);
    this.startTime = Date.now();

    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });

    this.rojoParser = new RojoParser(this.activeProjectPath);
    this.projectConfig = null;
    this.watcher = null;

    this.trackedFiles = new Map(); // relPath -> data
    this.changeHistory = [];
    this.writeGuard = new Map();
    this.logs = [];
    this.lastStudioHeartbeat = 0;
    this.studioConnected = false;

    // ── Path B: Luau Execution Engine ──────────────────────────────────────
    this.executeQueue = [];      // jobs waiting for Studio to pick up
    this.executeResults = [];    // completed results from Studio
    this.executeResultMap = {};  // jobId -> result (for polling)
    this.nextJobId = 1;

    // ── Path B: DataModel Tree ─────────────────────────────────────────────
    this.studioTree = null;      // latest tree snapshot from Studio
    this.studioTreeTimestamp = 0;

    // ── Path B: Studio LogService Stream ──────────────────────────────────
    this.studioConsoleLogs = []; // buffered Studio console entries

    // ── Feature 3: GUID / .meta.json tracking ────────────────────────────
    this.contentHashMap = new Map(); // hash -> relPath, for rename detection
    this.renameCandidates = new Map(); // hash -> { relPath, data, timer }

    // ── Feature 7: TypeScript / roblox-ts ────────────────────────────────
    this.isTypeScriptProject = false;
    this.tsCompiling = false;

    // ── Feature 2: Conflict tracking ─────────────────────────────────────
    this.pendingConflicts = new Map(); // relPath -> { ideContent, studioContent, scriptInfo }

    this.initExpress();
    this.initWebSocket();
  }

  // ─── Persistent Config ───────────────────────────────────────────────────
  get configFilePath() {
    return path.join(this.baseProjectsDir, 'blox-sync-config.json');
  }

  get legacyConfigFilePath() {
    return path.join(this.baseProjectsDir, 'bridge-config.json');
  }

  async loadPersistentConfig() {
    try {
      if (await fs.pathExists(this.configFilePath)) {
        const cfg = await fs.readJson(this.configFilePath);
        if (cfg.lastActiveProject) {
          return cfg;
        }
      }
      if (await fs.pathExists(this.legacyConfigFilePath)) {
        const cfg = await fs.readJson(this.legacyConfigFilePath);
        if (cfg.lastActiveProject) {
          return cfg;
        }
      }
    } catch (e) {
      console.warn('[Config] Could not read config:', e.message);
    }
    return {};
  }

  async savePersistentConfig(data = {}) {
    try {
      let existing = {};
      if (await fs.pathExists(this.configFilePath)) {
        existing = await fs.readJson(this.configFilePath).catch(() => ({}));
      } else if (await fs.pathExists(this.legacyConfigFilePath)) {
        existing = await fs.readJson(this.legacyConfigFilePath).catch(() => ({}));
      }
      await fs.writeJson(this.configFilePath, { ...existing, ...data }, { spaces: 2 });
    } catch (e) {
      console.warn('[Config] Could not write blox-sync-config.json:', e.message);
    }
  }

  log(message, type = 'info') {
    const entry = {
      timestamp: Date.now(),
      message,
      type
    };
    this.logs.push(entry);
    if (this.logs.length > 300) this.logs.shift();

    console.log(`[${type.toUpperCase()}] ${message}`);
    this.broadcast({ event: 'log_entry', entry });
  }

  async ensurePluginInstalled() {
    try {
      const localAppData = process.env.LOCALAPPDATA || path.join(require('os').homedir(), 'AppData', 'Local');
      const pluginsDir = path.join(localAppData, 'Roblox', 'Plugins');
      const pluginTargetPath = path.join(pluginsDir, 'BloxSync.lua');
      const pluginSourcePath = path.join(__dirname, 'BloxSync.lua');

      // Clean up legacy RobloxBridge.lua if present to prevent duplicate plugins in Studio
      const legacyPluginPath = path.join(pluginsDir, 'RobloxBridge.lua');
      if (await fs.pathExists(legacyPluginPath)) {
        await fs.remove(legacyPluginPath).catch(() => {});
      }

      if (await fs.pathExists(pluginSourcePath)) {
        await fs.ensureDir(pluginsDir);
        await fs.copy(pluginSourcePath, pluginTargetPath, { overwrite: true });
        this.log(`Roblox Studio Plugin auto-installed/updated at: ${pluginTargetPath}`, 'info');
        return { success: true, path: pluginTargetPath };
      }
    } catch (err) {
      this.log(`Plugin auto-install skipped: ${err.message}`, 'info');
      return { success: false, error: err.message };
    }
  }

  // ── MCP Install (triggered by user via dashboard) ────────────────────────
  async ensureMcpInstalled() {
    try {
      const mcpIndexPath = await extractAndInstallMcp(
        (progress) => this.broadcast({ event: 'mcp_install_progress', data: progress }),
        (msg, lvl) => this.log(msg, lvl || 'info')
      );
      if (!mcpIndexPath) {
        this.broadcast({ event: 'mcp_install_complete', data: { success: false, configuredIDEs: [] } });
        return;
      }

      const configuredIDEs = await configureIDEs(mcpIndexPath, (msg, lvl) => this.log(msg, lvl || 'info'));
      this.broadcast({ event: 'mcp_install_complete', data: { success: true, mcpPath: mcpIndexPath, configuredIDEs } });

      if (configuredIDEs.length > 0) {
        this.log(`MCP configured for: ${configuredIDEs.join(', ')}. Restart your IDE to activate.`, 'info');
      }
    } catch (err) {
      this.log(`MCP install error: ${err.message}`, 'warn');
      this.broadcast({ event: 'mcp_install_complete', data: { success: false, error: err.message, configuredIDEs: [] } });
    }
  }

  async start() {
    await fs.ensureDir(this.baseProjectsDir);
    await this.ensurePluginInstalled();


    const cfg = await this.loadPersistentConfig();

    const entries = await fs.readdir(this.baseProjectsDir, { withFileTypes: true });
    const existing = entries.filter(e => e.isDirectory()).map(e => e.name);

    if (cfg.lastActiveProject && existing.includes(cfg.lastActiveProject)) {
      this.activeProjectName = cfg.lastActiveProject;
    } else if (existing.length > 0 && !existing.includes(this.activeProjectName)) {
      this.activeProjectName = existing[0];
    }
    this.activeProjectPath = path.join(this.baseProjectsDir, this.activeProjectName);

    await this.ensureActiveProjectExists();
    await this.loadProject();

    return new Promise((resolve) => {
      this.server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`[INFO] Port ${this.port} is already in use. Connecting to active server instance.`);
          resolve();
        } else {
          console.error('[ERROR] Server error:', err);
          resolve();
        }
      });

      this.server.listen(this.port, () => {
        this.log(`Blox Sync Server running on http://localhost:${this.port}`, 'info');
        this.log(`Projects Directory: ${this.baseProjectsDir}`, 'info');
        this.log(`Active Project: ${this.activeProjectName}`, 'info');
        resolve();
      });
    });
  }

  async ensureActiveProjectExists() {
    if (!await fs.pathExists(this.activeProjectPath)) {
      await this.createProjectTemplate(this.activeProjectName);
    }
  }

  async createProjectTemplate(projectName, template = 'standard') {
    if (template === 'knit') {
      return this.createKnitProjectTemplate(projectName);
    }
    const projDir = path.join(this.baseProjectsDir, projectName);
    await fs.ensureDir(projDir);

    const defaultProjectJson = {
      name: projectName,
      tree: {
        "$className": "DataModel",
        "ReplicatedStorage": {
          "$path": "src/ReplicatedStorage"
        },
        "ServerScriptService": {
          "$path": "src/ServerScriptService"
        },
        "ServerStorage": {
          "$path": "src/ServerStorage"
        },
        "StarterGui": {
          "$path": "src/StarterGui"
        },
        "StarterPack": {
          "$path": "src/StarterPack"
        },
        "Workspace": {
          "$path": "src/Workspace"
        },
        "StarterPlayer": {
          "StarterPlayerScripts": {
            "$path": "src/StarterPlayer/StarterPlayerScripts"
          },
          "StarterCharacterScripts": {
            "$path": "src/StarterPlayer/StarterCharacterScripts"
          }
        }
      }
    };

    await fs.writeJson(path.join(projDir, 'default.project.json'), defaultProjectJson, { spaces: 2 });
    
    // Create default files in all primary Roblox services
    await fs.outputFile(
      path.join(projDir, 'src', 'ReplicatedStorage', 'SharedModule.luau'),
      `local SharedModule = {}\n\nfunction SharedModule.init()\n    print("SharedModule initialized from external IDE!")\nend\n\nreturn SharedModule\n`
    );
    await fs.outputFile(
      path.join(projDir, 'src', 'ServerScriptService', 'GameManager.server.luau'),
      `local ReplicatedStorage = game:GetService("ReplicatedStorage")\nlocal SharedModule = require(ReplicatedStorage:WaitForChild("SharedModule"))\n\nprint("Server script running!")\nSharedModule.init()\n`
    );
    await fs.outputFile(
      path.join(projDir, 'src', 'ServerStorage', 'ServerStorageModule.luau'),
      `local ServerStorageModule = {}\n\nfunction ServerStorageModule.run()\n    print("ServerStorage Module loaded.")\nend\n\nreturn ServerStorageModule\n`
    );
    await fs.outputFile(
      path.join(projDir, 'src', 'StarterGui', 'MainUI.client.luau'),
      `local Players = game:GetService("Players")\nlocal localPlayer = Players.LocalPlayer\n\nprint("MainUI client script initialized for:", localPlayer.Name)\n`
    );
    await fs.outputFile(
      path.join(projDir, 'src', 'StarterPack', 'ItemScript.client.luau'),
      `print("StarterPack item script initialized!")\n`
    );
    await fs.outputFile(
      path.join(projDir, 'src', 'Workspace', 'WorkspaceController.server.luau'),
      `print("Workspace server controller running!")\n`
    );
    await fs.outputFile(
      path.join(projDir, 'src', 'StarterPlayer', 'StarterPlayerScripts', 'ClientMain.client.luau'),
      `print("Client main script running!")\n`
    );
    await fs.outputFile(
      path.join(projDir, 'src', 'StarterPlayer', 'StarterCharacterScripts', 'CharacterController.client.luau'),
      `print("Character controller script initialized!")\n`
    );
    await fs.outputFile(
      path.join(projDir, '.robloxignore'),
      `*.tmp\nnode_modules/\n.git/\n`
    );

    const readmeContent = `# 🎮 ${projectName} — Roblox Studio IDE Project

This Roblox project is configured for real-time synchronization with **Roblox Studio** using **Blox Sync**.

---

## 🤖 IMPORTANT CONTEXT FOR AI CODING AGENTS (Cursor, Copilot, Antigravity, ChatGPT, Claude)

> ⚠️ **CRITICAL WARNING FOR AI AGENTS**:
> In Visual Studio Code / IDE file systems, **directories are text folders**.
> When synced to Roblox Studio, **directories sync as standard \`Folder\` instances** — NOT as \`ScreenGui\`, \`SurfaceGui\`, or \`Model\` instances!
> 
> If asked to create a **Shop GUI**, **Inventory GUI**, **Music Player**, **Item**, or **Network Event**, follow the rules below.

---

### 🎨 1. Creating UI Systems (\`ScreenGui\`, \`SurfaceGui\`, \`BillboardGui\`)

#### ❌ Common AI Mistake:
Creating a directory named \`src/StarterGui/ShopGui/\` expecting Roblox to turn it into a \`ScreenGui\`. In Roblox Studio, that directory syncs as a **Folder** named \`ShopGui\`, which will NOT render on the player's screen!

#### ✅ Correct AI Patterns for Roblox UI:
1. **Dynamic Programmatic UI Creation (Recommended for Code-Driven UI)**:
   Write a \`.client.luau\` script inside \`src/StarterGui/\` or \`src/StarterPlayer/StarterPlayerScripts/\` that constructs UI elements programmatically using \`Instance.new()\`:

   \`\`\`luau
   -- File: src/StarterGui/ShopUI.client.luau
   local Players = game:GetService("Players")
   local player = Players.LocalPlayer
   local playerGui = player:WaitForChild("PlayerGui")

   -- 1. Create ScreenGui container
   local screenGui = Instance.new("ScreenGui")
   screenGui.Name = "ShopGui"
   screenGui.ResetOnSpawn = false
   screenGui.Parent = playerGui

   -- 2. Create Main Frame
   local mainFrame = Instance.new("Frame")
   mainFrame.Name = "MainFrame"
   mainFrame.Size = UDim2.new(0, 420, 0, 320)
   mainFrame.Position = UDim2.new(0.5, -210, 0.5, -160)
   mainFrame.BackgroundColor3 = Color3.fromRGB(30, 30, 40)
   mainFrame.BorderSizePixel = 0
   mainFrame.Parent = screenGui

   -- 3. Create Title Label
   local title = Instance.new("TextLabel")
   title.Name = "TitleLabel"
   title.Text = "ITEM SHOP"
   title.Size = UDim2.new(1, 0, 0, 40)
   title.TextColor3 = Color3.fromRGB(255, 255, 255)
   title.TextSize = 20
   title.Font = Enum.Font.SourceSansBold
   title.BackgroundTransparency = 1
   title.Parent = mainFrame
   \`\`\`

2. **Referencing Pre-built Studio UI**:
   If UI elements were created visually in Roblox Studio, reference them using \`:WaitForChild()\`:
   \`\`\`luau
   local player = game:GetService("Players").LocalPlayer
   local playerGui = player:WaitForChild("PlayerGui")
   local screenGui = playerGui:WaitForChild("ShopGui") -- Exists in Studio
   local mainFrame = screenGui:WaitForChild("MainFrame")
   \`\`\`

3. **SurfaceGui & BillboardGui**:
   - \`SurfaceGui\`: Attach to a \`Part\` in \`Workspace\` or parent to \`StarterGui\` with \`Adornee\` set to a \`Part\`.
   - \`BillboardGui\`: Parent to a 3D \`Part\` or \`Character\` head.

---

### 🎵 2. Audio, Sound Effects & Music (\`Sound\`)

- Audio requires a \`Sound\` instance with a valid \`SoundId\` (e.g. \`rbxassetid://1848354536\`).
- **Playing Sound / Music via Script**:
  \`\`\`luau
  local SoundService = game:GetService("SoundService")

  local bgMusic = Instance.new("Sound")
  bgMusic.Name = "BackgroundMusic"
  bgMusic.SoundId = "rbxassetid://1848354536"
  bgMusic.Volume = 0.5
  bgMusic.Looped = true
  bgMusic.Parent = SoundService
  bgMusic:Play()
  \`\`\`

---

### 🎒 3. Tools, Items & Inventory (\`Tool\`, \`StarterPack\`)

- **Starter Items**: Client/Server scripts or tools placed under \`src/StarterPack/\`.
- **Purchasing & Inventories**:
  - Store item templates (\`Tool\` or \`Model\`) in \`ServerStorage\` or \`ReplicatedStorage\`.
  - On purchase, clone the tool on the server and parent to \`player.Backpack\`:
    \`\`\`luau
    -- ServerScriptService/ShopServer.server.luau
    local ServerStorage = game:GetService("ServerStorage")
    local swordTemplate = ServerStorage:WaitForChild("Sword")
    local newSword = swordTemplate:Clone()
    newSword.Parent = player.Backpack
    \`\`\`

---

### 📡 4. Client-Server Communication (\`RemoteEvent\`, \`RemoteFunction\`)

- Place network communications inside \`src/ReplicatedStorage/\`.
- Create events dynamically if they do not exist yet:
  \`\`\`luau
  local ReplicatedStorage = game:GetService("ReplicatedStorage")

  local buyItemEvent = ReplicatedStorage:FindFirstChild("BuyItemEvent")
  if not buyItemEvent then
      buyItemEvent = Instance.new("RemoteEvent")
      buyItemEvent.Name = "BuyItemEvent"
      buyItemEvent.Parent = ReplicatedStorage
  end
  \`\`\`

---

### 📁 5. Directory Structure & Script Suffix Conventions

| File Suffix | Roblox Instance Type | Location | Execution Context |
| :--- | :--- | :--- | :--- |
| \`*.server.luau\` | \`Script\` | \`src/ServerScriptService/\`, \`src/Workspace/\` | Server |
| \`*.client.luau\` | \`LocalScript\` | \`src/StarterGui/\`, \`src/StarterPlayerScripts/\` | Client |
| \`*.luau\` / \`*.lua\` | \`ModuleScript\` | \`src/ReplicatedStorage/\`, \`src/ServerStorage/\` | Shared / Required |

---

## 📁 Project Layout

\`\`\`
${projectName}/
├── README.md               <-- AI Agent & Developer Guide
├── .cursorrules            <-- IDE AI Context Configuration
├── default.project.json    <-- Rojo Sync Configuration
├── .robloxignore           <-- Files excluded from Studio sync
└── src/
    ├── ReplicatedStorage/   <-- Shared ModuleScripts & RemoteEvents
    ├── ServerScriptService/ <-- Server logic & game management
    ├── ServerStorage/       <-- Server-side asset templates
    ├── StarterGui/          <-- Client UI logic & ScreenGuis
    ├── StarterPack/         <-- Default tools & equipment
    ├── StarterPlayer/       <-- Client player & character controllers
    └── Workspace/           <-- 3D World objects & server scripts
\`\`\`
`;

    const cursorRulesContent = `# Roblox Studio Project - AI Coding Agent Rules

You are working in a Roblox project managed by Blox Sync.

## KEY RULES FOR ROBLOX CODE GENERATION:

1. **Directories vs Roblox Instances**:
   - Folders on disk map to \`Folder\` instances in Roblox Studio.
   - Folders under \`src/StarterGui/\` do NOT automatically become \`ScreenGui\` instances.
   - To build UI (Shop GUI, HUD, Menus), construct \`ScreenGui\`, \`Frame\`, \`TextButton\`, \`TextLabel\`, \`ImageLabel\`, etc., dynamically using \`Instance.new("ScreenGui")\` inside a \`.client.luau\` script, OR reference pre-existing Studio UI elements using \`player.PlayerGui:WaitForChild("GuiName")\`.

2. **File Suffix Conventions**:
   - \`.server.luau\` -> \`Script\` (Server-side, runs in ServerScriptService/Workspace)
   - \`.client.luau\` -> \`LocalScript\` (Client-side, runs in StarterGui/StarterPlayerScripts)
   - \`.luau\` / \`.lua\` -> \`ModuleScript\` (Reusable logic, required by scripts)

3. **Audio & Sound (\`Sound\`)**:
   - Instantiate \`Sound\` using \`Instance.new("Sound")\`, set \`SoundId = "rbxassetid://..."\`, parent to \`SoundService\` or target \`Part\`, and call \`:Play()\`.

4. **Items & Inventory (\`Tool\`)**:
   - Inventory items / Tools should be cloned on the server and parented to \`player.Backpack\` or \`player.Character\`.

5. **Networking (\`RemoteEvent\` / \`RemoteFunction\`)**:
   - Always place client-server communications in \`ReplicatedStorage\`.
   - Never perform money, inventory, or stat changes on the client. Validate all purchases on the server via \`RemoteEvent.OnServerEvent\`.
`;

    const usageContent = `# 📖 ${projectName} — Project Usage & AI Guide

This project is synchronized with **Roblox Studio** using **Blox Sync**.

---

## ⚡ Quick Start & Workflow

1. **Roblox Studio Setup**:
   - Open your place in Roblox Studio.
   - Go to **Game Settings → Security** and turn ON **Allow HTTP Requests**.
   - Open **Plugins → Blox Sync** and click **Connect to Blox Sync Server**.

2. **Writing Code**:
   - Write Luau code in your IDE (VS Code, Cursor, Antigravity, etc.).
   - Saving a file (\`Ctrl+S\`) automatically syncs changes to Roblox Studio in real time.

---

## 🤖 Guide for IDE AI Coding Assistants

> ⚠️ **CRITICAL AI WARNING**:
> Disk directories map to **Folder** instances in Roblox. Creating \`src/StarterGui/ShopGui/\` directory will NOT create a \`ScreenGui\` visual element!

### 🎨 Creating Shop GUIs & Interfaces
Construct UI programmatically inside a \`.client.luau\` script:

\`\`\`luau
-- File: src/StarterGui/ShopUI.client.luau
local Players = game:GetService("Players")
local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

local screenGui = Instance.new("ScreenGui")
screenGui.Name = "ShopGui"
screenGui.ResetOnSpawn = false
screenGui.Parent = playerGui

local mainFrame = Instance.new("Frame")
mainFrame.Name = "MainFrame"
mainFrame.Size = UDim2.new(0, 420, 0, 320)
mainFrame.Position = UDim2.new(0.5, -210, 0.5, -160)
mainFrame.BackgroundColor3 = Color3.fromRGB(30, 30, 40)
mainFrame.Parent = screenGui
\`\`\`

### 🎵 Music & Audio (\`Sound\`)
\`\`\`luau
local SoundService = game:GetService("SoundService")
local sound = Instance.new("Sound")
sound.Name = "BGM"
sound.SoundId = "rbxassetid://1848354536"
sound.Looped = true
sound.Parent = SoundService
sound:Play()
\`\`\`

### 🎒 Items, Inventory & Tools
- Store template tools in \`ServerStorage\` or \`ReplicatedStorage\`.
- Clone to \`player.Backpack\` on server when purchased.

---

## 📁 File Suffix Rules
- \`*.server.luau\` -> Server \`Script\`
- \`*.client.luau\` -> Client \`LocalScript\`
- \`*.luau\` -> \`ModuleScript\`
`;

    await ensureProjectGuidanceFiles(projDir, projectName, true);

    this.log(`Created project template '${projectName}' with README.md, USAGE.md & .cursorrules at ${projDir}`, 'info');
    return projDir;
  }

  async ensureProjectGuidanceFiles(projDir, projectName) {
    const isKnit = (await fs.pathExists(path.join(projDir, 'src', 'ReplicatedStorage', 'ClientSource'))) ||
                   (await fs.pathExists(path.join(projDir, 'src', 'ServerScriptService', 'ServerSource')));
    await ensureProjectGuidanceFiles(projDir, projectName, true, isKnit);
  }

  // ─── Knit / SuperbulletAI Framework Template ────────────────────────────
  async createKnitProjectTemplate(projectName) {
    const projDir = path.join(this.baseProjectsDir, projectName);
    await fs.ensureDir(projDir);

    // Knit-aware Rojo project config
    const defaultProjectJson = {
      name: projectName,
      tree: {
        '$className': 'DataModel',
        ReplicatedStorage: {
          ClientSource: { '$path': 'src/ReplicatedStorage/ClientSource' },
          SharedSource:  { '$path': 'src/ReplicatedStorage/SharedSource' }
        },
        ServerScriptService: {
          ServerSource: { '$path': 'src/ServerScriptService/ServerSource' }
        }
      }
    };
    await fs.writeJson(path.join(projDir, 'default.project.json'), defaultProjectJson, { spaces: 2 });

    // ── SharedSource: ProfileTemplate ──
    await fs.outputFile(
      path.join(projDir, 'src', 'ReplicatedStorage', 'SharedSource', 'Datas', 'ProfileTemplate.lua'),
      `-- ProfileTemplate.lua
-- Define the default data structure for each player here.
-- ProfileService uses this as the schema for new players.
-- The Reconcile() method fills missing fields from here into existing profiles.

local ProfileTemplate = {
    Coins = 0,
    Level = 1,
    Experience = 0,
    Inventory = {},
    Settings = {
        MusicVolume = 1,
        SFXVolume = 1,
    },
    Stats = {
        TotalPlayTime = 0,
        GamesPlayed = 0,
    },
}

return ProfileTemplate
`
    );

    // ── ServerSource: ProfileService (Knit Service + ProfileStore) ──
    await fs.outputFile(
      path.join(projDir, 'src', 'ServerScriptService', 'ServerSource', 'Server', 'ProfileService.lua'),
      `-- ProfileService.lua
-- Knit Service that manages player data sessions.
-- Uses ProfileStore for session locking and auto-saving.
-- Pattern inspired by SuperbulletFrameworkV1-Knit.

local Knit = require(game:GetService("ReplicatedStorage").Packages.Knit)
local Signal = require(game:GetService("ReplicatedStorage").Packages.Signal)
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")

local ProfileTemplate = require(ReplicatedStorage.SharedSource.Datas.ProfileTemplate)

local ProfileService = Knit.CreateService {
    Name = "ProfileService",
    Profiles = {},
    -- Server-side signal: fires when a player's data changes
    UpdateSpecificData = Signal.new(),
    Client = {
        -- Client.GetData: client fires this to receive their data
        GetData = Knit.CreateSignal(),
        -- Client.UpdateSpecificData: server pushes changed values to client
        UpdateSpecificData = Knit.CreateSignal(),
    },
}

function ProfileService:KnitInit()
    -- NOTE: Never yield in KnitInit!
    -- No WaitForChild, no task.wait, no :await() here.
    -- Only assign references and register signals.
end

function ProfileService:KnitStart()
    task.spawn(function()
        -- TODO: Replace with your ProfileStore setup
        -- local ProfileStore = require(ReplicatedStorage.Packages.ProfileStore)
        -- self._store = ProfileStore.New("PlayerData_v1", ProfileTemplate)

        Players.PlayerAdded:Connect(function(player)
            self:_loadProfile(player)
        end)

        Players.PlayerRemoving:Connect(function(player)
            self:_releaseProfile(player)
        end)

        -- Handle existing players (joined before this service started)
        for _, player in ipairs(Players:GetPlayers()) do
            task.spawn(self._loadProfile, self, player)
        end

        -- Listen to client data request
        self.Client.GetData:Connect(function(player)
            local _, data = self:GetProfile(player)
            self.Client.GetData:Fire(player, data)
        end)
    end)
end

function ProfileService:_loadProfile(player)
    -- Placeholder — replace with real ProfileStore session opening
    self.Profiles[player] = { Data = table.clone(ProfileTemplate) }
    print(string.format("[ProfileService] Loaded profile for %s", player.Name))
end

function ProfileService:_releaseProfile(player)
    -- Placeholder — release/save the profile session
    self.Profiles[player] = nil
end

function ProfileService:GetProfile(player)
    local profile = self.Profiles[player]
    if not profile then return nil, nil end
    return profile, profile.Data
end

function ProfileService:WaitUntilProfileLoaded(player)
    while not self.Profiles[player] do
        task.wait(0.1)
    end
end

-- Change data and auto-sync to the client.
-- redirectories: array of nested keys, e.g. {"Stats", "TotalPlayTime"}
function ProfileService:ChangeData(player, redirectories, newValue)
    local _, data = self:GetProfile(player)
    if not data then return end

    local target = data
    for i = 1, #redirectories - 1 do
        target = target[redirectories[i]]
    end
    target[redirectories[#redirectories]] = newValue

    -- Sync change to client
    self.Client.UpdateSpecificData:Fire(player, redirectories, newValue)
    -- Fire server-side signal for other services
    self.UpdateSpecificData:Fire(player, redirectories, newValue)
end

return ProfileService
`
    );

    // ── ServerSource: TemplateService ──
    await fs.outputFile(
      path.join(projDir, 'src', 'ServerScriptService', 'ServerSource', 'Server', 'TemplateService', 'init.lua'),
      `-- TemplateService/init.lua
-- Duplicate this folder to create a new Knit Service.
-- Components are automatically loaded via Instance = script.

local Knit = require(game:GetService("ReplicatedStorage").Packages.Knit)

local TemplateService = Knit.CreateService {
    Name = "TemplateService",
    Instance = script, -- enables automatic Accessor/Mutator component loading
    Client = {},
}

function TemplateService:KnitInit()
    -- No yielding allowed here!
    -- Safe to use: Knit.GetService(), assign references
    -- local OtherService = Knit.GetService("ProfileService")
end

function TemplateService:KnitStart()
    task.spawn(function()
        -- Async work goes here (WaitForChild, events, etc.)
        print("[TemplateService] Started!")
    end)
end

return TemplateService
`
    );

    await fs.outputFile(
      path.join(projDir, 'src', 'ServerScriptService', 'ServerSource', 'Server', 'TemplateService', 'Components', 'Accessor.lua'),
      `-- Accessor.lua (Read Operations)
-- Handle all READ-ONLY operations here.
-- Can communicate with: parent service, other services, Others/ components.
-- CANNOT communicate with Mutator.lua directly — use the parent service.

local Accessor = {}

-- Example read method (self = the parent TemplateService)
function Accessor:GetSomething(player)
    -- return self._data[player]
end

return Accessor
`
    );

    await fs.outputFile(
      path.join(projDir, 'src', 'ServerScriptService', 'ServerSource', 'Server', 'TemplateService', 'Components', 'Mutator.lua'),
      `-- Mutator.lua (Write Operations)
-- Handle all WRITE operations here.
-- Can communicate with: parent service, other services, Others/ components.
-- CANNOT communicate with Accessor.lua directly — use the parent service.

local Mutator = {}

-- Example write method (self = the parent TemplateService)
function Mutator:SetSomething(player, value)
    -- self._data[player] = value
end

return Mutator
`
    );

    await fs.outputFile(
      path.join(projDir, 'src', 'ServerScriptService', 'ServerSource', 'Server', 'TemplateService', 'Components', 'Others', 'Template.lua'),
      `-- Others/Template.lua
-- Additional specialized component.
-- Can communicate with: parent service, Accessor, Mutator (via parent).
-- CANNOT communicate with Other components from different services.

local Template = {}

function Template:doSomething()
    -- Utility logic here
end

return Template
`
    );

    // ── ClientSource: DataController ──
    await fs.outputFile(
      path.join(projDir, 'src', 'ReplicatedStorage', 'ClientSource', 'Client', 'DataController.lua'),
      `-- DataController.lua
-- Knit Controller that manages the client-side copy of player data.
-- Receives updates from ProfileService on the server.

local Knit = require(game:GetService("ReplicatedStorage").Packages.Knit)
local Signal = require(game:GetService("ReplicatedStorage").Packages.Signal)

local DataController = Knit.CreateController { Name = "DataController" }

DataController.Data = nil
DataController.DataLoaded = Signal.new()

function DataController:KnitInit()
    -- No yielding!
end

function DataController:KnitStart()
    task.spawn(function()
        local ProfileService = Knit.GetService("ProfileService")

        -- Request initial data
        local data = ProfileService.GetData:InvokeServer()
        self.Data = data
        self.DataLoaded:Fire(data)

        -- Listen for server-pushed updates
        ProfileService.UpdateSpecificData:Connect(function(redirectories, newValue)
            local target = self.Data
            for i = 1, #redirectories - 1 do
                target = target[redirectories[i]]
            end
            target[redirectories[#redirectories]] = newValue
        end)
    end)
end

function DataController:GetPlayerData()
    return self.Data
end

function DataController:WaitUntilProfileLoaded()
    if self.Data then return self.Data end
    return self.DataLoaded:Wait()
end

return DataController
`
    );

    // ── ClientSource: TemplateController ──
    await fs.outputFile(
      path.join(projDir, 'src', 'ReplicatedStorage', 'ClientSource', 'Client', 'TemplateController', 'init.lua'),
      `-- TemplateController/init.lua
-- Duplicate this folder to create a new Knit Controller.

local Knit = require(game:GetService("ReplicatedStorage").Packages.Knit)

local TemplateController = Knit.CreateController {
    Name = "TemplateController",
    Instance = script, -- enables automatic Accessor/Mutator component loading
}

function TemplateController:KnitInit()
    -- No yielding!
    -- local DataController = Knit.GetController("DataController")
end

function TemplateController:KnitStart()
    task.spawn(function()
        print("[TemplateController] Started!")
    end)
end

return TemplateController
`
    );

    await fs.outputFile(
      path.join(projDir, 'src', 'ReplicatedStorage', 'ClientSource', 'Client', 'TemplateController', 'Components', 'Accessor.lua'),
      `-- Accessor.lua (Client Read Operations)
local Accessor = {}

function Accessor:GetSomething()
    -- return self._cache
end

return Accessor
`
    );

    await fs.outputFile(
      path.join(projDir, 'src', 'ReplicatedStorage', 'ClientSource', 'Client', 'TemplateController', 'Components', 'Mutator.lua'),
      `-- Mutator.lua (Client Write Operations)
local Mutator = {}

function Mutator:SetSomething(value)
    -- self._cache = value
end

return Mutator
`
    );

    await fs.outputFile(path.join(projDir, '.robloxignore'), `*.tmp
node_modules/
.git/
`);

    const knitReadme = `# 🎮 ${projectName} — Knit Framework Project

This project uses the **SuperbulletAI / Knit Framework** architecture for clean, scalable Roblox development.
Synced in real time with Roblox Studio via **Blox Sync**.

---

## 🤖 CRITICAL RULES FOR AI CODING AGENTS

### ❌ NO YIELDING IN :KnitInit()
\`KnitInit\` (and \`KnitStart\` before \`task.spawn\`) must **never yield**:
- No \`WaitForChild()\`, no \`task.wait()\`, no \`:await()\`
- Init only: \`Knit.GetService()\`, \`Knit.GetController()\`, assign references
- Async work goes in \`KnitStart\` wrapped in \`task.spawn()\`

\`\`\`lua
function MyService:KnitStart()
    task.spawn(function()
        local template = ReplicatedStorage:WaitForChild("Template") -- safe here
    end)
end
\`\`\`

---

### 📁 Project Structure

\`\`\`
src/
├── ReplicatedStorage/
│   ├── ClientSource/
│   │   └── Client/              ← All Knit Controllers here
│   │       ├── DataController.lua
│   │       └── TemplateController/
│   │           ├── init.lua
│   │           └── Components/
│   │               ├── Accessor.lua   ← Read-only operations
│   │               ├── Mutator.lua    ← Write operations
│   │               └── Others/        ← Specialized components
│   └── SharedSource/
│       └── Datas/
│           └── ProfileTemplate.lua   ← Player data schema
└── ServerScriptService/
    └── ServerSource/
        └── Server/              ← All Knit Services here
            ├── ProfileService.lua
            └── TemplateService/
                ├── init.lua
                └── Components/
                    ├── Accessor.lua
                    ├── Mutator.lua
                    └── Others/
\`\`\`

---

### 🔀 Accessor / Mutator Rules

| Component | Can Talk To | Cannot Talk To |
|-----------|------------|----------------|
| **Accessor.lua** | Parent service, other services, Others/ | Mutator.lua directly |
| **Mutator.lua** | Parent service, other services, Others/ | Accessor.lua directly |
| **Others/** | Parent service, Accessor, Mutator (via parent) | Other services' Others/ |

---

### 💾 Data / ProfileService

\`\`\`lua
-- Reading data (server)
local ProfileService = Knit.GetService("ProfileService")
local _, data = ProfileService:GetProfile(player)
print(data.Coins)

-- Changing data (server) — auto-syncs to client!
ProfileService:ChangeData(player, {"Coins"}, 100)
ProfileService:ChangeData(player, {"Settings", "MusicVolume"}, 0.5)

-- Reading data (client)
local DataController = Knit.GetController("DataController")
local data = DataController:GetPlayerData()
print(data.Coins)
\`\`\`

---

### 🎨 UI: Directories ≠ ScreenGui
**Directories map to \`Folder\` instances**, not GUI objects.
Build UI programmatically inside \`.client.lua\` scripts:

\`\`\`lua
local screenGui = Instance.new("ScreenGui")
screenGui.Name = "ShopGui"
screenGui.Parent = game:GetService("Players").LocalPlayer:WaitForChild("PlayerGui")
\`\`\`

---

## ⚡ Quick Start
1. Open Roblox Studio → Game Settings → Security → Enable HTTP Requests
2. Open **Plugins → Blox Sync** → Connect
3. Install Knit via [Wally](https://wally.run): \`wally install\`
4. Write code in your IDE → save (Ctrl+S) → syncs instantly!
`;

    await fs.outputFile(path.join(projDir, 'README.md'), knitReadme);

    const knitCursorRules = `# Roblox Knit Framework — AI Coding Agent Rules
# Based on SuperbulletFrameworkV1-Knit architecture

## FRAMEWORK: Knit (by Sleitnick) with SuperbulletAI modifications

## CRITICAL RULES:

1. **NEVER YIELD in :KnitInit()**
   - No WaitForChild(), task.wait(), :await()
   - KnitInit is synchronous only
   - Async work → :KnitStart() with task.spawn()

2. **File Structure**
   - Knit Services → src/ServerScriptService/ServerSource/Server/
   - Knit Controllers → src/ReplicatedStorage/ClientSource/Client/
   - Shared data → src/ReplicatedStorage/SharedSource/Datas/
   - Each Service/Controller folder: init.lua + Components/Accessor.lua + Components/Mutator.lua

3. **Accessor/Mutator Pattern**
   - Accessor.lua = READ-ONLY operations (GetXxx methods)
   - Mutator.lua = WRITE operations (SetXxx, AddXxx methods)
   - Never let Accessor and Mutator talk directly — route through parent service
   - Add Instance = script to the service/controller to auto-load components

4. **Directories vs Roblox Instances**
   - Directories sync as Folder instances, NOT as ScreenGui/Model
   - Build UI with Instance.new() inside .client.lua scripts

5. **File Suffix Conventions**
   - .server.lua → Script (ServerScriptService/Workspace)
   - .client.lua → LocalScript (StarterGui/StarterPlayerScripts)
   - .lua / .luau → ModuleScript (ReplicatedStorage/ServerStorage)

6. **Data Changes**
   - Server changes player data via ProfileService:ChangeData(player, {"Key"}, value)
   - This auto-syncs to client via Client.UpdateSpecificData signal
   - NEVER mutate data directly on the client

7. **Error Logging Pattern**
   - Use clear separators for errors:
     print("━━━━━━━━━━━━━━━━━━━")
     warn("❌ Error in Service: " .. serviceName)
     print("━━━━━━━━━━━━━━━━━━━")
`;

    await fs.outputFile(path.join(projDir, '.cursorrules'), knitCursorRules);

    this.log(`Created Knit framework project '${projectName}' at ${projDir}`, 'info');
    return projDir;
  }

  async loadProject() {
    if (this.watcher) {
      await this.watcher.close();
    }
    this.trackedFiles.clear();
    this.changeHistory = [];
    this.contentHashMap.clear();
    this.renameCandidates.clear();
    this.pendingConflicts.clear();
    this.rojoParser = new RojoParser(this.activeProjectPath);
    this.projectConfig = await this.rojoParser.parseProjectConfig();

    await this.ensureProjectGuidanceFiles(this.activeProjectPath, this.activeProjectName);

    // ── Feature 7: Detect TypeScript project ───────────────────────────────
    const tsConfigPath = path.join(this.activeProjectPath, 'tsconfig.json');
    this.isTypeScriptProject = await fs.pathExists(tsConfigPath);
    if (this.isTypeScriptProject) {
      this.log(`TypeScript project detected (tsconfig.json found)`, 'info');
    }

    this.log(`Loaded project configuration for '${this.activeProjectName}'`, 'info');

    await this.scanInitialFiles();
    this.startWatcher();
  }

  async switchProject(newProjectName) {
    const newPath = path.join(this.baseProjectsDir, newProjectName);
    if (!await fs.pathExists(newPath)) {
      await this.createProjectTemplate(newProjectName);
    }
    this.activeProjectName = newProjectName;
    this.activeProjectPath = newPath;
    await this.loadProject();

    // Persist the last active project so it restores on next launch
    await this.savePersistentConfig({ lastActiveProject: this.activeProjectName });

    this.broadcast({
      event: 'project_switched',
      projectName: this.activeProjectName,
      trackedFilesCount: this.trackedFiles.size
    });

    this.log(`Switched active project to '${this.activeProjectName}'`, 'info');
  }

  async deleteProject(projectName) {
    const projPath = path.join(this.baseProjectsDir, projectName);
    if (!await fs.pathExists(projPath)) {
      throw new Error(`Project '${projectName}' does not exist.`);
    }

    // Close watcher if it's the active project
    if (this.watcher && projectName === this.activeProjectName) {
      await this.watcher.close();
      this.watcher = null;
    }

    await fs.remove(projPath);
    this.log(`Deleted project '${projectName}'`, 'info');

    // If we deleted the active project, switch to another
    if (projectName === this.activeProjectName) {
      const entries = await fs.readdir(this.baseProjectsDir, { withFileTypes: true });
      const remaining = entries.filter(e => e.isDirectory()).map(e => e.name);
      if (remaining.length > 0) {
        await this.switchProject(remaining[0]);
      } else {
        // No projects left — create a default one
        await this.switchProject('DefaultProject');
      }
    }
  }

  async renameProject(oldName, newName) {
    const oldPath = path.join(this.baseProjectsDir, oldName);
    const newPath = path.join(this.baseProjectsDir, newName);

    if (!await fs.pathExists(oldPath)) {
      throw new Error(`Project '${oldName}' does not exist.`);
    }
    if (await fs.pathExists(newPath)) {
      throw new Error(`A project named '${newName}' already exists.`);
    }

    const isActive = oldName === this.activeProjectName;

    // Close watcher before renaming
    if (this.watcher && isActive) {
      await this.watcher.close();
      this.watcher = null;
    }

    await fs.move(oldPath, newPath);
    this.log(`Renamed project '${oldName}' → '${newName}'`, 'info');

    if (isActive) {
      this.activeProjectName = newName;
      this.activeProjectPath = newPath;
      await this.savePersistentConfig({ lastActiveProject: newName });
      await this.loadProject();
      this.broadcast({ event: 'project_switched', projectName: newName, trackedFilesCount: this.trackedFiles.size });
    }
  }

  async scanInitialFiles() {
    try {
      const allFiles = await this.getFilesRecursive(this.activeProjectPath);
      for (const absPath of allFiles) {
        await this.handleFileAddOrChange(absPath, true);
      }
      this.log(`Initial scan complete: tracked ${this.trackedFiles.size} script files.`, 'info');
    } catch (err) {
      this.log(`Error during initial file scan: ${err.message}`, 'error');
    }
  }

  async getFilesRecursive(dir) {
    let results = [];
    if (!await fs.pathExists(dir)) return results;
    const list = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of list) {
      const res = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.git') {
          results = results.concat(await this.getFilesRecursive(res));
        }
      } else {
        if (entry.name.endsWith('.lua') || entry.name.endsWith('.luau')) {
          results.push(res);
        }
      }
    }
    return results;
  }

  startWatcher() {
    this.watcher = chokidar.watch(this.activeProjectPath, {
      ignored: /(^|[\/\\])\..|node_modules|\.git/,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 }
    });

    this.watcher.on('add',    (absPath) => this.handleFileAddOrChange(absPath));
    this.watcher.on('change', (absPath) => this.handleFileAddOrChange(absPath));
    this.watcher.on('unlink', (absPath) => this.handleFileDelete(absPath));

    // ── Feature 7: TypeScript watcher ──────────────────────────────────────
    if (this.isTypeScriptProject) {
      this.watcher.add(path.join(this.activeProjectPath, '**/*.ts'));
      this.watcher.on('change', (absPath) => {
        if (absPath.endsWith('.ts')) this.runTypeScriptCompile();
      });
      this.log('TypeScript project detected — watching .ts files', 'info');
    }

    this.log(`File watcher listening at: ${this.activeProjectPath}`, 'info');
  }

  async runTypeScriptCompile() {
    if (this.tsCompiling) return;
    this.tsCompiling = true;
    this.log('TypeScript: compiling...', 'info');
    this.broadcast({ event: 'ts_compile_start' });

    exec('npx rbxtsc --watch=false', { cwd: this.activeProjectPath }, (err, stdout, stderr) => {
      this.tsCompiling = false;
      if (err) {
        const msg = stderr || err.message;
        this.log(`TypeScript compile error: ${msg}`, 'error');
        this.broadcast({ event: 'ts_compile_result', success: false, output: msg });
      } else {
        this.log(`TypeScript compiled successfully`, 'info');
        this.broadcast({ event: 'ts_compile_result', success: true, output: stdout });
      }
    });
  }

  // ── Feature 3: Read or create .meta.json for GUID tracking ──────────────
  async getOrCreateMeta(absPath, scriptInfo) {
    const metaPath = absPath + '.meta.json';
    try {
      if (await fs.pathExists(metaPath)) {
        const meta = await fs.readJson(metaPath);
        if (meta.guid) return meta;
      }
    } catch (e) { /* ignore */ }
    // Create new meta
    const meta = {
      guid: crypto.randomUUID(),
      scriptType: scriptInfo.scriptType,
      fullRobloxPath: scriptInfo.fullRobloxPath,
      createdAt: new Date().toISOString()
    };
    try {
      this.writeGuard.set(path.relative(this.activeProjectPath, metaPath).replace(/\\/g, '/'), Date.now());
      await fs.writeJson(metaPath, meta, { spaces: 2 });
    } catch (e) { /* non-fatal */ }
    return meta;
  }

  async handleFileAddOrChange(absPath, isInitial = false) {
    const relPath = path.relative(this.activeProjectPath, absPath).replace(/\\/g, '/');

    // Skip .meta.json sidecars
    if (relPath.endsWith('.meta.json')) return;

    const guardTime = this.writeGuard.get(relPath);
    if (guardTime && Date.now() - guardTime < 1000) return;

    const scriptInfo = this.rojoParser.getScriptInfo(relPath, this.projectConfig.mappings);
    if (!scriptInfo) return;

    try {
      const content = await fs.readFile(absPath, 'utf-8');
      const stats   = await fs.stat(absPath);
      const hash    = hashContent(content);
      const prevData = this.trackedFiles.get(relPath);

      // ── Feature 3: GUID tracking ────────────────────────────────────────
      const meta = await this.getOrCreateMeta(absPath, scriptInfo);
      const guid = meta.guid;

      // ── Feature 3: Rename detection ─────────────────────────────────────
      // If we see a hash that was from a recently deleted file, treat as rename
      const renameCandidate = this.renameCandidates.get(hash);
      if (renameCandidate && renameCandidate.relPath !== relPath) {
        clearTimeout(renameCandidate.timer);
        this.renameCandidates.delete(hash);
        this.log(`Renamed: ${renameCandidate.relPath} → ${relPath}`, 'sync');
        // Copy the old meta (preserve GUID) to new location
        const oldMetaPath = path.join(this.activeProjectPath, renameCandidate.relPath) + '.meta.json';
        const newMetaPath = absPath + '.meta.json';
        if (await fs.pathExists(oldMetaPath)) {
          await fs.copy(oldMetaPath, newMetaPath, { overwrite: true });
        }
        // Send rename action so Studio moves the script instead of delete+create
        const changeRecord = {
          timestamp: Date.now(),
          action: 'rename',
          oldRelPath: renameCandidate.relPath,
          oldScriptInfo: this.rojoParser.getScriptInfo(renameCandidate.relPath, this.projectConfig?.mappings),
          relPath,
          scriptInfo,
          content,
          guid: renameCandidate.guid || guid
        };
        this.trackedFiles.delete(renameCandidate.relPath);
        this.trackedFiles.set(relPath, { content, mtime: stats.mtimeMs, scriptInfo, absPath, guid });
        this.contentHashMap.delete(hash);
        this.contentHashMap.set(hash, relPath);
        this.changeHistory.push(changeRecord);
        if (this.changeHistory.length > 500) this.changeHistory.shift();
        this.broadcast({ event: 'file_renamed', change: changeRecord });
        return;
      }

      if (!prevData || prevData.content !== content) {
        // Track content hash for rename detection
        if (prevData) this.contentHashMap.delete(hashContent(prevData.content));
        this.contentHashMap.set(hash, relPath);

        const fileData = { content, mtime: stats.mtimeMs, scriptInfo, absPath, guid };
        this.trackedFiles.set(relPath, fileData);

        if (!isInitial) {
          const changeRecord = {
            timestamp: Date.now(),
            action: 'update',
            relPath,
            scriptInfo,
            content,
            guid  // ← GUID included so Studio can find exact instance
          };
          this.changeHistory.push(changeRecord);
          if (this.changeHistory.length > 500) this.changeHistory.shift();

          this.log(`Updated script: ${scriptInfo.fullRobloxPath} (${scriptInfo.scriptType})`, 'sync');
          this.broadcast({ event: 'file_changed', change: changeRecord, fileData });
        }
      }
    } catch (err) {
      this.log(`Error reading ${relPath}: ${err.message}`, 'error');
    }
  }

  async handleFileDelete(absPath) {
    const relPath = path.relative(this.activeProjectPath, absPath).replace(/\\/g, '/');
    if (relPath.endsWith('.meta.json')) return; // ignore meta files
    const existing = this.trackedFiles.get(relPath);
    if (!existing) return;

    this.trackedFiles.delete(relPath);
    const hash = existing.content ? hashContent(existing.content) : null;

    // ── Feature 3: Stage as rename candidate for 800ms ───────────────────
    if (hash) {
      const timer = setTimeout(() => {
        // Not renamed — truly deleted
        this.renameCandidates.delete(hash);
        this.contentHashMap.delete(hash);
        const changeRecord = {
          timestamp: Date.now(),
          action: 'delete',
          relPath,
          scriptInfo: existing.scriptInfo,
          guid: existing.guid
        };
        this.changeHistory.push(changeRecord);
        this.log(`Deleted script: ${existing.scriptInfo.fullRobloxPath}`, 'sync');
        this.broadcast({ event: 'file_deleted', change: changeRecord, relPath });
      }, 800);
      this.renameCandidates.set(hash, { relPath, data: existing, guid: existing.guid, timer });
    } else {
      const changeRecord = {
        timestamp: Date.now(), action: 'delete', relPath, scriptInfo: existing.scriptInfo
      };
      this.changeHistory.push(changeRecord);
      this.log(`Deleted script: ${existing.scriptInfo.fullRobloxPath}`, 'sync');
      this.broadcast({ event: 'file_deleted', change: changeRecord, relPath });
    }
  }

  initExpress() {
    this.app.use(cors());
    this.app.use(express.json({ limit: '50mb' }));

    // Serve static desktop UI
    const publicPath = path.join(__dirname, '..', 'public');
    this.app.use(express.static(publicPath));

    // Studio API & Status
    this.app.get('/status', (req, res) => {
      const isConnected = Date.now() - this.lastStudioHeartbeat < 10000;
      res.json({
        activeProject: this.activeProjectName,
        activeProjectPath: this.activeProjectPath,
        baseProjectsDir: this.baseProjectsDir,
        trackedFilesCount: this.trackedFiles.size,
        studioConnected: isConnected,
        lastHeartbeat: this.lastStudioHeartbeat,
        serverTime: Date.now(),
        serverStartTime: this.startTime
      });
    });

    this.app.get('/projects', async (req, res) => {
      try {
        const entries = await fs.readdir(this.baseProjectsDir, { withFileTypes: true });
        const projects = entries.filter(e => e.isDirectory()).map(e => e.name);
        res.json({ projects, activeProject: this.activeProjectName });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    this.app.post('/create-project', async (req, res) => {
      const { name, template } = req.body;
      if (!name) return res.status(400).json({ error: 'Project name required' });
      try {
        await this.createProjectTemplate(name, template || 'standard');
        await this.switchProject(name);
        res.json({ success: true, activeProject: name, template: template || 'standard' });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    this.app.delete('/delete-project', async (req, res) => {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: 'Project name required' });
      try {
        await this.deleteProject(name);
        res.json({ success: true, activeProject: this.activeProjectName });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    this.app.post('/rename-project', async (req, res) => {
      const { oldName, newName } = req.body;
      if (!oldName || !newName) return res.status(400).json({ error: 'oldName and newName required' });
      try {
        await this.renameProject(oldName, newName);
        res.json({ success: true, activeProject: this.activeProjectName });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    this.app.post('/select-project', async (req, res) => {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: 'Project name required' });
      try {
        await this.switchProject(name);
        res.json({ success: true, activeProject: name });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    this.app.get('/files', (req, res) => {
      const fileList = [];
      for (const [relPath, data] of this.trackedFiles.entries()) {
        fileList.push({
          relPath,
          content: data.content,
          scriptInfo: data.scriptInfo,
          guid: data.guid
        });
      }
      res.json({
        projectName: this.activeProjectName,
        files: fileList
      });
    });

    this.app.get('/changes', (req, res) => {
      const since = parseInt(req.query.since || '0', 10);
      const changes = this.changeHistory.filter(c => c.timestamp > since);
      res.json({
        timestamp: Date.now(),
        projectName: this.activeProjectName,
        changes
      });
    });

    this.app.post('/heartbeat', (req, res) => {
      const wasConnected = this.studioConnected;
      this.lastStudioHeartbeat = Date.now();
      this.studioConnected = true;

      if (!wasConnected) {
        this.log(`Roblox Studio connected to project '${this.activeProjectName}'`, 'studio');
        this.broadcast({ event: 'studio_status', connected: true, activeProject: this.activeProjectName });
      }

      res.json({ status: 'connected', activeProject: this.activeProjectName, serverTime: Date.now() });
    });

    this.app.post('/write', async (req, res) => {
      const { relPath, fullRobloxPath, scriptType, content, force } = req.body;
      if (!relPath || content === undefined) {
        return res.status(400).json({ error: 'relPath and content required' });
      }

      try {
        let targetRelPath = relPath;
        if (!targetRelPath.endsWith('.lua') && !targetRelPath.endsWith('.luau')) {
          const ext = scriptType === 'Script' ? '.server.luau' : (scriptType === 'LocalScript' ? '.client.luau' : '.luau');
          targetRelPath = `src/${fullRobloxPath.replace(/\./g, '/')}${ext}`;
        }

        const absPath = path.join(this.activeProjectPath, targetRelPath);
        const existingData = this.trackedFiles.get(targetRelPath);
        const scriptInfo = this.rojoParser.getScriptInfo(targetRelPath, this.projectConfig.mappings) || {
          scriptName: path.basename(targetRelPath).split('.')[0],
          scriptType: scriptType || 'ModuleScript',
          fullRobloxPath: fullRobloxPath || targetRelPath,
          relPath: targetRelPath
        };

        // ── Feature 2: Smart conflict detection ──────────────────────────────
        // If IDE modified this file within last 8s AND content differs, raise conflict
        if (!force && existingData && existingData.content !== content) {
          const ideMtime = existingData.mtime || 0;
          const timeSinceIdeChange = Date.now() - ideMtime;
          if (timeSinceIdeChange < 8000) { // Changed by IDE recently
            this.pendingConflicts.set(targetRelPath, {
              scriptInfo,
              ideContent: existingData.content,
              studioContent: content,
              timestamp: Date.now()
            });
            this.log(`⚠️ Conflict detected: ${targetRelPath} (modified by both IDE and Studio)`, 'warn');
            this.broadcast({
              event: 'file_conflict',
              relPath: targetRelPath,
              scriptInfo,
              ideContent: existingData.content,
              studioContent: content,
              timestamp: Date.now()
            });
            return res.status(409).json({
              conflict: true,
              relPath: targetRelPath,
              message: 'File was recently modified by the IDE. Conflict detected — resolve in the Blox Sync UI.'
            });
          }
        }

        this.writeGuard.set(targetRelPath, Date.now());
        await fs.outputFile(absPath, content, 'utf-8');

        const fileData = { content, mtime: Date.now(), scriptInfo, absPath };
        this.trackedFiles.set(targetRelPath, fileData);

        this.log(`Roblox Studio wrote file: ${targetRelPath}`, 'studio');
        this.broadcast({ event: 'file_changed', change: { action: 'update', relPath: targetRelPath, scriptInfo, content }, fileData });
        res.json({ success: true, relPath: targetRelPath });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.post('/sync-from-studio', async (req, res) => {
      const { scripts } = req.body;
      if (!Array.isArray(scripts)) {
        return res.status(400).json({ error: 'scripts array required' });
      }

      try {
        let count = 0;
        for (const s of scripts) {
          let ext = '.luau';
          if (s.scriptType === 'Script') ext = '.server.luau';
          if (s.scriptType === 'LocalScript') ext = '.client.luau';

          const relPath = `src/${s.fullRobloxPath.replace(/\./g, '/')}${ext}`;
          const absPath = path.join(this.activeProjectPath, relPath);

          this.writeGuard.set(relPath, Date.now());
          await fs.outputFile(absPath, s.content, 'utf-8');

          const scriptInfo = this.rojoParser.getScriptInfo(relPath, this.projectConfig.mappings) || {
            scriptName: s.scriptName || path.basename(relPath).split('.')[0],
            scriptType: s.scriptType,
            fullRobloxPath: s.fullRobloxPath,
            robloxHierarchy: s.fullRobloxPath ? s.fullRobloxPath.split('.').slice(0, -1).join('.') : 'ReplicatedStorage',
            relPath
          };

          const meta = await this.getOrCreateMeta(absPath, scriptInfo);
          if (s.guid) {
            meta.guid = s.guid;
            try { await fs.writeJson(absPath + '.meta.json', meta, { spaces: 2 }); } catch (e) {}
          }
          const guid = meta.guid;
          const fileData = { content: s.content, mtime: Date.now(), scriptInfo, absPath, guid };
          this.trackedFiles.set(relPath, fileData);
          count++;
        }

        this.log(`Bulk export: synced ${count} script(s) from Studio to '${this.activeProjectName}'`, 'studio');
        this.broadcast({ event: 'project_rescanned' });
        res.json({ success: true, count });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // App Control APIs
    this.app.post('/api/open-folder', (req, res) => {
      if (process.platform === 'win32') {
        exec(`explorer "${this.activeProjectPath.replace(/\//g, '\\')}"`);
      } else if (process.platform === 'darwin') {
        exec(`open "${this.activeProjectPath}"`);
      } else {
        exec(`xdg-open "${this.activeProjectPath}"`);
      }
      this.log(`Opened project directory in File Explorer`, 'info');
      res.json({ success: true });
    });

    this.app.post('/api/open-ide', (req, res) => {
      const { ide = 'antigravity', customCmd = '' } = req.body || {};
      const projPath = this.activeProjectPath;
      let cmd = '';

      switch (ide) {
        case 'cursor':
          cmd = `cursor "${projPath}"`;
          break;
        case 'antigravity': {
          const lnkPath = 'C:\\Users\\sumnk\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Antigravity IDE\\Antigravity IDE.lnk';
          const appDataLnk = path.join(
            process.env.APPDATA || '',
            'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Antigravity IDE', 'Antigravity IDE.lnk'
          );
          const exePath = 'C:\\Users\\sumnk\\AppData\\Local\\Programs\\Antigravity IDE\\Antigravity IDE.exe';
          const localAppDataExe = path.join(
            process.env.LOCALAPPDATA || '',
            'Programs', 'Antigravity IDE', 'Antigravity IDE.exe'
          );

          if (fs.existsSync(lnkPath)) {
            cmd = `start "" "${lnkPath}" "${projPath}"`;
          } else if (fs.existsSync(appDataLnk)) {
            cmd = `start "" "${appDataLnk}" "${projPath}"`;
          } else if (fs.existsSync(exePath)) {
            cmd = `start "" "${exePath}" "${projPath}"`;
          } else if (fs.existsSync(localAppDataExe)) {
            cmd = `start "" "${localAppDataExe}" "${projPath}"`;
          } else {
            cmd = `antigravity "${projPath}"`;
          }
          break;
        }
        case 'qoder':
          cmd = `qoder "${projPath}"`;
          break;
        case 'custom':
          if (customCmd) {
            const cleanCmd = customCmd.trim();
            if (cleanCmd.toLowerCase().endsWith('.lnk')) {
              cmd = `start "" "${cleanCmd}" "${projPath}"`;
            } else if (cleanCmd.includes(' ') && !cleanCmd.startsWith('"')) {
              cmd = `"${cleanCmd}" "${projPath}"`;
            } else {
              cmd = `${cleanCmd} "${projPath}"`;
            }
          } else {
            cmd = `code "${projPath}"`;
          }
          break;
        case 'vscode':
        default:
          cmd = `code "${projPath}"`;
          break;
      }

      exec(cmd, (err) => {
        if (err) {
          if (ide === 'antigravity') {
            const fallbackExe = 'C:\\Users\\sumnk\\AppData\\Local\\Programs\\Antigravity IDE\\Antigravity IDE.exe';
            if (fs.existsSync(fallbackExe)) {
              exec(`start "" "${fallbackExe}" "${projPath}"`);
              return;
            }
          }
          if (ide !== 'vscode') {
            exec(`code "${projPath}"`, (err2) => {
              if (err2) exec(`cursor "${projPath}"`);
            });
          } else {
            exec(`cursor "${projPath}"`);
          }
          this.log(`Attempted to launch IDE command '${cmd}', fallback triggered: ${err.message}`, 'error');
        }
      });

      this.log(`Launched IDE (${ide}) using command: ${cmd}`, 'info');
      res.json({ success: true, ide, launchedCommand: cmd });
    });

    this.app.post('/api/open-studio', (req, res) => {
      const studioLnk = 'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\Roblox\\Roblox Studio.lnk';
      const userLnk = path.join(
        process.env.APPDATA || '',
        'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Roblox', 'Roblox Studio.lnk'
      );

      let cmd = '';
      if (process.platform === 'win32') {
        if (fs.existsSync(studioLnk)) {
          cmd = `start "" "${studioLnk}"`;
        } else if (fs.existsSync(userLnk)) {
          cmd = `start "" "${userLnk}"`;
        } else {
          cmd = `start roblox-studio:`;
        }
      } else if (process.platform === 'darwin') {
        cmd = `open -a "RobloxStudio"`;
      } else {
        cmd = `xdg-open roblox-studio:`;
      }

      this.log('Launching Roblox Studio...', 'info');
      exec(cmd, (err) => {
        if (err) {
          this.log(`Failed to launch Roblox Studio: ${err.message}`, 'error');
          return res.status(500).json({ error: err.message });
        }
        this.log('Roblox Studio launched successfully', 'info');
        res.json({ success: true, message: 'Roblox Studio launched', command: cmd });
      });
    });

    this.app.post('/api/rescan', async (req, res) => {
      await this.loadProject();
      this.broadcast({ event: 'project_rescanned' });
      this.log(`Force rescanned project files for '${this.activeProjectName}'`, 'info');
      res.json({ success: true, count: this.trackedFiles.size });
    });

    this.app.post('/api/install-plugin', async (req, res) => {
      const result = await this.ensurePluginInstalled();
      res.json(result);
    });

    // ── MCP AI Tools ─────────────────────────────────────────────────────────
    this.app.get('/api/mcp/status', (req, res) => {
      const status = getMcpStatus();
      res.json(status);
    });

    this.app.post('/api/mcp/install', (req, res) => {
      // Respond immediately, installation progress comes via WebSocket
      res.json({ started: true });
      this.ensureMcpInstalled().catch(() => {});
    });

    this.app.get('/api/logs', (req, res) => {
      res.json({ logs: this.logs });
    });

    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'ok',
        uptime: Date.now() - this.startTime,
        activeProject: this.activeProjectName,
        port: this.port,
        studioConnected: this.studioConnected
      });
    });

    // ══════════════════════════════════════════════════════════════════════
    // PATH B — Luau Execution Engine
    // ══════════════════════════════════════════════════════════════════════

    // Desktop UI / external tool submits Luau code to run inside Studio
    this.app.post('/execute', (req, res) => {
      const { code, context } = req.body;
      if (!code) return res.status(400).json({ error: 'code is required' });
      if (!this.studioConnected) {
        return res.status(503).json({ error: 'Roblox Studio is not connected. Connect Studio first.' });
      }
      const job = {
        id: this.nextJobId++,
        code,
        context: context || 'Manual Execute',
        timestamp: Date.now(),
        status: 'pending'
      };
      this.executeQueue.push(job);
      this.log(`[Execute] Queued job #${job.id}: ${code.slice(0, 60).replace(/\n/g,' ')}...`, 'info');
      res.json({ success: true, jobId: job.id });
    });

    // Studio plugin polls this to pick up pending jobs
    this.app.get('/execute-queue', (req, res) => {
      const pending = this.executeQueue.splice(0); // drain all
      res.json({ jobs: pending });
    });

    // Studio plugin posts the result back after pcall(loadstring(code))
    this.app.post('/execute-result', (req, res) => {
      const { jobId, success, output, error, executionTime } = req.body;
      const result = { jobId, success, output, error, executionTime, timestamp: Date.now() };
      this.executeResults.push(result);
      if (this.executeResults.length > 200) this.executeResults.shift();
      this.executeResultMap[jobId] = result;

      const logMsg = success
        ? `[Execute] Job #${jobId} ✅ (${executionTime}ms): ${(output || '').slice(0, 80)}`
        : `[Execute] Job #${jobId} ❌: ${error}`;
      this.log(logMsg, success ? 'info' : 'error');

      // Broadcast result to all desktop UI clients
      this.broadcast({ event: 'execute_result', result });
      res.json({ success: true });
    });

    // Fetch recent execution results (optional REST polling fallback)
    this.app.get('/execute-results', (req, res) => {
      const since = parseInt(req.query.since || '0', 10);
      res.json({ results: this.executeResults.filter(r => r.timestamp > since) });
    });

    // ══════════════════════════════════════════════════════════════════════
    // PATH B — DataModel Tree Inspector
    // ══════════════════════════════════════════════════════════════════════

    // Studio plugin POSTs a live tree snapshot
    this.app.post('/tree', (req, res) => {
      const { tree } = req.body;
      if (!tree) return res.status(400).json({ error: 'tree required' });
      this.studioTree = tree;
      this.studioTreeTimestamp = Date.now();
      this.broadcast({ event: 'tree_update', tree, timestamp: this.studioTreeTimestamp });
      res.json({ success: true });
    });

    // Desktop UI or external tools fetch latest tree
    this.app.get('/tree', (req, res) => {
      res.json({ tree: this.studioTree, timestamp: this.studioTreeTimestamp });
    });

    // ══════════════════════════════════════════════════════════════════════
    // PATH B — Studio LogService Console Stream
    // ══════════════════════════════════════════════════════════════════════

    // Studio plugin forwards LogService.MessageOut events here
    this.app.post('/log', (req, res) => {
      const { entries } = req.body;
      if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries array required' });
      for (const entry of entries) {
        const logEntry = {
          message: entry.message || '',
          level: entry.level || 'Print',  // Print | Warning | Error
          timestamp: entry.timestamp || Date.now(),
          source: 'studio'
        };
        this.studioConsoleLogs.push(logEntry);
        if (this.studioConsoleLogs.length > 500) this.studioConsoleLogs.shift();
        this.broadcast({ event: 'studio_log', entry: logEntry });
      }
      res.json({ success: true, count: entries.length });
    });

    // REST fallback: fetch recent Studio logs
    this.app.get('/studio-logs', (req, res) => {
      const since = parseInt(req.query.since || '0', 10);
      res.json({ logs: this.studioConsoleLogs.filter(l => l.timestamp > since) });
    });

    // ══════════════════════════════════════════════════════════════════════
    // FEATURE 2 — Smart Conflict Resolution endpoints
    // ══════════════════════════════════════════════════════════════════════

    this.app.get('/api/conflicts', (req, res) => {
      const list = [];
      for (const [relPath, c] of this.pendingConflicts.entries()) {
        list.push({ relPath, scriptInfo: c.scriptInfo, ideContent: c.ideContent, studioContent: c.studioContent, timestamp: c.timestamp });
      }
      res.json({ conflicts: list });
    });

    this.app.post('/api/resolve-conflict', async (req, res) => {
      const { relPath, resolution } = req.body; // resolution: 'ide' | 'studio'
      if (!relPath || !resolution) return res.status(400).json({ error: 'relPath and resolution required' });
      const conflict = this.pendingConflicts.get(relPath);
      if (!conflict) return res.status(404).json({ error: 'No conflict found for this file' });

      this.pendingConflicts.delete(relPath);
      const absPath = path.join(this.activeProjectPath, relPath);

      if (resolution === 'studio') {
        // Overwrite local file with Studio version
        this.writeGuard.set(relPath, Date.now());
        await fs.outputFile(absPath, conflict.studioContent, 'utf-8');
        const fileData = { content: conflict.studioContent, mtime: Date.now(), scriptInfo: conflict.scriptInfo, absPath };
        this.trackedFiles.set(relPath, fileData);
        this.log(`Conflict resolved (Studio wins): ${relPath}`, 'studio');
        this.broadcast({ event: 'conflict_resolved', relPath, resolution: 'studio' });
      } else {
        // Keep IDE version — tell Studio to update
        const ideData = this.trackedFiles.get(relPath);
        if (ideData) {
          const changeRecord = { timestamp: Date.now(), action: 'update', relPath, scriptInfo: conflict.scriptInfo, content: ideData.content, guid: ideData.guid };
          this.changeHistory.push(changeRecord);
          this.broadcast({ event: 'file_changed', change: changeRecord });
        }
        this.log(`Conflict resolved (IDE wins): ${relPath}`, 'info');
        this.broadcast({ event: 'conflict_resolved', relPath, resolution: 'ide' });
      }
      res.json({ success: true, resolution });
    });

    // ══════════════════════════════════════════════════════════════════════
    // FEATURE 1 — .rbxlx Place File Export
    // ══════════════════════════════════════════════════════════════════════

    this.app.get('/api/export-rbxlx', (req, res) => {
      try {
        const xml = this.generateRbxlx();
        const filename = `${this.activeProjectName}.rbxlx`;
        res.setHeader('Content-Type', 'application/xml');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(xml);
        this.log(`Exported place file: ${filename}`, 'info');
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // ══════════════════════════════════════════════════════════════════════
    // FEATURE 6 — Wally Package Manager
    // ══════════════════════════════════════════════════════════════════════

    this.app.post('/api/wally-install', (req, res) => {
      const wallyFile = path.join(this.activeProjectPath, 'wally.toml');
      fs.pathExists(wallyFile).then(exists => {
        if (!exists) {
          this.log('No wally.toml found in project. Create one first.', 'warn');
          return res.status(400).json({ error: 'No wally.toml found in project directory.' });
        }
        this.log('Running wally install...', 'info');
        this.broadcast({ event: 'wally_install_start' });
        exec('wally install', { cwd: this.activeProjectPath }, (err, stdout, stderr) => {
          if (err) {
            const msg = stderr || err.message;
            this.log(`Wally install failed: ${msg}`, 'error');
            this.broadcast({ event: 'wally_install_result', success: false, output: msg });
            return res.status(500).json({ error: msg });
          }
          this.log('Wally install completed successfully!', 'info');
          this.broadcast({ event: 'wally_install_result', success: true, output: stdout });
          res.json({ success: true, output: stdout });
        });
      });
    });

    // Check if wally.toml exists
    this.app.get('/api/wally-status', async (req, res) => {
      const wallyFile = path.join(this.activeProjectPath, 'wally.toml');
      const hasWally = await fs.pathExists(wallyFile);
      const packagesDir = path.join(this.activeProjectPath, 'Packages');
      const hasPackages = await fs.pathExists(packagesDir);
      res.json({ hasWally, hasPackages, projectPath: this.activeProjectPath });
    });

    // Initialize default wally.toml if missing
    this.app.post('/api/wally-init', async (req, res) => {
      try {
        const wallyFile = path.join(this.activeProjectPath, 'wally.toml');
        const exists = await fs.pathExists(wallyFile);
        if (exists) {
          return res.json({ success: true, message: 'wally.toml already exists' });
        }
        const projName = (this.activeProject || 'roblox-project').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
        const template = `[package]
name = "${projName}"
version = "0.1.0"
registry = "https://github.com/Upturn/wally-index"
realm = "shared"

[dependencies]
# Example: Knit = "sleitnick/knit@^1.5.1"
`;
        await fs.writeFile(wallyFile, template, 'utf8');
        this.log(`Created default wally.toml for "${this.activeProject}"`, 'info');
        res.json({ success: true, message: 'wally.toml created' });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // ══════════════════════════════════════════════════════════════════════
    // FEATURE 7 — TypeScript / roblox-ts Manual Compile
    // ══════════════════════════════════════════════════════════════════════

    this.app.post('/api/ts-compile', (req, res) => {
      if (!this.isTypeScriptProject) {
        return res.status(400).json({ error: 'Not a TypeScript project (no tsconfig.json found).' });
      }
      this.runTypeScriptCompile();
      res.json({ success: true, message: 'TypeScript compilation started' });
    });

    this.app.get('/api/ts-status', async (req, res) => {
      const tsConfigPath = path.join(this.activeProjectPath, 'tsconfig.json');
      const hasTs = await fs.pathExists(tsConfigPath);
      res.json({ isTypeScriptProject: hasTs, tsCompiling: this.tsCompiling });
    });
  }

  // ── Feature 1: Generate .rbxlx Roblox place XML (Hierarchical) ─────────
  generateRbxlx() {
    const SCRIPT_CLASS = { Script: 'Script', LocalScript: 'LocalScript', ModuleScript: 'ModuleScript' };
    const TOP_SERVICES = [
      'Workspace', 'ReplicatedStorage', 'ServerScriptService', 'ServerStorage',
      'StarterGui', 'StarterPack', 'StarterPlayer'
    ];

    // Root tree of services and nested folders
    const root = {};
    for (const s of TOP_SERVICES) {
      root[s] = { name: s, isService: true, children: {}, scripts: [] };
    }

    for (const [relPath, data] of this.trackedFiles.entries()) {
      const si = data.scriptInfo;
      if (!si || !si.fullRobloxPath) continue;
      const parts = si.fullRobloxPath.split('.');
      const topService = parts[0];
      if (!root[topService]) {
        root[topService] = { name: topService, isService: false, children: {}, scripts: [] };
      }

      let current = root[topService];
      for (let i = 1; i < parts.length - 1; i++) {
        const seg = parts[i];
        if (!current.children[seg]) {
          current.children[seg] = { name: seg, isFolder: true, children: {}, scripts: [] };
        }
        current = current.children[seg];
      }

      current.scripts.push({
        name: si.scriptName || parts[parts.length - 1],
        className: SCRIPT_CLASS[si.scriptType] || 'ModuleScript',
        content: (data.content || '').replace(/]]>/g, ']]]]><![CDATA[>'),
        guid: data.guid
      });
    }

    let refCount = 1;
    const lines = [
      '<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">',
      '  <External>null</External>',
      '  <External>nil</External>',
      '  <Item class="DataModel" referent="RBX0">',
      '    <Properties>',
      '      <string name="Name">Place</string>',
      '    </Properties>'
    ];

    function renderNode(node, indent) {
      const pad = '  '.repeat(indent);
      for (const scr of node.scripts) {
        const ref = `RBX${refCount++}`;
        lines.push(`${pad}<Item class="${scr.className}" referent="${ref}">`);
        lines.push(`${pad}  <Properties>`);
        lines.push(`${pad}    <string name="Name">${xmlEscape(scr.name)}</string>`);
        lines.push(`${pad}    <ProtectedString name="Source"><![CDATA[${scr.content}]]></ProtectedString>`);
        if (scr.guid) {
          lines.push(`${pad}    <string name="ScriptGuid">{${scr.guid}}</string>`);
        }
        lines.push(`${pad}  </Properties>`);
        lines.push(`${pad}</Item>`);
      }

      for (const [subName, subNode] of Object.entries(node.children)) {
        const ref = `RBX${refCount++}`;
        lines.push(`${pad}<Item class="Folder" referent="${ref}">`);
        lines.push(`${pad}  <Properties>`);
        lines.push(`${pad}    <string name="Name">${xmlEscape(subName)}</string>`);
        lines.push(`${pad}  </Properties>`);
        renderNode(subNode, indent + 1);
        lines.push(`${pad}</Item>`);
      }
    }

    for (const service of TOP_SERVICES) {
      const sNode = root[service];
      const ref = `RBX${refCount++}`;
      lines.push(`    <Item class="${service}" referent="${ref}">`);
      lines.push(`      <Properties><string name="Name">${service}</string></Properties>`);
      renderNode(sNode, 3);
      lines.push('    </Item>');
    }

    lines.push('  </Item>');
    lines.push('</roblox>');
    return lines.join('\n');
  }

  initWebSocket() {
    this.wss.on('connection', (ws) => {
      ws.send(JSON.stringify({
        event: 'connected',
        activeProject: this.activeProjectName,
        activeProjectPath: this.activeProjectPath,
        fileCount: this.trackedFiles.size,
        studioConnected: Date.now() - this.lastStudioHeartbeat < 10000,
        serverStartTime: this.startTime,
        logs: this.logs.slice(-50)
      }));

      ws.on('message', (msg) => {
        try {
          const data = JSON.parse(msg);
          if (data.action === 'ping') {
            ws.send(JSON.stringify({ event: 'pong' }));
          }
        } catch (e) {}
      });
    });

    // Studio disconnect monitor loop
    setInterval(() => {
      const isConnected = Date.now() - this.lastStudioHeartbeat < 10000;
      if (this.studioConnected && !isConnected) {
        this.studioConnected = false;
        this.log(`Roblox Studio disconnected (heartbeat timeout)`, 'studio');
        this.broadcast({ event: 'studio_status', connected: false, activeProject: this.activeProjectName });
      }
    }, 4000);
  }

  broadcast(data) {
    const payload = JSON.stringify(data);
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }
}

if (require.main === module) {
  const appServer = new BloxSyncAppServer();
  appServer.start().catch(console.error);
}

BloxSyncAppServer.BloxSyncAppServer = BloxSyncAppServer;
BloxSyncAppServer.RobloxBridgeAppServer = BloxSyncAppServer;
module.exports = BloxSyncAppServer;

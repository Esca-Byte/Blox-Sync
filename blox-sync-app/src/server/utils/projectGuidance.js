const fs = require('fs-extra');
const path = require('path');

function getReadmeContent(projectName) {
  return `# 🚀 ${projectName} — Roblox Studio Architecture & AI Developer Guide

> **Project Name**: \`${projectName}\`  
> **Synchronization Engine**: [Blox Sync](https://github.com/Esca-Byte) (Rojo Specification Compatible)  
> **Target Platform**: Roblox Studio (Luau Engine)

---

## 📖 Table of Contents
1. [⚠️ Critical AI Agent Architecture Warning](#-critical-ai-agent-architecture-warning)
2. [🎨 Pattern 1: Code-First Programmatic UI Systems (Recommended)](#-pattern-1-code-first-programmatic-ui-systems-recommended)
3. [📁 Pattern 2: Directory Class Override via \`init.meta.json\` (Rojo Standard)](#-pattern-2-directory-class-override-via-initmetajson-rojo-standard)
4. [🔊 Sound, Audio & Background Music Engine](#-sound-audio--background-music-engine)
5. [⚔️ Tools, Equipment, Items & Inventory Workflow](#-tools-equipment-items--inventory-workflow)
6. [🌐 Client-Server Networking (RemoteEvent & RemoteFunction)](#-client-server-networking-remoteevent--remotefunction)
7. [💾 Data Persistence & Player Leaderstats](#-data-persistence--player-leaderstats)
8. [📋 Rojo File Suffix & Service Location Matrix](#-rojo-file-suffix--service-location-matrix)

---

## ⚠️ Critical AI Agent Architecture Warning

> 🚨 **MANDATORY INSTRUCTION FOR ALL AI CODING AGENTS (Cursor, Antigravity, Copilot, Windsurf, Claude)**:
>
> In file systems, **directories are text folders on disk**.
> When synced to Roblox Studio via Rojo, **directories map to generic \`Folder\` instances by default**!
> 
> **NEVER create a raw folder** such as \`src/StarterGui/ShopGui/\` and expect Roblox to automatically convert it into a \`ScreenGui\`!
> In Roblox Studio, a raw folder has no visual canvas and will **NEVER render on player screens**.

To create functional GUIs, models, sounds, or items, you MUST use one of the two standard patterns detailed below.

---

## 🎨 Pattern 1: Code-First Programmatic UI Systems (Recommended)

Write a \`.client.luau\` script inside \`src/StarterGui/\` or \`src/StarterPlayer/StarterPlayerScripts/\` that constructs UI elements dynamically using \`Instance.new()\`.

### 💻 Complete Code-Driven Shop GUI Example:

\`\`\`luau
-- File: src/StarterGui/ShopUI.client.luau
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

-- 1. Create ScreenGui Top-Level Canvas
local screenGui = Instance.new("ScreenGui")
screenGui.Name = "ShopGui"
screenGui.ResetOnSpawn = false
screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
screenGui.Parent = playerGui

-- 2. Create Main Window Frame
local mainFrame = Instance.new("Frame")
mainFrame.Name = "MainFrame"
mainFrame.Size = UDim2.new(0, 500, 0, 360)
mainFrame.Position = UDim2.new(0.5, -250, 0.5, -180)
mainFrame.BackgroundColor3 = Color3.fromRGB(24, 26, 36)
mainFrame.BorderSizePixel = 0
mainFrame.ClipsDescendants = true
mainFrame.Parent = screenGui

-- 3. Add Rounded Corners & Styling
local corner = Instance.new("UICorner")
corner.CornerRadius = UDim.new(0, 12)
corner.Parent = mainFrame

-- 4. Create Header Title Bar
local title = Instance.new("TextLabel")
title.Name = "Title"
title.Text = "🛍️ GAME ITEM SHOP"
title.Size = UDim2.new(1, 0, 0, 50)
title.BackgroundColor3 = Color3.fromRGB(34, 38, 54)
title.TextColor3 = Color3.fromRGB(255, 255, 255)
title.TextSize = 22
title.Font = Enum.Font.GothamBold
title.Parent = mainFrame

-- 5. Create Item Grid Container with UIListLayout
local scrollFrame = Instance.new("ScrollingFrame")
scrollFrame.Name = "ItemsContainer"
scrollFrame.Size = UDim2.new(1, -20, 1, -70)
scrollFrame.Position = UDim2.new(0, 10, 0, 60)
scrollFrame.BackgroundTransparency = 1
scrollFrame.ScrollBarThickness = 6
scrollFrame.Parent = mainFrame

local listLayout = Instance.new("UIListLayout")
listLayout.Padding = UDim.new(0, 8)
listLayout.SortOrder = Enum.SortOrder.LayoutOrder
listLayout.Parent = scrollFrame

print("[ShopUI] Shop GUI successfully initialized on client.")
\`\`\`

---

## 📁 Pattern 2: Directory Class Override via \`init.meta.json\` (Rojo Standard)

If you prefer defining UI containers as directories on disk:

1. Create directory: \`src/StarterGui/ShopGui/\`
2. Create an \`init.meta.json\` file directly inside \`src/StarterGui/ShopGui/\`:
   \`\`\`json
   {
     "className": "ScreenGui",
     "properties": {
       "ResetOnSpawn": false,
       "ZIndexBehavior": "Sibling"
     }
   }
   \`\`\`
3. Put client scripts inside that directory as \`ShopController.client.luau\`.

---

## 🔊 Sound, Audio & Background Music Engine

Audio elements MUST be instantiated as \`Sound\` instances with a valid asset format (\`rbxassetid://<ID>\`).

### 🎵 Playing Background Music via Script:

\`\`\`luau
-- File: src/StarterPlayer/StarterPlayerScripts/MusicManager.client.luau
local SoundService = game:GetService("SoundService")

local bgm = Instance.new("Sound")
bgm.Name = "BackgroundMusic"
bgm.SoundId = "rbxassetid://1848354536" -- Replace with your audio asset ID
bgm.Volume = 0.4
bgm.Looped = true
bgm.Parent = SoundService

bgm:Play()
print("[MusicManager] Background music playing.")
\`\`\`

### 🔊 3D Positional Sound Effects:
Attach \`Sound\` to a 3D \`BasePart\` in \`Workspace\` so it plays in 3D space:
\`\`\`luau
local part = workspace:WaitForChild("SoundEmitterPart")
local sound = Instance.new("Sound")
sound.SoundId = "rbxassetid://9114223171"
sound.Volume = 0.8
sound.Parent = part
sound:Play()
\`\`\`

---

## ⚔️ Tools, Equipment, Items & Inventory Workflow

Tools in Roblox are \`Tool\` instances containing an optional \`Handle\` (a \`BasePart\`).

### Creating a Tool via Code:
\`\`\`luau
-- File: src/ServerScriptService/SwordSpawner.server.luau
local function createSwordTool()
    local tool = Instance.new("Tool")
    tool.Name = "IronSword"
    tool.RequiresHandle = true

    local handle = Instance.new("Part")
    handle.Name = "Handle"
    handle.Size = Vector3.new(1, 4, 1)
    handle.BrickColor = BrickColor.new("Medium stone grey")
    handle.Parent = tool

    return tool
end

-- Give tool to player on join
game.Players.PlayerAdded:Connect(function(player)
    local sword = createSwordTool()
    sword.Parent = player:WaitForChild("Backpack")
end)
\`\`\`

---

## 🌐 Client-Server Networking (RemoteEvent & RemoteFunction)

Networking objects belong in \`ReplicatedStorage\`.

\`\`\`luau
-- File: src/ReplicatedStorage/NetworkInit.luau
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local function getOrCreateRemoteEvent(name)
    local remote = ReplicatedStorage:FindFirstChild(name)
    if not remote then
        remote = Instance.new("RemoteEvent")
        remote.Name = name
        remote.Parent = ReplicatedStorage
    end
    return remote
end

return {
    BuyItem = getOrCreateRemoteEvent("BuyItem"),
    UpdateScore = getOrCreateRemoteEvent("UpdateScore"),
}
\`\`\`

---

## 💾 Data Persistence & Player Leaderstats

Standard player data pattern with leaderstats:

\`\`\`luau
-- File: src/ServerScriptService/Leaderstats.server.luau
local Players = game:GetService("Players")
local DataStoreService = game:GetService("DataStoreService")
local scoreStore = DataStoreService:GetDataStore("PlayerCoins_v1")

Players.PlayerAdded:Connect(function(player)
    local leaderstats = Instance.new("Folder")
    leaderstats.Name = "leaderstats"
    leaderstats.Parent = player

    local coins = Instance.new("IntValue")
    coins.Name = "Coins"
    coins.Value = 0
    coins.Parent = leaderstats

    -- Load saved data
    local success, saved = pcall(function()
        return scoreStore:GetAsync("player_" .. player.UserId)
    end)
    if success and saved then
        coins.Value = saved
    end
end)

Players.PlayerRemoving:Connect(function(player)
    local leaderstats = player:FindFirstChild("leaderstats")
    if leaderstats then
        local coins = leaderstats:FindFirstChild("Coins")
        if coins then
            pcall(function()
                scoreStore:SetAsync("player_" .. player.UserId, coins.Value)
            end)
        end
    end
end)
\`\`\`

---

## 📋 Rojo File Suffix & Service Location Matrix

| Suffix | Roblox Instance | Permitted Locations |
| :--- | :--- | :--- |
| \`*.server.luau\` / \`*.server.lua\` | \`Script\` (Server) | \`ServerScriptService\`, \`Workspace\` |
| \`*.client.luau\` / \`*.client.lua\` | \`LocalScript\` (Client) | \`StarterGui\`, \`StarterPlayer\`, \`StarterPack\` |
| \`*.luau\` / \`*.lua\` | \`ModuleScript\` (Shared) | \`ReplicatedStorage\`, \`ServerStorage\` |
| \`init.luau\` / \`init.lua\` | Parent instance container | Any directory mapped to a service |
| \`init.meta.json\` | Directory class override | Directories needing non-Folder types (e.g. \`ScreenGui\`) |
`;
}

function getKnitReadmeContent(projectName) {
  return `# 🚀 ${projectName} — Knit Framework Architecture Guide

> **Project Name**: \`${projectName}\`  
> **Framework**: [Knit Framework](https://sleitnick.github.io/Knit/) + Superbullet-style Modular Architecture  
> **Synchronization Engine**: [Blox Sync](https://github.com/Esca-Byte)  
> **Target Platform**: Roblox Studio (Luau Engine)

---

## ⚡ CRITICAL RULES FOR AI CODING AGENTS

### ❌ NO YIELDING IN :KnitInit()
\`KnitInit\` (and \`KnitStart\` before \`task.spawn\`) must **NEVER yield**:
- No \`WaitForChild()\`, no \`task.wait()\`, no \`:await()\`, no HTTP or DataStore requests.
- Initialization only: \`Knit.GetService()\`, \`Knit.GetController()\`, assign references, connect events.
- All asynchronous/yielding work **MUST** go inside \`KnitStart\` wrapped in \`task.spawn(function() ... end)\`.

\`\`\`lua
function MyService:KnitStart()
    task.spawn(function()
        -- Safe to yield here:
        local template = ReplicatedStorage:WaitForChild("Template")
        local data = self._store:LoadProfile()
    end)
end
\`\`\`

---

## 🏛️ Project Structure & Component Separation

\`\`\`
src/
├── ReplicatedStorage/
│   ├── ClientSource/
│   │   └── Client/                       ← All Knit Controllers
│   │       ├── DataController.lua        ← Client-side player data cache
│   │       └── TemplateController/
│   │           ├── init.lua
│   │           └── Components/
│   │               ├── Accessor.lua      ← Read-only operations
│   │               ├── Mutator.lua       ← Write operations
│   │               └── Others/           ← Specialized sub-controllers
│   └── SharedSource/
│       └── Datas/
│           └── ProfileTemplate.lua       ← Player data schema
└── ServerScriptService/
    └── ServerSource/
        └── Server/                       ← All Knit Services
            ├── ProfileService.lua        ← Player session & DataStore service
            └── TemplateService/
                ├── init.lua
                └── Components/
                    ├── Accessor.lua      ← Read-only server queries
                    ├── Mutator.lua       ← Write/modify state operations
                    └── Others/           ← Specialized sub-services
\`\`\`

---

## 🔄 Accessor & Mutator Pattern

To keep services and controllers clean and avoid spaghetti code:

| Component | Responsibility | Can Communicate With | Cannot Directly Call |
| :--- | :--- | :--- | :--- |
| **Accessor** | Read-only queries, data gets, calculations | Parent Service, other Services | Mutator (call via Parent) |
| **Mutator** | State writes, value updates, database changes | Parent Service, other Services | Accessor (call via Parent) |
| **Others** | Specific sub-tasks (sound, animations, timers) | Parent Service | Direct sibling Others |

---

## 💾 ProfileService & Player Data Pattern

1. **ProfileTemplate.lua**: Define the exact table schema.
2. **ProfileService.lua**: Handles player session loading, saving, and client networking.
3. **DataController.lua**: Replicates and caches player data on the client.
`;
}

function getUsageContent(projectName) {
  return `# 📖 ${projectName} — Step-by-Step Usage & AI Cheat Sheet

This project is connected in real-time to **Roblox Studio** using **Blox Sync**.

---

## 🔌 1. Setup & Connection

1. **Open Roblox Studio**:
   - Open your project place file.
   - Go to **Home → Game Settings → Security** and enable **Allow HTTP Requests**.
2. **Connect Studio Plugin**:
   - In Roblox Studio, open the **Plugins** tab.
   - Click **Blox Sync → Connect**.
3. **Live Two-Way Sync**:
   - Save any file (\`Ctrl+S\`) in your IDE.
   - The changes sync to Roblox Studio immediately!

---

## 🎨 2. How to Build UI Elements Correctly

### Option A: Programmatic UI (Recommended)
Create \`src/StarterGui/ShopUI.client.luau\` and construct UI dynamically:
\`\`\`luau
local player = game.Players.LocalPlayer
local screenGui = Instance.new("ScreenGui")
screenGui.Name = "ShopGui"
screenGui.ResetOnSpawn = false
screenGui.Parent = player:WaitForChild("PlayerGui")
\`\`\`

### Option B: Directory Override via \`init.meta.json\`
Create directory \`src/StarterGui/ShopGui/\` and place \`init.meta.json\` inside:
\`\`\`json
{
  "className": "ScreenGui",
  "properties": {
    "ResetOnSpawn": false,
    "ZIndexBehavior": "Sibling"
  }
}
\`\`\`

---

## 🔊 3. How to Play Music & Sounds
Add a client script in \`src/StarterPlayer/StarterPlayerScripts/AudioPlayer.client.luau\`:
\`\`\`luau
local SoundService = game:GetService("SoundService")
local sound = Instance.new("Sound")
sound.Name = "BackgroundMusic"
sound.SoundId = "rbxassetid://1848354536"
sound.Volume = 0.5
sound.Looped = true
sound.Parent = SoundService
sound:Play()
\`\`\`

---

## 📋 4. File Suffix Conventions
- \`*.server.luau\` → Server \`Script\` (ServerScriptService, Workspace)
- \`*.client.luau\` → Client \`LocalScript\` (StarterGui, StarterPlayerScripts, StarterPack)
- \`*.luau\` / \`*.lua\` → \`ModuleScript\` (ReplicatedStorage, ServerStorage)

---

## 🤖 5. AI MCP Agent Automation & Playtesting
AI coding assistants connected via MCP have direct access to Roblox Studio tools:
- **Run Playtest**: \`roblox_run_luau\` with \`game:GetService("StudioTestService"):ExecutePlayModeAsync()\`
- **Stop Playtest**: \`roblox_run_luau\` with \`game:GetService("StudioTestService"):StopPlayMode()\`
- **Inspect Studio Logs**: \`roblox_read_studio_logs\` with \`{ "level": "all", "limit": 50 }\`
- **Inspect Instances**: \`roblox_get_datamodel_tree\`
- **Launch Studio**: \`roblox_launch_studio\`
`;
}

function getCursorRulesContent(isKnit = false) {
  if (isKnit) {
    return `# Roblox Studio Project - Knit Framework AI Coding Rules

You are an expert Roblox Luau game engineer working on a Knit Framework project synchronized via Blox Sync.

## 1. ⚠️ ABSOLUTE RULE: NO YIELDING IN KnitInit
- \`KnitInit\` must NEVER call \`WaitForChild\`, \`task.wait\`, \`:await()\`, or any yielding method.
- Use \`KnitInit\` ONLY to register references, services (\`Knit.GetService\`), controllers (\`Knit.GetController\`), and signals.
- Put all async / yielding startup logic in \`KnitStart\`, wrapped inside \`task.spawn(function() ... end)\`.

## 2. 📁 COMPONENT PATTERN (Accessor / Mutator)
- **Accessor.lua**: Strictly READ-ONLY operations.
- **Mutator.lua**: Strictly WRITE / MUTATE operations.
- Accessor and Mutator never directly call each other; all coordination happens through the parent Service/Controller.

## 3. 💾 DATA PERSISTENCE
- Define default player schemas in \`src/ReplicatedStorage/SharedSource/Datas/ProfileTemplate.lua\`.
- All server-side data mutations go through \`ProfileService.lua\`.
- Client views data via \`DataController.lua\`. Never allow clients to write data directly without server validation.

## 4. 🎨 UI & ASSET PATTERNS
- Raw directories map to generic \`Folder\` instances.
- Never place UI components directly into a raw folder expecting it to render as \`ScreenGui\`.
- Build UI programmatically using \`Instance.new("ScreenGui")\` in \`.client.luau\` or use \`init.meta.json\` with \`"className": "ScreenGui"\`.

## 5. 📋 FILE EXTENSIONS
- \`*.server.luau\` -> Server Script
- \`*.client.luau\` -> Client LocalScript
- \`*.luau\` / \`*.lua\` -> ModuleScript
`;
  }

  return `# Roblox Studio Project - AI Coding Agent Rules & Guidelines

You are an expert Roblox Luau game engineer assisting with a project synchronized via Blox Sync.

## 1. ⚠️ CRITICAL ARCHITECTURE RULE: DIRECTORIES VS ROBLOX INSTANCES
- In this Blox Sync (Rojo-compatible) workspace, disk directories map to generic \`Folder\` instances in Roblox Studio.
- DO NOT create a raw folder in \`src/StarterGui/\` expecting it to render as a \`ScreenGui\`.
- Always use either:
  1. Code-First Programmatic UI with \`Instance.new("ScreenGui")\` inside a \`*.client.luau\` script.
  2. Directory override with an \`init.meta.json\` specifying \`"className": "ScreenGui"\`.

## 2. 🔊 AUDIO & SOUNDS
- Create sounds programmatically using \`Instance.new("Sound")\`.
- Always assign a valid \`rbxassetid://<ID>\` to \`Sound.SoundId\` and parent to \`SoundService\` or a 3D \`BasePart\` before calling \`:Play()\`.

## 3. 🌐 CLIENT-SERVER NETWORKING & SECURITY
- Store all \`RemoteEvent\` and \`RemoteFunction\` instances in \`ReplicatedStorage\`.
- NEVER trust client data. Always perform server-side sanity checks and validations for inventory, coins, and purchases.

## 4. 📋 FILE EXTENSION RULES
- \`*.server.luau\` -> Server \`Script\` (ServerScriptService, Workspace)
- \`*.client.luau\` -> Client \`LocalScript\` (StarterGui, StarterPlayerScripts, StarterPack)
- \`*.luau\` / \`*.lua\` -> \`ModuleScript\` (ReplicatedStorage, ServerStorage)

## 5. 🤖 MCP TOOLS DIRECT USAGE GUIDE (NO WEB SEARCHES NEEDED)
When the user asks to run playtests, check logs, lint scripts, or inspect Studio state, ALWAYS call the available \`blox-sync\` MCP tools directly:
- **Start Playtest**: Call \`roblox_start_playtest\` with \`{ "mode": "solo" }\` (or \`{ "mode": "server", "playerCount": 1 }\`).
- **Stop Playtest**: Call \`roblox_stop_playtest\` to halt testing and return Studio to Edit Mode.
- **Lint / Validate Script**: Call \`roblox_lint_script\` with \`relPath\` or \`code\` to statically verify syntax and prevent runtime crashes before syncing.
- **Read Studio Logs / Errors**: Call \`roblox_read_studio_logs\` with \`{ "level": "all", "limit": 50 }\` to immediately diagnose runtime issues.
- **Inspect DataModel Tree**: Call \`roblox_get_datamodel_tree\` with \`serviceFilter: "Workspace"\` or \`"ReplicatedStorage"\`.
- **Run Custom Luau**: Call \`roblox_run_luau\` with raw code to execute arbitrary in-Studio logic.
- **Launch Studio**: Call \`roblox_launch_studio\` to launch the Studio app.
- **Sync / Write Script**: Call \`roblox_write_script\` with \`relPath\` and \`content\`.
- **Check Status**: Call \`roblox_get_status\`.
- **Export Place**: Call \`roblox_export_place\` to generate a standalone \`.rbxlx\` file.
- **Install Wally Packages**: Call \`roblox_install_wally\`.
DO NOT perform web searches for Roblox Studio testing APIs or search local disk folders for the bridge plugin.

## 6. 🧠 BUILT-IN AI SKILLS SUITE (.agents/skills/)
This project includes specialized runbooks in \`.agents/skills/\`:
- **roblox-debug**: Read studio logs, locate offending disk files, apply fixes, and verify with playtests.
- **roblox-security-audit**: Scan RemoteEvents/Functions, enforce server-side authority, validate bounds, and block exploiter manipulation.
- **roblox-datastore-architect**: Design safe DataStore persistence with session locks, UpdateAsync atomic transformations, and BindToClose handlers.
- **roblox-unit-test**: Build and execute automated Luau test suites live in Studio.
- **roblox-perf-profiling**: Benchmark functions with os.clock() and profile memory/spatial queries.
- **roblox-ui-builder**: Generate responsive, glassmorphic UI code with Scale dimensions and tweens.
- **roblox-scene-inspector**: Audit 3D scene physics, unanchored parts, and streaming setups.
`;
}

async function ensureProjectGuidanceFiles(projDir, projectName, overwrite = true, isKnit = false) {
  const readmePath = path.join(projDir, 'README.md');
  const usagePath = path.join(projDir, 'USAGE.md');
  const cursorRulesPath = path.join(projDir, '.cursorrules');

  const readmeContent = isKnit ? getKnitReadmeContent(projectName) : getReadmeContent(projectName);
  const usageContent = getUsageContent(projectName);
  const cursorRulesContent = getCursorRulesContent(isKnit);

  if (overwrite || !await fs.pathExists(readmePath)) {
    await fs.outputFile(readmePath, readmeContent, 'utf8');
  }
  if (overwrite || !await fs.pathExists(usagePath)) {
    await fs.outputFile(usagePath, usageContent, 'utf8');
  }
  if (overwrite || !await fs.pathExists(cursorRulesPath)) {
    await fs.outputFile(cursorRulesPath, cursorRulesContent, 'utf8');
  }

  // Auto-scaffold .agents/skills if the skills repository source exists
  const candidateSkillsDirs = [
    path.resolve(__dirname, '../../../.agents/skills'),
    path.resolve(__dirname, '../../.agents/skills'),
    path.resolve(process.cwd(), '.agents/skills'),
  ];
  for (const srcDir of candidateSkillsDirs) {
    if (await fs.pathExists(srcDir)) {
      const destSkills = path.join(projDir, '.agents', 'skills');
      await fs.copy(srcDir, destSkills, { overwrite: false });
      break;
    }
  }
}

module.exports = {
  getReadmeContent,
  getKnitReadmeContent,
  getUsageContent,
  getCursorRulesContent,
  ensureProjectGuidanceFiles
};

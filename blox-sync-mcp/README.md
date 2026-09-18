# 🤖 Blox Sync — MCP Server (Path A)

> Model Context Protocol (MCP) server connecting AI coding assistants (**Antigravity, Cursor, Claude Desktop, Windsurf**) directly to **Roblox Studio**.

---

## ⚡ What This Does

With this MCP server enabled, your AI assistant can directly call tools inside Roblox Studio:
- **Execute Luau Code**: Run code directly in Studio without copy-pasting into the Command Bar.
- **Inspect the Live DataModel**: Search and inspect instances, folders, parts, and properties across all Roblox services.
- **Read Live Studio Logs**: Stream print, warn, and error logs from Studio's LogService for autonomous debugging.
- **Inspect Synced Scripts**: View all tracked project files and their persistent GUIDs.
- **Write Scripts**: Create and edit scripts with instant hot-reload into Studio.

---

## 🚀 Quick Setup

### 1. Requirements
- Node.js (v18+)
- Blox Sync running (`BloxSyncApp.exe` or `start-bloxsync.bat` on `http://localhost:7777`)
- Roblox Studio with the `BloxSync.lua` plugin connected

### 2. Configuration

#### For Antigravity IDE:
The server is registered in your global Antigravity configuration at:  
`~/.gemini/config/mcp_config.json`:
```json
{
  "mcpServers": {
    "blox-sync": {
      "command": "node",
      "args": [
        "c:/Users/sumnk/Downloads/roblox-vscode-bridge-main/blox-sync-mcp/src/index.js"
      ],
      "env": {
        "BLOX_SYNC_URL": "http://localhost:7777"
      }
    }
  }
}
```

#### For Cursor (`~/.cursor/mcp.json` or Project Settings):
Add to your `mcp.json`:
```json
{
  "mcpServers": {
    "blox-sync": {
      "command": "node",
      "args": [
        "c:/Users/sumnk/Downloads/roblox-vscode-bridge-main/blox-sync-mcp/src/index.js"
      ]
    }
  }
}
```

#### For Claude Desktop (`%APPDATA%\Claude\claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "blox-sync": {
      "command": "node",
      "args": [
        "c:/Users/sumnk/Downloads/roblox-vscode-bridge-main/blox-sync-mcp/src/index.js"
      ]
    }
  }
}
```

---

## 🛠️ Exposed Tools

| Tool | Parameters | Description |
|---|---|---|
| `roblox_get_status` | *(none)* | Checks Blox Sync & Studio connection state, active project, and file count. |
| `roblox_run_luau` | `code` (string), `context` (string) | Executes Luau code live in Roblox Studio and returns stdout, return values, errors, and execution time. |
| `roblox_get_datamodel_tree` | `serviceFilter` (string), `maxDepth` (number) | Inspects the live DataModel hierarchy tree under any service. |
| `roblox_read_studio_logs` | `level` ("all"\|"print"\|"warn"\|"error"), `limit` (number) | Retrieves recent logs from Studio's LogService. |
| `roblox_get_tracked_files` | `includeContent` (boolean) | Lists all scripts synced by Blox Sync with GUIDs. |
| `roblox_write_script` | `relPath` (string), `content` (string), `scriptType` (string), `force` (boolean) | Writes a script to the project with immediate sync into Studio. |
| `roblox_export_place` | *(none)* | Generates and exports a complete `.rbxlx` place file. |
| `roblox_install_wally` | *(none)* | Runs `wally install` in the active project directory. |

---

## 🧪 Testing the MCP Server

You can run the built-in MCP client verification test at any time:
```bash
cd blox-sync-mcp
node test/test_mcp.js
```

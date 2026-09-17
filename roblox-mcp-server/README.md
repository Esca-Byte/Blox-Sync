# 🤖 Roblox Universal Bridge — MCP Server (Path A)

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
- Roblox Universal Bridge running (`RobloxBridgeApp.exe` or `start-bridge.bat` on `http://localhost:7777`)
- Roblox Studio with the `RobloxBridge.lua` plugin connected

### 2. Configuration

#### For Antigravity IDE:
The server is automatically registered in your global Antigravity configuration at:  
`~/.gemini/config/mcp_config.json`:
```json
{
  "mcpServers": {
    "roblox-bridge": {
      "command": "node",
      "args": [
        "c:/Users/sumnk/Downloads/roblox-vscode-bridge-main/roblox-mcp-server/src/index.js"
      ],
      "env": {
        "ROBLOX_BRIDGE_URL": "http://localhost:7777"
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
    "roblox-bridge": {
      "command": "node",
      "args": [
        "c:/Users/sumnk/Downloads/roblox-vscode-bridge-main/roblox-mcp-server/src/index.js"
      ]
    }
  }
}
```

#### For Claude Desktop (`%APPDATA%\Claude\claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "roblox-bridge": {
      "command": "node",
      "args": [
        "c:/Users/sumnk/Downloads/roblox-vscode-bridge-main/roblox-mcp-server/src/index.js"
      ]
    }
  }
}
```

---

## 🛠️ Exposed Tools

| Tool | Parameters | Description |
|---|---|---|
| `roblox_get_status` | *(none)* | Checks bridge & Studio connection state, active project, and file count. |
| `roblox_run_luau` | `code` (string), `context` (string) | Executes Luau code live in Roblox Studio and returns stdout, return values, errors, and execution time. |
| `roblox_get_datamodel_tree` | `serviceFilter` (string), `maxDepth` (number) | Inspects the live DataModel hierarchy tree under any service. |
| `roblox_read_studio_logs` | `level` ("all"\|"print"\|"warn"\|"error"), `limit` (number) | Retrieves recent logs from Studio's LogService. |
| `roblox_get_tracked_files` | `includeContent` (boolean) | Lists all scripts synced by the bridge with GUIDs. |
| `roblox_write_script` | `relPath` (string), `content` (string), `scriptType` (string), `force` (boolean) | Writes a script to the project with immediate sync into Studio. |
| `roblox_export_place` | *(none)* | Generates and exports a complete `.rbxlx` place file. |
| `roblox_install_wally` | *(none)* | Runs `wally install` in the active project directory. |

---

## 🧪 Testing the MCP Server

You can run the built-in MCP client verification test at any time:
```bash
cd roblox-mcp-server
node test/test_mcp.js
```

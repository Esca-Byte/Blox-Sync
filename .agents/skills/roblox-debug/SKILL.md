---
name: roblox-debug
description: >-
  Autonomous debugging, error diagnosis, and live state inspection for Roblox Studio.
  Use this skill whenever runtime errors, script crashes, warnings, or unexpected behaviors occur in a Roblox place.
---

# 🛠️ Roblox Autonomous Debugging Runbook

This skill teaches you how to investigate, locate, and fix Roblox script bugs autonomously using the Blox Sync MCP tools and Studio inspection workflows.

---

## 🎯 Workflow Steps

### 1. Capture Live Error Logs
Do NOT guess what went wrong. First, query the live console stream from Roblox Studio:
- Call `roblox_read_studio_logs` with `{ "level": "error", "limit": 50 }`.
- Note down:
  1. The exact error message (e.g. `attempt to index nil with 'Chatted'`).
  2. The script instance path (e.g. `Workspace.ShopStore.Head.Chat`).
  3. The line number.

### 2. Locate the File on Disk
Translate the Roblox hierarchy path to the tracked local file:
- `Workspace.ShopStore...` -> search inside `src/Workspace/`
- `ServerScriptService...` -> `src/ServerScriptService/`
- `StarterPlayer...` -> `src/StarterPlayer/`
- `ReplicatedStorage...` -> `src/ReplicatedStorage/`
Or call `roblox_get_tracked_files` to find the exact relative path.

### 3. Diagnose Common Roblox Runtime Traps

| Symptom | Root Cause | Proper Fix |
| :--- | :--- | :--- |
| `attempt to index nil with 'Character'` | Player hasn't spawned yet | `local char = player.Character or player.CharacterAdded:Wait()` |
| `attempt to index nil with 'HumanoidRootPart'` | Character parts still streaming/loading | `local hrp = char:WaitForChild("HumanoidRootPart", 10)` |
| `Infinite yield possible for WaitForChild(...)` | Target instance name misspelled, wrong parent, or client/server boundary | Check parent container in Studio via `roblox_get_datamodel_tree` |
| `partOrCharacter must be a Part or a Character` | Passed nil or a non-physical instance to `Chat:Chat()` | Validate `if target and (target:IsA("BasePart") or target:IsA("Model")) then` |

### 4. Inspect Live State in Studio (Optional)
If variable values are unknown, run an ad-hoc query with `roblox_run_luau`:
```luau
local target = workspace:FindFirstChild("ShopStore")
print("Target exists:", target ~= nil, "ClassName:", target and target.ClassName)
```

### 5. Apply the Fix & Verify
1. Edit the file on disk or call `roblox_write_script`.
2. Run `roblox_lint_script` to ensure syntax is clean.
3. Call `roblox_start_playtest` with `{ "mode": "solo" }`.
4. Call `roblox_read_studio_logs` to verify the error no longer appears in console output.
5. Call `roblox_stop_playtest` to return Studio to edit mode.

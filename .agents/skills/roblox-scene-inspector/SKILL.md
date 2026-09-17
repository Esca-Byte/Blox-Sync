---
name: roblox-scene-inspector
description: >-
  Inspect 3D Workspace objects, analyze physical geometry, verify collision groups, check StreamingEnabled setup, and audit lighting.
  Use this skill whenever asked to inspect 3D maps, audit parts, verify spawn points, or check physics setups in Roblox Studio.
---

# 🌐 Roblox 3D Scene Inspection & World Audit Runbook

This skill teaches you how to inspect, analyze, and query 3D objects, models, and world settings in Roblox Studio.

---

## 🎯 Workflow Steps

### 1. High-Level Hierarchy Inspection
Call `roblox_get_datamodel_tree` with `serviceFilter: "Workspace"` and `maxDepth: 2` to survey top-level models, terrain, and folders.

### 2. Spatial & Collision Audits via Luau Runner
Use `roblox_run_luau` to inspect physical configurations:

```luau
-- Audit unanchored parts that could fall or cause physics lag:
local unanchored = {}
for _, part in ipairs(workspace:GetDescendants()) do
    if part:IsA("BasePart") and not part.Anchored and not part:FindFirstAncestorOfClass("Model") then
        table.insert(unanchored, part:GetFullName())
    end
end
print(string.format("Unanchored loose parts count: %d", #unanchored))
```

### 3. StreamingEnabled & Network Ownership Verification
Ensure spawn points and vital interactive objects are correctly configured for streaming:
```luau
local spawns = {}
for _, spawn in ipairs(workspace:GetDescendants()) do
    if spawn:IsA("SpawnLocation") then
        table.insert(spawns, spawn.Name .. " at " .. tostring(spawn.Position))
    end
end
print("Available Spawns: " .. (#spawns > 0 and table.concat(spawns, ", ") or "NONE!"))
```

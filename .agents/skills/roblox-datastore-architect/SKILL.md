---
name: roblox-datastore-architect
description: >-
  Design, audit, and test robust Roblox persistent data systems, session locking, auto-saving, and schema migration.
  Use this skill whenever implementing player saves, inventory persistence, currency systems, or investigating data loss bugs.
---

# 💾 Roblox DataStore & Persistence Architecture Runbook

In production Roblox games, player data loss and item duplication exploits are catastrophic. This skill provides enterprise-grade patterns for `DataStoreService`, `ProfileService`, and custom persistence pipelines.

---

## 🎯 Architectural Principles

### 1. `UpdateAsync` vs `SetAsync` (Preventing Overwrite Race Conditions)
❌ **Never use `SetAsync` for player data**: If two servers attempt to save at the same time, `SetAsync` blindly overwrites whatever is in the store, wiping the other server's progress.
✅ **Always use `UpdateAsync`**: `UpdateAsync` passes the current data into a transformation function. If the data changed on another server between read and write, `UpdateAsync` retries automatically.

```luau
local success, result = pcall(function()
    return playerDataStore:UpdateAsync("Player_" .. player.UserId, function(oldData)
        oldData = oldData or deepCopy(DEFAULT_PROFILE)
        -- Only update if timestamp is newer
        if (oldData.LastSave or 0) <= currentSessionData.LastSave then
            return currentSessionData
        end
        return nil -- Cancel write if incoming data is stale
    end)
end)
```

---

### 2. Session Locking (Preventing Dupe Exploits)
When a player quickly hops servers or experiences network lag, they might load on Server B while Server A hasn't finished saving. Without session locking, players can trade away an item on Server A and still have it loaded on Server B.

**Session Lock Lifecycle:**
1. **On Join (Load):**
   - Check if `ActiveSessionId` exists in DataStore.
   - If locked and heartbeat < 5 minutes old, **reject load / kick player** with `"Data already loaded on another server. Please retry in 1 minute."`
   - Claim the lock by setting `ActiveSessionId = JobId` and `LockTime = os.time()`.
2. **Periodic Heartbeat:**
   - Every 2–3 minutes, update `LockTime` via `UpdateAsync`.
3. **On Leave (Save):**
   - Release lock: set `ActiveSessionId = nil`, save latest state.

---

### 3. Graceful Shutdown (`game:BindToClose`)
When Roblox restarts or closes a server for game updates, scripts only have a short window before the server terminates.
Without `BindToClose`, remaining players' data will NOT save!

```luau
game:BindToClose(function()
    print("Server shutting down, saving all player data...")
    local remaining = 0
    for _, player in ipairs(Players:GetPlayers()) do
        remaining += 1
        task.spawn(function()
            savePlayerData(player, true) -- release session lock
            remaining -= 1
        end)
    end
    
    -- Wait until all saves finish or maximum timeout reached
    local start = os.clock()
    while remaining > 0 and (os.clock() - start) < 25 do
        task.wait(0.2)
    end
    print("All player data successfully saved.")
end)
```

---

### 4. Schema Versioning & Auto-Migration
Never assume saved data matches the latest game code. When you add new currencies or inventory tabs, existing players will have `nil` for those keys:

```luau
local CURRENT_SCHEMA_VERSION = 2

local DEFAULT_PROFILE = {
    SchemaVersion = CURRENT_SCHEMA_VERSION,
    Coins = 100,
    Gems = 10,
    Inventory = {},
    Settings = { MusicVolume = 0.8, SFXVolume = 1.0 }
}

local function reconcile(target, template)
    for key, val in pairs(template) do
        if target[key] == nil then
            if type(val) == "table" then
                target[key] = deepCopy(val)
            else
                target[key] = val
            end
        elseif type(target[key]) == "table" and type(val) == "table" then
            reconcile(target[key], val)
        end
    end
    return target
end
```

---

### 5. Safe Testing in Studio
To prevent polluting production datastores during development:
- Use `RunService:IsStudio()` to prefix keys (e.g. `"DEV_Player_" .. userId`).
- Or use a Mock DataStore harness (`scripts/datastore_mock_harness.luau`) when unit testing persistence logic.

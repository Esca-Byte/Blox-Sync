---
name: roblox-security-audit
description: >-
  Audit Roblox client-server boundaries, RemoteEvents, RemoteFunctions, parameter validation, and exploiter defenses.
  Use this skill whenever building or reviewing network communications, player transactions, combat systems, or inventory actions.
---

# 🛡️ Roblox Network Security & Exploiter Defense Runbook

In Roblox, the client is completely untrusted. Exploiters using memory injection tools (e.g. Solara, Wave, Dex Explorer) can call any `RemoteEvent:FireServer(...)` or `RemoteFunction:InvokeServer(...)` with arbitrary parameters at infinite frequency.

This skill provides a rigorous security checklist, vulnerability scanning workflows, and code patterns to bulletproof server-side network code.

---

## 🚨 The Golden Rule of Roblox Networking
> **"Never trust the client. Validate everything on the server."**
> - The client should only send *intent* (e.g., `"RequestBuyItem", "IronSword"`), never *authority* (e.g., `"SetCoins", 999999` or `"DealDamage", 500`).

---

## 🎯 Security Vulnerability Checklist

### 1. The "Authoritative Client" Flaw (CRITICAL)
❌ **Vulnerable:** Client dictates the outcome:
```luau
-- Server script
TakeDamageRemote.OnServerEvent:Connect(function(player, targetCharacter, damageAmount)
    targetCharacter.Humanoid:TakeDamage(damageAmount) -- EXPLOITER CAN WIPE THE WHOLE SERVER!
end)
```
✅ **Secure:** Server calculates everything:
```luau
-- Server script
AttackRequestRemote.OnServerEvent:Connect(function(player, targetCharacter)
    -- 1. Validate player character & equipped weapon
    local char = player.Character
    if not char or not char:FindFirstChild("HumanoidRootPart") then return end
    local weapon = player.EquippedWeapon.Value
    local baseDamage = WeaponsData[weapon].Damage

    -- 2. Range validation (anti-reach exploit)
    local targetHrp = targetCharacter:FindFirstChild("HumanoidRootPart")
    if not targetHrp then return end
    local dist = (char.HumanoidRootPart.Position - targetHrp.Position).Magnitude
    if dist > WeaponsData[weapon].MaxRange + 4 then return end -- +4 studs ping tolerance

    -- 3. Deal damage authoritatively
    targetCharacter.Humanoid:TakeDamage(baseDamage)
end)
```

---

### 2. Parameter Type and Boundary Validation
Exploiters often send `nil`, `math.huge`, `NaN`, negative numbers, or invalid strings to crash scripts or dupe currency.

Always assert types and numeric bounds:
```luau
BuyItemRemote.OnServerEvent:Connect(function(player, itemName, quantity)
    -- Type check
    if typeof(itemName) ~= "string" or typeof(quantity) ~= "number" then return end
    
    -- Integer and positive range check
    if quantity ~= math.floor(quantity) or quantity <= 0 or quantity > 100 then return end
    
    -- Whitelist check
    local itemData = ShopCatalog[itemName]
    if not itemData then return end
    
    -- Balance check
    local cost = itemData.Price * quantity
    if PlayerData[player].Coins < cost then return end
    
    -- Deduct and grant
    PlayerData[player].Coins -= cost
    InventoryService.AddItem(player, itemName, quantity)
end)
```

---

### 3. Rate Limiting & Cooldown Debounce (Anti-Spam / DoS)
Exploiters can fire a remote 10,000 times per second to overload server CPU or trigger race conditions.

```luau
local lastFired = {}
local COOLDOWN_SECONDS = 0.5

local function isRateLimited(player: Player): boolean
    local now = os.clock()
    local last = lastFired[player] or 0
    if (now - last) < COOLDOWN_SECONDS then
        return true -- Too fast, drop packet
    end
    lastFired[player] = now
    return false
end

Players.PlayerRemoving:Connect(function(player)
    lastFired[player] = nil -- Prevent memory leak
end)
```

---

### 4. Never Use `RemoteFunction:InvokeClient()`
❌ Calling `RemoteFunction:InvokeClient(player, ...)` yields the server thread waiting for the client's reply. If a malicious client overrides the callback or yields indefinitely, **the server thread hangs permanently**, leaking memory and stalling critical server logic.
✅ Instead, fire a `RemoteEvent:FireClient()` and wait for a response on a separate `RemoteEvent` with a strict server-side timeout.

---

## 🔍 Automated Remote Audit Workflow

Run the included scanner script using `roblox_run_luau` to automatically inventory all Remotes and inspect potential exposure:
1. Run `scripts/audit_remotes.luau` via `roblox_run_luau`.
2. Inspect output for:
   - Exposed `RemoteFunction` instances in `ReplicatedStorage`.
   - Remotes placed in suspicious containers.
   - Remote names suggesting client authority (e.g. `SetLevel`, `GiveMoney`, `TeleportTo`).
3. Audit the connected server scripts and apply proper server-side authority guards.

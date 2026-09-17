--!strict
-- scripts/diagnose_world.luau
-- Live world state diagnostics script to run via roblox_run_luau in Studio.

local Players = game:GetService("Players")
local Stats = game:GetService("Stats")
local Workspace = game:GetService("Workspace")

print("==================================================")
print("🛠️ ROBLOX LIVE WORLD DIAGNOSTIC SCAN")
print("==================================================")

-- 1. Memory Health
local totalMem = Stats:GetTotalMemoryUsageMb()
print(string.format("📊 Memory Usage: %.1f MB", totalMem))
if totalMem > 1200 then
    warn("⚠️ High memory consumption detected! Risk of mobile crashes.")
end

-- 2. Physical Instances & Fallen Parts
local unanchoredCount = 0
local fallenParts = 0
local fallenThreshold = Workspace.FallenPartsDestroyHeight

for _, part in ipairs(Workspace:GetDescendants()) do
    if part:IsA("BasePart") then
        if not part.Anchored then
            unanchoredCount += 1
        end
        if part.Position.Y < (fallenThreshold + 50) then
            fallenParts += 1
        end
    end
end

print(string.format("🧱 Total BaseParts scanned: unanchored = %d", unanchoredCount))
if fallenParts > 0 then
    warn(string.format("⚠️ %d parts are near or below FallenPartsDestroyHeight (%d)!", fallenParts, fallenThreshold))
end

-- 3. Player Character Integrity
local players = Players:GetPlayers()
print(string.format("👤 Active Players: %d", #players))
for _, p in ipairs(players) do
    local char = p.Character
    if not char then
        warn(string.format("   ⚠️ Player %s has no Character loaded!", p.Name))
    else
        local hum = char:FindFirstChildOfClass("Humanoid")
        local hrp = char:FindFirstChild("HumanoidRootPart")
        if not hum then
            warn(string.format("   ⚠️ Player %s character missing Humanoid!", p.Name))
        elseif not hrp then
            warn(string.format("   ⚠️ Player %s character missing HumanoidRootPart!", p.Name))
        else
            print(string.format("   ✅ Player %s: Health = %d/%d, Position = (%.1f, %.1f, %.1f)", 
                p.Name, hum.Health, hum.MaxHealth, hrp.Position.X, hrp.Position.Y, hrp.Position.Z))
        end
    end
end

print("==================================================")
